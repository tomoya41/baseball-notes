import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve,join} from "node:path";
import {z} from "zod";
import { historicalCurrentBridges as existing } from "../src/infrastructure/providers/npb-historical-admission";
import {verifyHistoricalIdentity} from "../src/infrastructure/providers/wikipedia-npb-historical-identity";

// Explicit bounded release-time collection, never scheduled or run by build. Official APIs only.
const [titlesFile,folder]=process.argv.slice(2);
if(!titlesFile||!folder||!resolve(folder).startsWith(resolve(".data")+ (process.platform==="win32"?"\\":"/")))throw Error("Use titles.json and an ignored .data output directory");
const titles=z.array(z.string().min(1)).min(1).max(24).parse(JSON.parse(await readFile(titlesFile,"utf8")));
await mkdir(folder,{recursive:true});let requests=0;const ledger:unknown[]=[],pages:Record<string,unknown>={};
async function get(host:string,params:Record<string,string>){
  const url=new URL(`https://${host}/w/api.php`);url.search=new URLSearchParams({format:"json",maxlag:"5",...params}).toString();
  const path=join(folder,`response-${createHash("sha256").update(url.href).digest("hex")}.json`);let body:string,observedAt:string;
  try{const cached=JSON.parse(await readFile(path,"utf8")) as {body:string;observedAt:string};body=cached.body;observedAt=cached.observedAt;}catch{
    if(requests>=4)throw Error("Bounded API request budget exhausted");
    await new Promise(done=>setTimeout(done,1200));
    const response=await fetch(url,{headers:{"User-Agent":"BaseballNotes-Historical/2.0 (https://github.com/tomoya41/baseball-notes)"},signal:AbortSignal.timeout(30000)});requests++;
    if(!response.ok)throw Error(`Official Wikimedia API HTTP ${response.status}; stop rather than bypass limits`);
    body=await response.text();observedAt=new Date().toISOString();const json=JSON.parse(body) as {error?:unknown};if(json.error)throw Error(JSON.stringify(json.error));
    await writeFile(path,JSON.stringify({body,observedAt}));
  }
  ledger.push({url:url.href,observedAt,sha256:createHash("sha256").update(body).digest("hex"),bytes:Buffer.byteLength(body)});return {data:JSON.parse(body) as unknown,observedAt};
}
for(let i=0;i<titles.length;i+=12){
  const r=await get("ja.wikipedia.org",{action:"query",formatversion:"2",redirects:"1",prop:"revisions|pageprops",rvprop:"ids|timestamp|content",rvslots:"main",ppprop:"wikibase_item",titles:titles.slice(i,i+12).join("|")});
  const data=z.object({query:z.object({pages:z.array(z.object({title:z.string()}).passthrough())})}).parse(r.data);
  for(const p of data.query.pages)pages[p.title]={...p,sourceObservedAt:r.observedAt};
}
const ids=Object.values(pages).flatMap(p=>{const r=z.object({pageprops:z.object({wikibase_item:z.string().regex(/^Q\d+$/)})}).safeParse(p);return r.success?[r.data.pageprops.wikibase_item]:[];});
const wd=await get("www.wikidata.org",{action:"wbgetentities",ids:[...new Set(ids)].join("|"),props:"info|claims|sitelinks",sitefilter:"jawiki"});
const entities=z.object({entities:z.record(z.string(),z.unknown())}).parse(wd.data).entities;
const approved=[],quarantine=[];
for(const p of Object.values(pages))try{
  const raw=z.object({title:z.string(),sourceObservedAt:z.iso.datetime(),pageprops:z.object({wikibase_item:z.string()})}).parse(p);
  const result=verifyHistoricalIdentity(p,entities[raw.pageprops.wikibase_item],raw.sourceObservedAt,existing);
  approved.push({...result,bridge:result.kind==="new"?{...result.bridge,wikidataObservedAt:wd.observedAt}:result.bridge,title:raw.title});
}catch(e){quarantine.push({title:(p as {title:string}).title,reason:(e as Error).message});}
await writeFile(join(folder,"identity-evidence.json"),JSON.stringify({observedAt:wd.observedAt,requests,ledger,pages,entities,approved,quarantine},null,2));
console.log(JSON.stringify({examined:titles.length,approved:approved.length,existing:approved.filter(p=>p.kind==="existing").length,new:approved.filter(p=>p.kind==="new").length,quarantine,requests}));
