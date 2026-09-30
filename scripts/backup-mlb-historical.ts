import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { openDataClient } from "../src/data/database";

const args = process.argv.slice(2);
const get = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] ?? fallback : fallback;
const original = get("--db", ".data/mlb-historical.sqlite");
const destination = get("--output", ".data/mlb-historical-backup");
const scratch = get("--scratch", ".data/mlb-historical-restored.sqlite");
const tables = ["mlb_historical_games", "mlb_historical_players", "mlb_historical_mappings", "mlb_historical_releases", "mlb_historical_identity_release"];
const hash = (input: Uint8Array | string) => createHash("sha256").update(input).digest("hex");
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
await mkdir(destination, { recursive: true });
const client = openDataClient(`file:${original}`);
const paTable = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='mlb_historical_plate_appearances'");
if (paTable.rows.length) tables.push("mlb_historical_plate_appearances", "mlb_historical_pa_games");
const sql = await client.execute(`SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('table','index')
  AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END,name`);
const schema = sql.rows.map(row => `${row.sql};`).join("\n") + "\n";
await writeFile(join(destination, "schema.sql"), schema);
const manifest = { formatVersion: 1, source: "Retrosheet + Chadwick Register", schemaSha256: hash(schema),
  tables: [] as { name: string; count: number; chunks: { file: string; sha256: string; rows: number }[] }[] };
for (const table of tables) {
  const countResult = await client.execute(`SELECT COUNT(*) AS n FROM ${quote(table)}`);
  const count = Number(countResult.rows[0]?.n);
  const chunks = [];
  const pa = table === "mlb_historical_plate_appearances", size = pa ? 2000 : 250;
  let lastGame = "", lastSequence = 0;
  for (let offset = 0; offset < count; offset += size) {
    // PA uses WITHOUT ROWID and keyset paging; no million-row OFFSET scans.
    const result = pa ? await client.execute({ sql: `SELECT * FROM ${quote(table)}
      WHERE (gameId,sequence)>(?,?) ORDER BY gameId,sequence LIMIT ?`, args: [lastGame, lastSequence, size] }) :
      await client.execute(`SELECT * FROM ${quote(table)} ORDER BY rowid LIMIT ${size} OFFSET ${offset}`);
    if (pa) { lastGame = String(result.rows.at(-1)?.gameId); lastSequence = Number(result.rows.at(-1)?.sequence); }
    const content = result.rows.map(row => JSON.stringify(row)).join("\n") + "\n";
    const compressed = gzipSync(Buffer.from(content));
    const file = `${table}-${String(offset / size).padStart(4, "0")}.jsonl.gz`;
    await writeFile(join(destination, file), compressed);
    chunks.push({ file, sha256: hash(compressed), rows: result.rows.length });
  }
  manifest.tables.push({ name: table, count, chunks });
}
await writeFile(join(destination, "manifest.json"), JSON.stringify(manifest, null, 2));
client.close();

const restore = openDataClient(`file:${scratch}`);
const existing = await restore.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
if (existing.rows.length) throw new Error("Scratch restore target must be empty");
const schemaRead = await readFile(join(destination, "schema.sql"), "utf8");
if (hash(schemaRead) !== manifest.schemaSha256) throw new Error("Schema hash mismatch");
await restore.executeMultiple(schemaRead);
for (const table of manifest.tables) {
  for (const chunk of table.chunks) {
    const compressed = await readFile(join(destination, chunk.file));
    if (hash(compressed) !== chunk.sha256) throw new Error(`Backup hash mismatch: ${chunk.file}`);
    const rows = gunzipSync(compressed).toString("utf8").trimEnd().split("\n")
      .map(line => JSON.parse(line) as Record<string, string | number | null>);
    if (rows.length !== chunk.rows) throw new Error(`Backup row mismatch: ${chunk.file}`);
    for (let i = 0; i < rows.length; i += 100) {
      await restore.batch(rows.slice(i, i + 100).map(row => ({
        sql: `INSERT INTO ${quote(table.name)} (${Object.keys(row).map(quote).join(",")}) VALUES (${Object.keys(row).map(() => "?").join(",")})`,
        args: Object.values(row),
      })), "write");
    }
  }
  const result = await restore.execute(`SELECT COUNT(*) AS n FROM ${quote(table.name)}`);
  if (Number(result.rows[0]?.n) !== table.count) throw new Error(`Restore count mismatch: ${table.name}`);
}
const representative = await restore.execute(`SELECT game_id,season,game_date,payload_json FROM mlb_historical_games ORDER BY game_id LIMIT 1`);
if (!representative.rows.length || !JSON.parse(String(representative.rows[0]?.payload_json)).batting.length)
  throw new Error("Restored Game repository readback failed");
const restoredPlayer = await restore.execute("SELECT player_id,payload_json FROM mlb_historical_players ORDER BY player_id LIMIT 1");
if (!JSON.parse(String(restoredPlayer.rows[0]?.payload_json)).seasons.length)
  throw new Error("Restored Player repository readback failed");
const restoredSeasons = await restore.execute("SELECT season,COUNT(*) AS games FROM mlb_historical_games GROUP BY season ORDER BY season");
const restoredReleases = await restore.execute("SELECT season,games FROM mlb_historical_releases ORDER BY season");
if (JSON.stringify(restoredSeasons.rows) !== JSON.stringify(restoredReleases.rows))
  throw new Error("Restored Season repository readback failed");
let representativePa: unknown = null;
if (paTable.rows.length) {
  const restoredPa = await restore.execute("SELECT * FROM mlb_historical_plate_appearances ORDER BY gameId,sequence LIMIT 1");
  const source = openDataClient(`file:${original}`);
  const originalPa = await source.execute("SELECT * FROM mlb_historical_plate_appearances ORDER BY gameId,sequence LIMIT 1");
  if (!restoredPa.rows.length || JSON.stringify(restoredPa.rows) !== JSON.stringify(originalPa.rows)) throw new Error("Restored PA readback mismatch");
  representativePa = restoredPa.rows[0]; source.close();
}
restore.close();
console.log(JSON.stringify({ backup: destination, scratch, tables: manifest.tables.map(item => ({ name: item.name, count: item.count })),
  representativeGame: representative.rows[0]?.game_id, representativePlayer: restoredPlayer.rows[0]?.player_id,
  seasons: restoredSeasons.rows, representativePa, schemaSha256: manifest.schemaSha256 }));
