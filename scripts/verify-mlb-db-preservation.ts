/** Compares immutable baseline Game/PA hashes, releases and canonical mappings. Read-only. */
import { readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { openDataClient } from "../src/data/database";
const args = process.argv.slice(2), get = (key: string) => args[args.indexOf(key) + 1];
if (!args.includes("--baseline") || !args.includes("--db") || !args.includes("--report")) throw Error("Explicit baseline, DB and report required");
const baseline = JSON.parse(await readFile(get("--baseline")!, "utf8")) as Record<string, Record<string, unknown>[]>;
const client = openDataClient(`file:${get("--db")}`), checked: Record<string, number> = {};
for (const [table, rows] of Object.entries(baseline)) {
  if (!["mlb_historical_games", "mlb_historical_pa_games", "mlb_historical_mappings", "mlb_historical_releases"].includes(table)) throw Error("Unexpected baseline table");
  const current = (await client.execute(`SELECT * FROM ${table} ORDER BY 1,2`)).rows;
  const key = (row: Record<string, unknown>) => table === "mlb_historical_mappings" ? `${row.namespace}:${row.source_id}` : String(row.game_id ?? row.gameId ?? row.season);
  const lookup = new Map(current.map(row => [key(row), row]));
  for (const row of rows) {
    const found = lookup.get(key(row));
    if (!found || Object.keys(row).some(field => !isDeepStrictEqual(row[field], found[field]))) throw Error(`Baseline changed: ${table} ${key(row)}`);
  }
  checked[table] = rows.length;
}
client.close();
const report = { result: "PASS", checked, canonicalWrites: 0 };
await writeFile(get("--report")!, JSON.stringify(report)); console.log(JSON.stringify(report));
