import { publicAssetBase } from "../app/platform";
import { publicDataFetch,rememberPublicResponse } from "../infrastructure/public-response-cache";
import { draftEventSchema } from "../domain/npb-draft-event";
import pin from "../data/npb-draft-2026-release.json";

export async function readNpbDraftEvent(request:typeof fetch=publicDataFetch){
  const response=await request(`${publicAssetBase()}data/npb/draft/${pin.sha256}/draft-2026.json`);
  if(!response.ok)throw Error(`Draft HTTP ${response.status}`);
  const text=await response.text(),bytes=new TextEncoder().encode(text);
  const hash=async(input:Uint8Array<ArrayBuffer>)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",input))].map(n=>n.toString(16).padStart(2,"0")).join("");
  if(bytes.length!==pin.bytes||bytes.length>250000||await hash(bytes)!==pin.bodySha256)throw Error("Draft payload mismatch");
  const data=draftEventSchema.parse(JSON.parse(text));
  if(await hash(new TextEncoder().encode(JSON.stringify(data.forecast)))!==pin.forecastSha256)throw Error("Draft forecast mismatch");
  await rememberPublicResponse(response);return data;
}
