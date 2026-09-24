import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type { DataClient } from "./database";
import { NpbRepository } from "./npb-repository";

export const protectedTables = [
  "schema_migrations", "data_sources", "ingestion_runs", "game_facts", "standings_daily",
  "player_game_batting", "player_game_pitching", "pitcher_appearances", "plate_appearances",
  "master_history", "permanent_events", "season_finals", "source_entity_mappings",
  "npb_games", "npb_ingestion_stages", "npb_game_completeness", "npb_day_runs",
] as const;
export const regenerateTables = ["derived_payloads", "display_cache", "raw_response_manifest"] as const;
type TableName = typeof protectedTables[number];
type BackupTable = { name: TableName; file: string; rows: number; bytes: number; sha256: string; dataSha256: string };
export type BackupManifest = {
  formatVersion: 1; generatedAt: string; sourceDb: string; schemaVersion: number;
  migrationVersions: number[]; schemaFile: string; schemaBytes: number; schemaSha256: string;
  tables: BackupTable[];
};
const sha = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const q = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
const scalar = (value: unknown): string | number | null => {
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "bigint") return value.toString();
  throw new Error("Portable backup encountered unsupported SQLite value");
};
const stableRows = (rows: readonly Record<string, unknown>[]) => rows.map((row) =>
  JSON.stringify(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, scalar(value)])))).join("\n") + (rows.length ? "\n" : "");

export async function exportNpbBackup(client: DataClient, outputDir: string, sourceDb = "database"): Promise<BackupManifest> {
  await mkdir(outputDir, { recursive: true });
  if ((await readdir(outputDir)).length) throw new Error("Backup output directory must be empty");
  const objects = await client.execute("SELECT type,name,sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END,name");
  const names = new Set(objects.rows.filter((row) => row.type === "table").map((row) => String(row.name)));
  for (const table of [...protectedTables,...regenerateTables]) if (!names.has(table)) throw new Error(`Missing schema table: ${table}`);
  const unexpected=[...names].filter((name)=>![...protectedTables,...regenerateTables].some((known)=>known===name));
  if (unexpected.length) throw new Error(`Unclassified backup tables: ${unexpected.join(",")}`);
  const schemaSql = objects.rows.map((row) => `${String(row.sql)};`).join("\n") + "\n";
  const schemaBytes = Buffer.from(schemaSql);
  await writeFile(join(outputDir,"schema.sql"),schemaBytes);
  const tables: BackupTable[] = [];
  for (const name of protectedTables) {
    const result = await client.execute(`SELECT * FROM ${q(name)} ORDER BY rowid`);
    const data = stableRows(result.rows as unknown as Record<string, unknown>[]);
    const compressed = gzipSync(Buffer.from(data));
    const file = `${name}.jsonl.gz`;
    await writeFile(join(outputDir,file),compressed);
    tables.push({ name,file,rows:result.rows.length,bytes:compressed.length,sha256:sha(compressed),dataSha256:sha(data) });
  }
  const migrations = await client.execute("SELECT version FROM schema_migrations ORDER BY version");
  const migrationVersions = migrations.rows.map((row) => Number(row.version));
  const manifest: BackupManifest = { formatVersion:1,generatedAt:new Date().toISOString(),sourceDb,
    schemaVersion:Math.max(0,...migrationVersions),migrationVersions,schemaFile:"schema.sql",
    schemaBytes:schemaBytes.length,schemaSha256:sha(schemaBytes),tables };
  await writeFile(join(outputDir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
  return manifest;
}

export async function restoreNpbBackup(client: DataClient, inputDir: string): Promise<BackupManifest> {
  const manifest = JSON.parse(await readFile(join(inputDir,"manifest.json"),"utf8")) as BackupManifest;
  if (manifest.formatVersion !== 1 || manifest.tables.length !== protectedTables.length ||
    protectedTables.some((name,index) => manifest.tables[index]?.name !== name)) throw new Error("Unsupported or incomplete backup manifest");
  const schema = await readFile(join(inputDir,"schema.sql"));
  if (schema.length !== manifest.schemaBytes || sha(schema) !== manifest.schemaSha256) throw new Error("Schema checksum mismatch");
  const files: { table: BackupTable; rows: Record<string,string|number|null>[] }[] = [];
  for (const table of manifest.tables) {
    if (table.file !== `${table.name}.jsonl.gz`) throw new Error("Unexpected backup path");
    const compressed = await readFile(join(inputDir,table.file));
    if (compressed.length !== table.bytes || sha(compressed) !== table.sha256) throw new Error(`Checksum mismatch: ${table.name}`);
    const data = gunzipSync(compressed).toString("utf8");
    if (sha(data) !== table.dataSha256) throw new Error(`Data checksum mismatch: ${table.name}`);
    const rows = data ? data.trimEnd().split("\n").map((line) => JSON.parse(line) as Record<string,string|number|null>) : [];
    if (rows.length !== table.rows) throw new Error(`Row count mismatch: ${table.name}`);
    files.push({ table,rows });
  }
  const existing = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  if (existing.rows.length) throw new Error("Restore destination must be an empty database");
  await client.executeMultiple(schema.toString("utf8"));
  for (const {table,rows} of files) {
    for (let offset=0;offset<rows.length;offset+=100) {
      const statements = rows.slice(offset,offset+100).map((row) => {
        const columns = Object.keys(row);
        return { sql:`INSERT INTO ${q(table.name)} (${columns.map(q).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
          args:Object.values(row) };
      });
      await client.batch(statements,"write");
    }
    const count = await client.execute(`SELECT COUNT(*) AS n FROM ${q(table.name)}`);
    if (Number(count.rows[0]?.n) !== table.rows) throw new Error(`Restored count mismatch: ${table.name}`);
    const restored = await client.execute(`SELECT * FROM ${q(table.name)} ORDER BY rowid`);
    if (sha(stableRows(restored.rows as unknown as Record<string,unknown>[])) !== table.dataSha256)
      throw new Error(`Restored value mismatch: ${table.name}`);
  }
  const versions = await client.execute("SELECT version FROM schema_migrations ORDER BY version");
  if (JSON.stringify(versions.rows.map((row) => Number(row.version))) !== JSON.stringify(manifest.migrationVersions))
    throw new Error("Restored migration versions differ");
  return manifest;
}

export async function verifyRestoredNpbRepository(client: DataClient): Promise<Record<string, unknown>> {
  const repo = new NpbRepository(client);
  const latest = await repo.findLatestStandings();
  const latestDate = latest[0]?.date;
  const byDate = latestDate ? await repo.findStandingsByDate(latestDate) : [];
  const candidate = await client.execute("SELECT c.game_id,g.game_date FROM npb_game_completeness c JOIN npb_games g ON g.game_id=c.game_id WHERE c.game_status='complete' ORDER BY c.verified_at DESC LIMIT 1");
  const gameId = candidate.rows[0]?.game_id ? String(candidate.rows[0].game_id) : null;
  const gameDate = candidate.rows[0]?.game_date ? String(candidate.rows[0].game_date) : null;
  const game = gameId && gameDate ? (await repo.findGamesByDate(gameDate)).find((item) => item.id === gameId) : null;
  const batting = gameId ? await repo.findBattingByGame(gameId) : [];
  const pitching = gameId ? await repo.findPitchingByGame(gameId) : [];
  const completeness = gameId ? await repo.findGameCompleteness(gameId) : null;
  if (!latest.length || byDate.length !== latest.length || !game || !completeness ||
    batting.length !== completeness.collectedBatters || pitching.length !== completeness.collectedPitchers)
    throw new Error("Restored Repository readback failed");
  return { latestStandings:latest.length,byDate:byDate.length,latestDate,gameId,
    gameDate,batting:batting.length,pitching:pitching.length,completeness:completeness.gameStatus };
}

export async function backupSizeBytes(directory: string): Promise<number> {
  const names = await readdir(directory);
  return (await Promise.all(names.map((name) => stat(join(directory,name))))).reduce((sum,item) => sum+item.size,0);
}
