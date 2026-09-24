import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { migrateData, openDataClient, type DataClient } from "../src/data/database";
import { exportNpbBackup, protectedTables, restoreNpbBackup, verifyRestoredNpbRepository } from "../src/data/npb-backup";

const clients: DataClient[] = [];
afterEach(() => { for (const client of clients.splice(0)) client.close(); });
async function fresh() {
  const dir = await mkdtemp(join(tmpdir(),"npb-backup-test-"));
  const client = openDataClient(`file:${join(dir,"source.db")}`);
  clients.push(client);
  await migrateData(client);
  return {dir,client};
}

test("portable export restores protected rows, migration state and Repository results, excluding caches",async () => {
  const {dir,client} = await fresh();
  await client.execute({sql:`INSERT INTO standings_daily VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args:["2026-09-23",2026,"NPB","Central","npb:team:giants",1,80,50,2,132,.615,0,1,"nf3","2026-09-24T00:00:00Z","2026-09-24T00:00:00Z"]});
  await client.execute({sql:`INSERT INTO npb_games VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args:["test-game",2026,"2026-09-23","npb:team:giants","npb:team:carp",1,"test","18:00","final",2,1,"nf3","record","https://example.com","2026-09-24T00:00:00Z","hash"]});
  await client.execute({sql:`INSERT INTO player_game_batting (game_id,player_id,team_id,source_key,source_record_id,collected_at,source_url) VALUES (?,?,?,?,?,?,?)`,
    args:["test-game","batter","npb:team:giants","nf3","batter","2026-09-24T00:00:00Z","https://example.com/batter"]});
  await client.execute({sql:`INSERT INTO player_game_pitching (fact_id,game_id,player_id,team_id,source_key,source_record_id,collected_at,source_url,role) VALUES (?,?,?,?,?,?,?,?,?)`,
    args:["pitch","test-game","pitcher","npb:team:giants","nf3","pitcher","2026-09-24T00:00:00Z","https://example.com/pitcher","starter"]});
  await client.execute({sql:`INSERT INTO npb_game_completeness VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args:["test-game","complete","complete","complete",1,1,1,1,1,1,"{}","[]","nf3","2026-09-24T00:00:00Z"]});
  await client.execute({sql:`INSERT INTO display_cache VALUES (?,?,?,?)`,args:["key","{}","2026-09-24","2026-09-25"]});
  const backup = join(dir,"backup");
  const manifest = await exportNpbBackup(client,backup,"test-local");
  expect(manifest.tables.map((table) => table.name)).toEqual([...protectedTables]);
  expect(manifest.tables.find((table) => table.name === "player_game_batting")?.rows).toBe(1);
  expect(manifest.schemaVersion).toBe(3);
  expect(JSON.stringify(manifest)).not.toContain("token-secret");
  const scratch = openDataClient(`file:${join(dir,"scratch.db")}`); clients.push(scratch);
  await restoreNpbBackup(scratch,backup);
  expect(await verifyRestoredNpbRepository(scratch)).toMatchObject({latestStandings:1,batting:1,pitching:1,completeness:"complete"});
  const cache = await scratch.execute("SELECT COUNT(*) AS n FROM display_cache");
  expect(Number(cache.rows[0]?.n)).toBe(0);
  await expect(restoreNpbBackup(scratch,backup)).rejects.toThrow("empty database");
});

test("restore rejects tampered backup before creating a schema",async () => {
  const {dir,client} = await fresh();
  const backup = join(dir,"backup");
  await exportNpbBackup(client,backup);
  const file = join(backup,"schema_migrations.jsonl.gz");
  const payload = await readFile(file);
  payload[0] = payload[0]! ^ 1;
  await writeFile(file,payload);
  const scratch = openDataClient(`file:${join(dir,"scratch.db")}`); clients.push(scratch);
  await expect(restoreNpbBackup(scratch,backup)).rejects.toThrow("Checksum mismatch");
  const tables = await scratch.execute("SELECT name FROM sqlite_master WHERE type='table'");
  expect(tables.rows).toHaveLength(0);
});

test("export stops when a new migration adds an unclassified table",async()=>{
  const {dir,client}=await fresh();
  await client.execute("CREATE TABLE new_permanent_fact (id TEXT PRIMARY KEY)");
  await expect(exportNpbBackup(client,join(dir,"backup"))).rejects.toThrow("Unclassified backup tables");
});
