import { readFile } from "node:fs/promises";
import { readHistoricalCsv } from "../src/data/mlb-historical";
import { directBvpGamePoc } from "../src/data/mlb-retrosheet-bvp";

const archive = await readFile(".data/2025csvs.zip");
const ids = readHistoricalCsv(archive, 2025, "gameinfo")
  .filter(row => row.gametype === "regular").slice(0, 3).map(row => row.gid!);
for (const id of ids) {
  const started = performance.now();
  const result = await directBvpGamePoc(archive, 2025, id);
  if (!result.paRows || result.missingRelation || result.mismatches.length || result.metricMismatches.length)
    throw new Error(`BvP PoC consistency failed: ${id}`);
  console.log(JSON.stringify({ sourceGame: id, pa: result.paRows, pairs: result.pairs.length,
    missingRelations: result.missingRelation, paMismatches: result.mismatches.length,
    metricMismatches: result.metricMismatches.length, situationRows: result.situationRows,
    durationMs: Math.round(performance.now() - started) }));
}
