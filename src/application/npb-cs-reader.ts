import { publicAssetBase } from "../app/platform";
import { publicDataFetch, rememberPublicResponse } from "../infrastructure/public-response-cache";
import { npbCsDatasetSchema } from "../domain/npb-cs-observations";
import pin from "../data/npb-cs-release.json";
export const admittedCsScopes = Object.entries(pin.scopes).flatMap(([playerId, stages]) => stages.map(stage => ({ playerId, season: 2026, stage })));
export async function readNpbCs(request: typeof fetch = publicDataFetch) {
  const response = await request(`${publicAssetBase()}data/npb/competitions/${pin.sha256}/cs-2026.json`);
  if (!response.ok) throw Error(`CS observation HTTP ${response.status}`);
  const text = await response.text(), bytes = new TextEncoder().encode(text);
  if (bytes.length !== pin.bytes || bytes.length > 500000) throw Error("CS observation size mismatch");
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  if ([...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, "0")).join("") !== pin.bodySha256) throw Error("CS observation hash mismatch");
  const data = npbCsDatasetSchema.parse(JSON.parse(text));
  if (data.inputSha256 !== pin.inputSha256 || data.games.length !== pin.games || data.players.length !== pin.players || data.rows.length !== pin.rows) throw Error("Unadmitted CS generation");
  await rememberPublicResponse(response); return data;
}
