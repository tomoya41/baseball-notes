import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve,dirname,sep} from "node:path";
import {createHash} from "node:crypto";
import {fetchJapanSeriesCandidate} from "../src/infrastructure/providers/wikipedia-npb-japan-series";
const argument=process.argv.find(a=>a.startsWith("--output="))?.slice(9);
if(!argument)throw Error("Required: --output=.data/japan-series/new-archive.json [--refresh]");
const path=resolve(argument),hash=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
if(!path.startsWith(resolve(".data")+sep)||!path.endsWith(".json"))throw Error("Raw candidates must remain private JSON");
const cached=await readFile(path).catch(()=>null);
if(cached&&!process.argv.includes("--refresh"))console.log(JSON.stringify({status:"CACHED",requests:0,sha256:hash(cached),admitted:false,canonicalWrites:0}));
else{const a=await fetchJapanSeriesCandidate();await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(a));console.log(JSON.stringify({status:"CANDIDATE_ONLY",requests:1,observedAt:a.observedAt,sources:a.response.query.pages.map(p=>({pageId:p.pageid,revision:p.revisions[0]!.revid,contentSha256:hash(Buffer.from(p.revisions[0]!.slots.main.content))})),admitted:false,canonicalWrites:0}));}
