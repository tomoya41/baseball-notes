import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import pin from "../src/data/npb-draft-final-release.json";
import { finalDraftForecastSchema } from "../src/domain/npb-draft-final";
import { verifyFinalDraftWindow } from "./npb-draft-final-window";

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export function assertFinalDraftArchive(compressed: Uint8Array, localBody: Uint8Array, expected: { sha256: string; bodySha256: string; bytes: number }) {
  if (compressed.length > 50000 || hash(compressed) !== expected.sha256) throw Error("Public final archive digest mismatch");
  const published = gunzipSync(compressed, { maxOutputLength: 150000 });
  if (published.length !== expected.bytes || hash(published) !== expected.bodySha256 || !published.equals(localBody)) throw Error("Public final archive body mismatch");
}

export async function stageNpbFinalDraft(root: string) {
  await verifyFinalDraftWindow();
  // Reviewed editorial source, not a provider dump. Its exact immutable projection is pinned independently of result facts.
  const f = finalDraftForecastSchema.parse(JSON.parse(await readFile("src/data/npb-draft-2026-final-forecast.json", "utf8")));
  const body = Buffer.from(JSON.stringify(f) + "\n");
  if (body.length > 150000 || body.length !== pin.bytes || createHash("sha256").update(body).digest("hex") !== pin.bodySha256 || f.frozenAt !== pin.frozenAt) throw Error("Frozen final forecast mismatch");
  // gzip bytes vary across OS/zlib versions. Verify the actual published bytes, never recompress or replace them.
  const cache = join(".data/npb-draft-final-release", `${pin.sha256}.gz`);
  let compressed = await readFile(cache).catch(() => null);
  if (!compressed || hash(compressed) !== pin.sha256) {
    const response = await fetch(pin.assetUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.body) throw Error(`Final archive HTTP ${response.status}`);
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
    try { for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 50000) throw Error("Final archive byte budget exceeded"); chunks.push(part.value); } }
    catch (error) { await reader.cancel().catch(() => undefined); throw error; } finally { reader.releaseLock(); }
    compressed = Buffer.concat(chunks);
  }
  assertFinalDraftArchive(compressed, body, pin);
  await mkdir(".data/npb-draft-final-release", { recursive: true }); await writeFile(cache, compressed);
  const destination = join(root, pin.sha256);
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, "final-2026.json"), body);
  return { files: 1, bytes: body.length, canonicalWrites: 0 };
}
