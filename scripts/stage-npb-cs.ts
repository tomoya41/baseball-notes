import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import pin from "../src/data/npb-cs-release.json";
import { npbCsDatasetSchema } from "../src/domain/npb-cs-observations";
import { assertHistoricalBridge } from "../src/infrastructure/providers/npb-historical-admission";
export async function stageNpbCs(root: string) {
  const cache = join(".data/npb-history-release", `${pin.sha256}.gz`);
  let bytes = await readFile(cache).catch(() => null);
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== pin.sha256) {
    const response = await fetch(pin.assetUrl, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`Pinned CS release HTTP ${response.status}`); bytes = Buffer.from(await response.arrayBuffer());
  }
  if (bytes.length > 250000 || createHash("sha256").update(bytes).digest("hex") !== pin.sha256) throw Error("Pinned CS archive mismatch");
  const body = gunzipSync(bytes, { maxOutputLength: 500000 });
  if (body.length !== pin.bytes || createHash("sha256").update(body).digest("hex") !== pin.bodySha256) throw Error("CS body mismatch");
  const data = npbCsDatasetSchema.parse(JSON.parse(body.toString()));
  for (const p of data.players) assertHistoricalBridge(p, p);
  if (data.inputSha256 !== pin.inputSha256 || data.games.length !== pin.games || data.rows.length !== pin.rows || data.players.length !== pin.players || data.rows.some(r => !Object.entries(pin.scopes).some(([id, stages]) => id === r.aggregate.playerId && stages.includes(r.aggregate.scope.stage!)))) throw Error("CS admission index mismatch");
  const destination = join(root, pin.sha256); await mkdir(destination, { recursive: true }); await writeFile(join(destination, "cs-2026.json"), body); await writeFile(cache, bytes);
  return { files: 1, bytes: body.length, games: data.games.length, rows: data.rows.length, canonicalWrites: 0 };
}
