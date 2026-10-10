import { gunzipSync } from "node:zlib";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import { postseasonCapabilitiesSchema } from "../src/domain/postseason-capabilities";
const base = "https://tomoya41.github.io/baseball-notes/data/";
async function read(path: string) {
  const r = await fetch(`${base}${path}?v=${Date.now()}`);
  if (!r.ok) throw new Error(`Public Postseason HTTP ${r.status}`);
  const data = Buffer.from(await r.arrayBuffer());
  return JSON.parse(path.endsWith(".gz") ? gunzipSync(data).toString() : data.toString());
}
const capabilities = postseasonCapabilitiesSchema.parse(await read("postseason/capabilities.json"));
for (const season of capabilities.leagues.MLB.historicalSeasons) {
  const path = `postseason/hub/${season}.json`, hub = await read(`mlb/historical/${path}.gz`);
  if (!validStaticPayload(path, hub)) throw new Error("Invalid public Hub");
  const gameId = hub.series[0].games[0].gameId;
  const gamePath = `postseason/games/${gameId.replaceAll(":", "_")}.json`;
  const game = await read(`mlb/historical/${gamePath}.gz`);
  if (!validStaticPayload(gamePath, game)) throw new Error("Invalid public Game");
  console.log(JSON.stringify({ season, http: 200, games: hub.games, series: hub.series.length, coverage: hub.coverage, analysis: hub.analysis.status }));
}
