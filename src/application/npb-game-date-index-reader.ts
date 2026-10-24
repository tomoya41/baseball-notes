import pin from "../data/npb-game-date-index-release.json";
import { validateGameDateLookup } from "../domain/npb-game-index";
import { publicDataFetch, rememberPublicResponse } from "../infrastructure/public-response-cache";

export async function readNpbGameDateIndex(baseUrl:string, request:typeof fetch=publicDataFetch, release=pin) {
  const response=await request(`${baseUrl.replace(/\/?$/,"/")}data/npb/games/index/${release.sha256}/dates.json`);
  if(!response.ok)throw Error(`Game date index HTTP ${response.status}`);
  const text=await response.text(),bytes=new TextEncoder().encode(text);
  if(bytes.length!==release.bytes||bytes.length>64_000)throw Error("Game date index size mismatch");
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  if([...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("")!==release.sha256)throw Error("Game date index hash mismatch");
  const data=validateGameDateLookup(JSON.parse(text),release);
  await rememberPublicResponse(response);
  return data;
}
