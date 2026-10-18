import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import pin from "../src/data/npb-player-events-release.json";
import retained from "../src/data/npb-player-events-retained-releases.json";
import { npbPlayerEventsSchema } from "../src/domain/npb-player-events";
import { assertHistoricalBridge } from "../src/infrastructure/providers/npb-historical-admission";
async function stageGeneration(root: string, release: typeof pin) {
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex"), cache = `.data/npb-event-release/${release.sha256}.gz`;
  let bytes = await readFile(cache).catch(() => null);
  if (!bytes || hash(bytes) !== release.sha256) {
    const response = await fetch(release.assetUrl, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`Pinned player-event archive HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (bytes.length > 100000 || hash(bytes) !== release.sha256) throw Error("Player-event archive admission mismatch");
  const body = gunzipSync(bytes, { maxOutputLength: 250000 }), dataset = npbPlayerEventsSchema.parse(JSON.parse(body.toString()));
  if (body.length !== release.bytes || hash(body) !== release.bodySha256 || dataset.events.length !== release.events || dataset.players.length !== release.players || dataset.source.revision !== release.sourceRevision || dataset.identityInputSha256 !== release.identityInputSha256) throw Error("Unadmitted player-event projection");
  for (const player of dataset.players) assertHistoricalBridge(player);
  await mkdir(join(root, release.sha256), { recursive: true }); await writeFile(join(root, release.sha256, "2026.json"), body);
  await mkdir(".data/npb-event-release", { recursive: true }); await writeFile(cache, bytes);
  return { events: dataset.events.length, players: dataset.players.length, files: 1, bytes: body.length, canonicalWrites: 0 };
}
export async function stageNpbPlayerEvents(root: string) {
  const prior = [];
  for (const release of retained as (typeof pin)[]) prior.push(await stageGeneration(root, release));
  const current = await stageGeneration(root, pin);
  return { ...current, files: 1 + prior.length, bytes: current.bytes + prior.reduce((n, r) => n + r.bytes, 0), retainedFiles: prior.length };
}
