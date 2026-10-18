import { npbHistoricalDatasetSchema, npbHistoricalManifestSchema, type NpbHistoricalManifest } from "../domain/npb-historical";
import { publicAssetBase } from "../app/platform";
import { publicDataFetch, rememberPublicResponse } from "../infrastructure/public-response-cache";
import release from "../data/npb-historical-release.json";

const tasks = new Map<string,Promise<unknown>>();
async function read(path:string, parse:(value:unknown)=>unknown, request:typeof fetch, expectedHash?:string) {
  const response=await request(`${publicAssetBase()}data/npb/historical/${release.sha256}/${path}`);
  if(!response.ok) throw Error(`NPB Historical HTTP ${response.status}`);
  const text=await response.text(); if(new TextEncoder().encode(text).length>500000) throw Error("Historical payload exceeds bound");
  if(expectedHash) {
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
    const actual=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,"0")).join("");
    if(actual!==expectedHash) throw Error("Historical payload hash mismatch");
  }
  const value=parse(JSON.parse(text));await rememberPublicResponse(response);return value;
}
export async function readNpbHistoricalManifest(request:typeof fetch=publicDataFetch) {
  return npbHistoricalManifestSchema.parse(await read("manifest.json",v=>{
    const m=npbHistoricalManifestSchema.parse(v);if(m.inputSha256!==release.inputSha256)throw Error("Unadmitted Historical release");return m;
  },request));
}
export async function readNpbHistoricalSeason(season:number,manifest:NpbHistoricalManifest,request:typeof fetch=publicDataFetch) {
  const entry=manifest.seasons.find(s=>s.season===season);if(!entry) throw Error("NPB season is not admitted");
  const validate=(v:unknown)=>{
    const d=npbHistoricalDatasetSchema.parse(v);
    if(d.inputSha256!==manifest.inputSha256||d.observedAt!==manifest.observedAt||d.rows.some(r=>r.season!==season)||d.rows.length!==entry.rows||d.players.length!==entry.players||d.players.some(p=>!manifest.players.some(m=>m.playerId===p.playerId&&m.identityScope===p.identityScope&&m.birthDate===p.birthDate&&m.seasons.includes(season)))) throw Error("Historical generation or season mismatch");
    return d;
  };
  const load=async()=>read(`${season}.json`,validate,request,entry.sha256);
  // Only concurrent default reads share work. Never retain corrections or failures indefinitely.
  if(request!==publicDataFetch) return npbHistoricalDatasetSchema.parse(await load());
  const key=`${manifest.inputSha256}:${season}:${entry.sha256}`;let task=tasks.get(key);
  if(!task){task=load().finally(()=>tasks.delete(key));tasks.set(key,task);}
  return validate(await task);
}
