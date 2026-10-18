import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import pin from "../src/data/npb-cs-release.json";
import retained from "../src/data/npb-cs-retained-releases.json";
import { npbCsDatasetSchema } from "../src/domain/npb-cs-observations";
import { assertHistoricalBridge } from "../src/infrastructure/providers/npb-historical-admission";
type CsReleasePin = Omit<typeof pin, "scopes"|"gameIds"> & { scopes?: Record<string, string[]>;gameIds?:string[] };
async function stageGeneration(root: string, release: CsReleasePin) {
  const cache = join(".data/npb-history-release", `${release.sha256}.gz`);
  let bytes = await readFile(cache).catch(() => null);
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== release.sha256) {
    const response = await fetch(release.assetUrl, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`Pinned CS release HTTP ${response.status}`); bytes = Buffer.from(await response.arrayBuffer());
  }
  if (bytes.length > 250000 || createHash("sha256").update(bytes).digest("hex") !== release.sha256) throw Error("Pinned CS archive mismatch");
  const body = gunzipSync(bytes, { maxOutputLength: 500000 });
  if (body.length !== release.bytes || createHash("sha256").update(body).digest("hex") !== release.bodySha256) throw Error("CS body mismatch");
  const data = npbCsDatasetSchema.parse(JSON.parse(body.toString()));
  for (const p of data.players) assertHistoricalBridge(p, p);
  if (data.inputSha256 !== release.inputSha256 || data.games.length !== release.games || data.rows.length !== release.rows || data.players.length !== release.players || release.scopes && data.rows.some(r => !release.scopes![r.aggregate.playerId]?.includes(r.aggregate.scope.stage!))) throw Error("CS admission index mismatch");
  if(release.gameIds&&(JSON.stringify(data.games.map(g=>g.id))!==JSON.stringify(release.gameIds)||!data.observations))throw Error("CS game-detail admission mismatch");
  const destination = join(root, release.sha256); await mkdir(destination, { recursive: true }); await writeFile(join(destination, "cs-2026.json"), body); await writeFile(cache, bytes);
  return { files: 1, bytes: body.length, games: data.games.length, rows: data.rows.length, canonicalWrites: 0 };
}
export async function stageNpbCs(root: string) {
  const prior = [];
  for (const release of retained) prior.push(await stageGeneration(root, release));
  const current = await stageGeneration(root, pin);
  return { ...current, files: current.files + prior.length, bytes: current.bytes + prior.reduce((n, p) => n + p.bytes, 0), retainedFiles: prior.length };
}
