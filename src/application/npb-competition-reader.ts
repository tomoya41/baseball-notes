import { npbPostseasonAggregateDatasetSchema } from "../domain/npb-competition";
import pin from "../data/npb-postseason-release.json";
import { publicAssetBase } from "../app/platform";
import { publicDataFetch, rememberPublicResponse } from "../infrastructure/public-response-cache";
/** Tiny, explicit historical admission index. No 2026 or Current coverage is implied. */
export const admittedNpbPostseasonScopes=pin.scopes;
export async function readNpbPostseasonAggregates(request:typeof fetch=publicDataFetch) {
  const response=await request(`${publicAssetBase()}data/npb/competitions/${pin.sha256}/postseason.json`);
  if(!response.ok)throw Error(`NPB competition HTTP ${response.status}`);
  const text=await response.text();if(new TextEncoder().encode(text).length!==pin.bytes||pin.bytes>125000)throw Error("Competition payload size mismatch");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  if([...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,"0")).join("")!==pin.bodySha256)throw Error("Competition payload hash mismatch");
  const d=npbPostseasonAggregateDatasetSchema.parse(JSON.parse(text));
  if(d.inputSha256!==pin.inputSha256||d.rows.length!==pin.rows||d.players.length!==pin.players)throw Error("Competition generation mismatch");
  await rememberPublicResponse(response);return d;
}
