import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { gunzipSync } from "node:zlib";
import { validStaticPayload } from "../../src/domain/mlb-historical-public";
import { postseasonHubSchema } from "../../src/domain/competition";

export async function auditHistoricalPostseason(root: string, regular: string) {
const target = join(root, "postseason");

const expectedRegular = JSON.parse(gunzipSync(await readFile(join(regular, "players/index.json.gz"))).toString()).players as { id: string }[];
const regularIds = new Set(expectedRegular.map(p => p.id));
const postPlayers = JSON.parse(gunzipSync(await readFile(join(target, "players/index.json.gz"))).toString()).players as { id: string }[];
const postIds = new Set(postPlayers.map(p => p.id));
const files: string[] = [];
async function walk(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) await walk(join(directory, entry.name)); else files.push(join(directory, entry.name));
  }
}
await walk(target);
let bytes = 0, largestBytes = 0, games = 0, batting = 0, pitching = 0;
const manifests = [], ids = new Set<string>();
for (const file of files) {
  if (!file.endsWith(".json.gz")) throw new Error("Unexpected public postseason file");
  const data = await readFile(file), path = relative(root, file).replaceAll("\\", "/").slice(0, -3);
  bytes += (await stat(file)).size; largestBytes = Math.max(largestBytes, data.length);
  const payload = JSON.parse(gunzipSync(data).toString());
  if (!validStaticPayload(path, payload)) throw new Error(`Invalid public contract: ${path}`);
  if (path.startsWith("postseason/games/")) {
    const g = payload.game;
    if (ids.has(g.id) || path !== `postseason/games/${g.id.replaceAll(":", "_")}.json`) throw new Error("Duplicate/path-mismatched Game");
    ids.add(g.id); games++; batting += g.batting.length; pitching += g.pitching.length;
    if ([...g.batting, ...g.pitching].some(p => !postIds.has(p.playerId))) throw new Error("Player not linked to postseason canonical master");
  }
  if (path.startsWith("postseason/hub/")) manifests.push(postseasonHubSchema.parse(payload));
}
if (manifests.length !== 6 || manifests.reduce((n, h) => n + h.games, 0) !== games || manifests.reduce((n, h) => n + h.battingFacts, 0) !== batting || manifests.reduce((n, h) => n + h.pitchingFacts, 0) !== pitching)
  throw new Error("Hub/detail counts mismatch");
for (const hub of manifests) if (hub.series.flatMap(s => s.games).some(g => !ids.has(g.gameId))) throw new Error("Missing Game Detail");
const sha256 = createHash("sha256");
for (const file of files.sort()) sha256.update(relative(target, file)).update(await readFile(file));
const report = { result: "PASS", files: files.length, games, batting, pitching, bytes, largestBytes, sha256: sha256.digest("hex"),
  sharedRegularPlayerIds: postPlayers.filter(p => regularIds.has(p.id)).length,
  postseasonOnlyPlayerIds: postPlayers.filter(p => !regularIds.has(p.id)).map(p => p.id),
  seasons: manifests.map(h => ({ season: h.season, games: h.games, series: h.series.length, coverage: h.coverage, analysis: h.analysis.status })) };
return { report, hubs: manifests };

}
