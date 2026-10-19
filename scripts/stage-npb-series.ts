import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import pin from "../src/data/npb-series-release.json";
import csPin from "../src/data/npb-cs-release.json";
import { npbCsDatasetSchema } from "../src/domain/npb-cs-observations";
import { assertCsSeriesSnapshot, npbPostseasonSeriesSchema } from "../src/domain/npb-postseason-series";

export async function stageNpbSeries(root: string) {
  const cache = join(".data/npb-history-release", `${pin.sha256}.gz`), hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
  let archive = await readFile(cache).catch(() => null);
  if (!archive || hash(archive) !== pin.sha256) {
    const response = await fetch(pin.assetUrl, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`Series release HTTP ${response.status}`);
    archive = Buffer.from(await response.arrayBuffer());
  }
  if (archive.length > 50000 || hash(archive) !== pin.sha256) throw Error("Series archive mismatch");
  const body = gunzipSync(archive, { maxOutputLength: 50000 });
  if (body.length !== pin.bytes || hash(body) !== pin.bodySha256) throw Error("Series body mismatch");
  const data = npbPostseasonSeriesSchema.parse(JSON.parse(body.toString()));
  if (data.baseBodySha256 !== pin.baseBodySha256 || pin.baseBodySha256 !== csPin.bodySha256) throw Error("Series generation mismatch");
  const csBody = await readFile(join(root, csPin.sha256, "cs-2026.json"));
  if (hash(csBody) !== csPin.bodySha256) throw Error("Series base mismatch");
  assertCsSeriesSnapshot(data, npbCsDatasetSchema.parse(JSON.parse(csBody.toString())));
  const destination = join(root, pin.sha256); await mkdir(destination, { recursive: true });
  await writeFile(join(destination, "series-2026.json"), body); await writeFile(cache, archive);
  return { files: 1, bytes: body.length, compressedBytes: archive.length, series: data.series.length, canonicalWrites: 0 };
}
