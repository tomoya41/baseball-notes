import { mkdir,readFile,writeFile } from "node:fs/promises";
import { resolve,dirname,sep } from "node:path";
import { fetchDraftCandidateArchive,draftHash } from "../src/infrastructure/providers/wikipedia-npb-draft";
const argument=process.argv.find(a=>a.startsWith("--output="))?.slice(9);
if(!argument)throw Error("Required: --output=.data/draft-2026/new-archive.json [--refresh]");
const file=resolve(argument),privateRoot=resolve(".data")+sep;
if(!file.startsWith(privateRoot)||!file.endsWith(".json"))throw Error("Raw candidates must stay in private .data JSON");
const cached=await readFile(file).catch(()=>null);
if(cached&&!process.argv.includes("--refresh")){console.log(JSON.stringify({status:"CACHED",requests:0,sha256:draftHash(cached),admitted:false,canonicalWrites:0}));}
else{
  const archive=await fetchDraftCandidateArchive();await mkdir(dirname(file),{recursive:true});await writeFile(file,JSON.stringify(archive));
  console.log(JSON.stringify({status:"CANDIDATE_ONLY",requests:1,observedAt:archive.observedAt,sources:archive.response.query.pages.map(p=>({pageId:p.pageid,revision:p.revisions[0]!.revid,contentSha256:draftHash(p.revisions[0]!.slots.main.content)})),admitted:false,canonicalWrites:0}));
}
