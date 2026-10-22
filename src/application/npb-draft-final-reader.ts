import { publicAssetBase } from "../app/platform";
import { publicDataFetch, rememberPublicResponse } from "../infrastructure/public-response-cache";
import { finalDraftForecastSchema } from "../domain/npb-draft-final";
import pin from "../data/npb-draft-final-release.json";

export async function readNpbFinalDraft(request: typeof fetch = publicDataFetch) {
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
