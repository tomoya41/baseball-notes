import { publicAssetBase } from "../app/platform";
import { publicDataFetch, rememberPublicResponse } from "../infrastructure/public-response-cache";
import { npbPostseasonSeriesSchema } from "../domain/npb-postseason-series";
import pin from "../data/npb-series-release.json";
import csPin from "../data/npb-cs-release.json";

/** Small immutable sidecar; no DB, profile fan-out or source-page requests. */
export async function readNpbSeries(request: typeof fetch = publicDataFetch) {
  const response = await request(`${publicAssetBase()}data/npb/competitions/${pin.sha256}/series-2026.json`);
  if (!response.ok) throw Error(`CS series HTTP ${response.status}`);
  const text = await response.text(), bytes = new TextEncoder().encode(text);
  if (bytes.length !== pin.bytes || bytes.length > 50000) throw Error("CS series size mismatch");
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2,"0")).join("");
  if (hash !== pin.bodySha256) throw Error("CS series hash mismatch");
  const data = npbPostseasonSeriesSchema.parse(JSON.parse(text));
  if (data.baseBodySha256 !== pin.baseBodySha256 || pin.baseBodySha256 !== csPin.bodySha256) throw Error("CS series generation mismatch");
  await rememberPublicResponse(response); return data;
}
