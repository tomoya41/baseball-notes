/** Local isolated candidate DBs. Canonical remote databases are never opened. */
import { mkdir, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { openDataClient } from "../src/data/database";
await mkdir(".data/integrated-history", { recursive: true });
const report = [];
for (const scope of ["regular", "postseason"] as const) {
  const source = scope === "regular" ? ".data/mlb-historical.sqlite" : ".data/mlb-postseason.sqlite";
  const destination = `.data/integrated-history/expanded-${scope}.sqlite`;
  const client = openDataClient(`file:${source}`);
  const tables = ["mlb_historical_games", "mlb_historical_pa_games", "mlb_historical_mappings", "mlb_historical_releases"];
  const rows = Object.fromEntries(await Promise.all(tables.map(async table => {
    const result = await client.execute(`SELECT * FROM ${table} ORDER BY 1,2`);
    // Per-Game hashes protect full Facts/PA; mappings protect canonical identity continuity.
    return [table, result.rows.map(row => table === "mlb_historical_games" ?
      { game_id: row.game_id, season: row.season, content_sha256: row.content_sha256 } : row)];
  })));
  await writeFile(`.data/integrated-history/baseline-${scope}.json`, JSON.stringify(rows));
  await client.execute(`VACUUM INTO '${destination}'`);
  client.close();
  report.push({ scope, sourceBytes: (await stat(source)).size, snapshotBytes: (await stat(destination)).size,
    baselineSha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex") });
}
await writeFile(".data/integrated-history/snapshots.json", JSON.stringify(report));
console.log(JSON.stringify(report));
