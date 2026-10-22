import { publicAssetBase } from "../app/platform";
import { publicDataFetch, rememberPublicResponse } from "../infrastructure/public-response-cache";
import { finalDraftForecastSchema, type FinalDraftForecast } from "../domain/npb-draft-final";
import pin from "../data/npb-draft-final-release.json";

let admitted: Promise<FinalDraftForecast> | null = null;
export function readNpbFinalDraft(request: typeof fetch = publicDataFetch) {
  if (request !== publicDataFetch) return loadFinalDraft(request);
  // The content-addressed edition never changes. Keep one validated request across preview/candidate navigation.
  admitted ??= loadFinalDraft(request).catch(error => { admitted = null; throw error; });
  return admitted;
}
async function loadFinalDraft(request: typeof fetch) {
  const response = await request(`${publicAssetBase()}data/npb/draft/${pin.sha256}/final-2026.json`);
  if (!response.ok) throw Error(`Final forecast HTTP ${response.status}`);
  const text = await response.text(), bytes = new TextEncoder().encode(text);
  if (bytes.length !== pin.bytes || bytes.length > 150000) throw Error("Final forecast payload size mismatch");
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("");
  if (hash !== pin.bodySha256) throw Error("Final forecast payload hash mismatch");
  const data = finalDraftForecastSchema.parse(JSON.parse(text));
  if (data.frozenAt !== pin.frozenAt) throw Error("Wrong final forecast edition");
  await rememberPublicResponse(response);
  return data;
}
