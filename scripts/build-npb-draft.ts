import { readFile,writeFile,mkdir } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import {resolve,sep} from "node:path";
import { draftEventSchema,assertDraftSnapshotAdvance } from "../src/domain/npb-draft-event";
import { admittedDraftArchive,applyReviewedDraftResults,draftHash,draftRosterCandidates,assertCarriedDraftEvidence } from "../src/infrastructure/providers/wikipedia-npb-draft";
import sources from "../src/data/npb-draft-2026-sources.json";
import forecast from "../src/data/npb-draft-2026-forecast.json";
import pin from "../src/data/npb-draft-2026-release.json";
import retained from "../src/data/npb-draft-retained-releases.json";
import {assertImmutableReleaseTag,assertReleasePredecessor} from "../src/data/immutable-release-tag";
import {draftUpdateReport} from "../src/application/npb-draft-update-report";

const arg=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const archive=arg("archive"),output=arg("output"),review=arg("review"),previous=arg("previous");
if(!archive||!output)throw Error("Required: --archive=private.json --output=.data/private-output [--review=private-reviewed.json --previous=published.json --review-confirmed]");
if(!resolve(output).startsWith(resolve(".data")+sep))throw Error("Draft output must remain private");
if(draftHash(JSON.stringify(forecast))!==pin.forecastSha256)throw Error("Saved forecast hash changed");
const a=admittedDraftArchive(JSON.parse(await readFile(archive,"utf8")),sources as Parameters<typeof admittedDraftArchive>[1]);
if(Date.parse(a.observedAt)>Date.now())throw Error("Cannot publish a future observation");
const roster=a.pages.find(p=>p.source.pageId===5209342),event=a.pages.find(p=>p.source.pageId===5282993);
if(!roster||!event||!event.content.includes("開催日 = 2026年10月22日"))throw Error("Missing draft/roster source");
let data=draftEventSchema.parse({schemaVersion:1,league:"NPB",season:2026,scheduledAt:"2026-10-22T16:50:00+09:00",observedAt:a.observedAt,eventState:Date.parse(a.observedAt)<Date.parse("2026-10-22T16:50:00+09:00")?"scheduled":"checking",coverage:"unavailable",license:"CC-BY-SA-4.0",sources:a.pages.map(p=>p.source),candidates:draftRosterCandidates(roster.content),forecast,selections:[],lotteries:[]});
let old:ReturnType<typeof draftEventSchema.parse>|undefined;
if(previous){const bytes=await readFile(previous);if(draftHash(bytes)!==pin.bodySha256)throw Error("Unpinned previous Draft snapshot");old=draftEventSchema.parse(JSON.parse(bytes.toString()));
  if(old.expandedForecast){
    assertCarriedDraftEvidence(old,a.pages);
    for(const c of data.candidates){const prior=old.candidates.find(p=>p.id===c.id);if(prior&&JSON.stringify(prior)!==JSON.stringify(c))throw Error("Candidate correction requires separate review");}
    data={...data,candidates:[...old.candidates,...data.candidates.filter(c=>!old!.candidates.some(p=>p.id===c.id))],sources:[...data.sources,...old.sources.filter(s=>!data.sources.some(p=>p.pageId===s.pageId))],expandedForecast:old.expandedForecast,researchedForecast:old.researchedForecast,candidateGroups:old.candidateGroups,review:old.review};
  }
}
if(review){if(!previous||!process.argv.includes("--review-confirmed"))throw Error("Reviewed update needs prior immutable dataset and explicit review confirmation");data=applyReviewedDraftResults(data,event.content,JSON.parse(await readFile(review,"utf8")),a.observedAt);}
let report:ReturnType<typeof draftUpdateReport>|undefined;
data=draftEventSchema.parse(data);
if(old){assertDraftSnapshotAdvance(old,data);report=draftUpdateReport(old,data);}
const body=JSON.stringify(data),bytes=Buffer.from(body),gzip=gzipSync(bytes);
const tag=arg("tag");if(tag&&!/^npb-draft-2026-[a-z0-9-]+$/.test(tag))throw Error("New immutable release tag required");
if(tag)assertImmutableReleaseTag(tag,draftHash(body),draftHash(gzip),[...retained,pin]);
assertReleasePredecessor(tag,draftHash(body),pin.bodySha256,!!previous);
await mkdir(output,{recursive:true});await writeFile(join(output,"draft-2026.json"),bytes);await writeFile(join(output,"draft-2026.json.gz"),gzip);
if(report)await writeFile(join(output,"review-report.json"),JSON.stringify(report,null,2));
if(tag)await writeFile(join(output,"pin.json"),JSON.stringify({tag,assetUrl:`https://github.com/tomoya41/baseball-notes/releases/download/${tag}/draft-2026.json.gz`,sha256:draftHash(gzip),bodySha256:draftHash(body),bytes:bytes.length,forecastSha256:draftHash(JSON.stringify(data.forecast))},null,2));
console.log(JSON.stringify({players:data.candidates.length,predictions:data.forecast.predictions.length,selections:data.selections.length,lotteries:data.lotteries.length,bytes:bytes.length,compressedBytes:gzip.length,bodySha256:draftHash(body),canonicalWrites:0,sourceRequests:0}));
