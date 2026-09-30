import { writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import type { AdvancedPlayerPayload } from "../src/domain/mlb-pa-analysis";

const args = process.argv.slice(2), get = (key: string, fallback: string) => args.includes(key) ? args[args.indexOf(key) + 1] ?? fallback : fallback;
const base = get("--base", "https://tomoya41.github.io/baseball-notes/");
const requests: { path: string; status: number; bodyBytes: number; contentLength: number | null; contentEncoding: string | null;
  fetchMs: number; parseMs: number }[] = [];
async function historical(path: string) {
  const started = performance.now(), response = await fetch(`${base}data/mlb/historical/${path}.gz?v=${Date.now()}`);
  if (!response.ok) throw new Error(`Public Historical HTTP ${response.status}: ${path}`);
  const bytes = Buffer.from(await response.arrayBuffer()), fetched = performance.now();
  const text = (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString("utf8");
  const result = JSON.parse(text);
  if (!validStaticPayload(path, result)) throw new Error(`Public contract: ${path}`);
  const length = response.headers.get("content-length");
  requests.push({ path, status: response.status, bodyBytes: bytes.length, contentLength: length === null ? null : Number(length),
    contentEncoding: response.headers.get("content-encoding"),
    fetchMs: fetched - started, parseMs: performance.now() - fetched });
  return result;
}
const manifest = await historical("manifest.json"), capabilities = await historical("advanced/capabilities.json");
if (manifest.current2026 !== "unavailable" || capabilities.rawPaPublic !== false) throw new Error("Current/raw-PA capability");
if ((manifest.features.directBvp === "available") !== (capabilities.directBvp === "ready")) throw new Error("BvP capability mismatch");
const rates = [];
for (const season of manifest.seasons) {
  const records = await historical(`records/${season.season}.json`);
  rates.push({ season: season.season, state: records.rate, requiredPa: records.requiredPa, requiredOuts: records.requiredOuts });
}
const players = await historical("players/index.json");
const representative = players.players.find((row: { name: string }) => row.name === "Shohei Ohtani");
if (!representative) throw new Error("Representative historical Player unavailable");
await historical(`players/${representative.id.replaceAll(":", "_")}.json`);
const single = await historical(`advanced/2025/${representative.id.replaceAll(":", "_")}.json`) as AdvancedPlayerPayload;
const range = await historical(`advanced/range/${representative.id.replaceAll(":", "_")}.json`) as AdvancedPlayerPayload;
const matchup = range.batting.opponents[0];
if (capabilities.directBvp === "ready" && (!matchup || range.batting.opponents.length < single.batting.opponents.length)) throw new Error("BvP scope/sample");
const result = { result: "PASS", base, current2026: manifest.current2026, capabilities, rates,
  representative: { playerId: representative.id, opponent: matchup }, requests, dbSelects: 0, rawPaPublic: false };
await writeFile(get("--report", ".data/mlb-advanced-http.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
