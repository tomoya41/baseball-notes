import {z} from "zod";
import {publicAssetBase} from "../app/platform";
import {publicDataFetch,rememberPublicResponse} from "../infrastructure/public-response-cache";
import {contextManifestSchema,honorsPageSchema,contextPath,type ContextManifest} from "../domain/player-honors";
import {inningScorePageSchema} from "../domain/inning-score";
import {honorCatalogSchema,honorRecipientBucket,isHonorRecipientId,type HonorLeague} from "../domain/honor-discovery";
import pin from "../data/baseball-context-release.json";
const digest=async(b:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",b as BufferSource))].map(v=>v.toString(16).padStart(2,"0")).join("");
export function createContextReader(request:typeof fetch=publicDataFetch,base=publicAssetBase(),release=pin){
 const pending=new Map<string,Promise<unknown>>();
 async function file<T>(path:string,schema:z.ZodType<T>,expected:{sha256:string;bytes:number}):Promise<T>{
  if(path!=="manifest.json"&&!contextPath.test(path))throw Error("Invalid context path");
  let task=pending.get(path);if(!task){task=(async()=>{const r=await request(`${base}data/baseball-context/${release.sha256}/${path}`);if(!r.ok)throw Error(`Context HTTP ${r.status}`);const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length!==expected.bytes||bytes.length>1_000_000||await digest(bytes)!==expected.sha256)throw Error("Context hash/size mismatch");const value=schema.parse(JSON.parse(new TextDecoder().decode(bytes)));await rememberPublicResponse(r);return value;})().catch(e=>{pending.delete(path);throw e;});pending.set(path,task);if(pending.size>64)pending.delete(pending.keys().next().value!);}return task as Promise<T>;
 }
 const manifest=()=>file("manifest.json",contextManifestSchema,{sha256:release.manifestSha256,bytes:release.manifestBytes});
 async function page<T>(path:string,schema:z.ZodType<T>){const m=await manifest(),f=m.files[path];return f?file(path,schema,f):null;}
 return{manifest,honors:(path:string)=>page(path,honorsPageSchema),catalog:(league:HonorLeague)=>page(`honors/catalog/${league}.json`,honorCatalogSchema),recipient:(league:HonorLeague,id:string)=>isHonorRecipientId(league,id)?page(`honors/recipients/${league}/${honorRecipientBucket(id)}.json`,honorsPageSchema):Promise.resolve(null),scoreboards:(league:"NPB"|"MLB",date:string,competition:"regular"|"postseason")=>page(`scoreboards/${league}/${date.slice(0,7)}-${competition}.json`,inningScorePageSchema)};
}
export const contextReader=createContextReader();
export type {ContextManifest};
