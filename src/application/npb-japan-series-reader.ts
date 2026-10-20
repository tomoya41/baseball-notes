import { publicAssetBase } from "../app/platform";
import { publicDataFetch,rememberPublicResponse } from "../infrastructure/public-response-cache";
import { npbJapanSeriesSchema } from "../domain/npb-japan-series";
import pin from "../data/npb-japan-series-release.json";
import csPin from "../data/npb-series-release.json";
export async function readNpbJapanSeries(request:typeof fetch=publicDataFetch){
  const r=await request(`${publicAssetBase()}data/npb/competitions/${pin.sha256}/japan-series-2026.json`);
  if(!r.ok)throw Error(`Japan Series HTTP ${r.status}`);
  const text=await r.text(),bytes=new TextEncoder().encode(text);
  if(bytes.length!==pin.bytes||bytes.length>50000)throw Error("Japan Series size mismatch");
  const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(n=>n.toString(16).padStart(2,"0")).join("");
  if(hash!==pin.bodySha256)throw Error("Japan Series hash mismatch");
  const d=npbJapanSeriesSchema.parse(JSON.parse(text));
  if(d.csSeriesBodySha256!==csPin.bodySha256||pin.csSeriesBodySha256!==csPin.bodySha256||d.series.id!==pin.seriesId||JSON.stringify(d.series.games.map(g=>g.gameId))!==JSON.stringify(pin.gameIds))throw Error("Japan Series generation mismatch");
  await rememberPublicResponse(r);return d;
}
