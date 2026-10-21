import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, sep, join } from "node:path";
import { gzipSync } from "node:zlib";
import { draftEventSchema, draftExpandedForecastSchema, assertDraftSnapshotAdvance } from "../src/domain/npb-draft-event";
import { admittedDraftArchive, draftHash, pinnedDraftPredecessor } from "../src/infrastructure/providers/wikipedia-npb-draft";
import { draftAdditionalAmateurs, draftIndependentPitcher } from "../src/infrastructure/providers/wikipedia-npb-draft-amateurs";
import sources from "../src/data/npb-draft-2026-sources.json";
import pin from "../src/data/npb-draft-2026-release.json";
import retained from "../src/data/npb-draft-retained-releases.json";
import { assertImmutableReleaseTag } from "../src/data/immutable-release-tag";

const arg=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const archive=arg("archive"),previous=arg("previous"),forecast=arg("forecast"),output=arg("output"),tag=arg("tag");
if(!archive||!previous||!forecast||!output||!tag||!process.argv.includes("--review-confirmed"))throw Error("Requires --archive --previous --forecast --output --tag and --review-confirmed");
if(!resolve(output).startsWith(resolve(".data")+sep)||!/^npb-draft-2026-[a-z0-9-]+$/.test(tag))throw Error("Private output and new immutable tag required");
const bytes=await readFile(previous);
const old=pinnedDraftPredecessor(bytes,[...retained,pin]);
if(old.expandedForecast)throw Error("Expanded forecast is already frozen; never replace it");
const expanded=draftExpandedForecastSchema.parse(JSON.parse(await readFile(forecast,"utf8")));
const a=admittedDraftArchive(JSON.parse(await readFile(archive,"utf8")),sources);
if(Date.parse(a.observedAt)>Date.now()||Date.parse(expanded.createdAt)>Date.now()||a.pages.some(p=>Date.parse(p.source.revisionAt)>Date.parse(expanded.createdAt)))throw Error("Future archive or forecast evidence");
const national=a.pages.find(p=>p.source.pageId===5209342);if(!national)throw Error("National roster missing");
const extra=draftAdditionalAmateurs(national.content);
for(const [pageId,article] of [[3859496,"三浦遼大"],[528913,"石井康輝"],[528913,"山下健信"],[565473,"渡邉都斗"]] as const){
  const page=a.pages.find(p=>p.source.pageId===pageId);if(!page)throw Error("Independent roster missing");
  extra.push({candidate:draftIndependentPitcher(page.content,pageId,article),group:"independent"});
}
const data=draftEventSchema.parse({...old,observedAt:a.observedAt,review:{reviewedBy:"Baseball Notes（AI編集・出典照合）",reviewedAt:expanded.createdAt},sources:a.pages.map(p=>p.source),candidates:[...old.candidates,...extra.map(e=>e.candidate)],candidateGroups:[...old.candidates.map(c=>({candidateId:c.id,group:"university"})),...extra.map(e=>({candidateId:e.candidate.id,group:e.group}))],expandedForecast:expanded});
assertDraftSnapshotAdvance(old,data);
const body=Buffer.from(JSON.stringify(data)),gzip=gzipSync(body);assertImmutableReleaseTag(tag,draftHash(body),draftHash(gzip),[...retained,pin]);
await mkdir(output,{recursive:true});await writeFile(join(output,"draft-2026.json"),body);await writeFile(join(output,"draft-2026.json.gz"),gzip);
await writeFile(join(output,"pin.json"),JSON.stringify({tag,assetUrl:`https://github.com/tomoya41/baseball-notes/releases/download/${tag}/draft-2026.json.gz`,sha256:draftHash(gzip),bodySha256:draftHash(body),bytes:body.length,forecastSha256:draftHash(JSON.stringify(data.forecast))},null,2));
console.log(JSON.stringify({players:data.candidates.length,groups:Object.fromEntries(["high_school","university","corporate","independent"].map(g=>[g,data.candidateGroups!.filter(c=>c.group===g).length])),savedOriginalPredictions:12,expandedPredictions:36,selections:data.selections.length,bytes:body.length,compressedBytes:gzip.length,bodySha256:draftHash(body),canonicalWrites:0,sourceRequests:0}));
