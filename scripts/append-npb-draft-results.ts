import { readFile,writeFile,mkdir } from "node:fs/promises";
import { resolve,sep,join } from "node:path";
import { gzipSync } from "node:zlib";
import { draftEventSchema } from "../src/domain/npb-draft-event";
import { draftHash } from "../src/infrastructure/providers/wikipedia-npb-draft";
import { appendReviewedDraftResults,draftAppendReviewSchema } from "../src/infrastructure/providers/wikipedia-npb-draft-append";
import { draftUpdateReport } from "../src/application/npb-draft-update-report";
import pin from "../src/data/npb-draft-2026-release.json";
import retained from "../src/data/npb-draft-retained-releases.json";
import { assertImmutableReleaseTag,assertReleasePredecessor } from "../src/data/immutable-release-tag";

const option=(name:string)=>process.argv.find(s=>s.startsWith(`--${name}=`))?.slice(name.length+3);
const archivePath=option("archive"),previousPath=option("previous"),reviewPath=option("review"),output=option("output"),tag=option("tag");
if(!archivePath||!previousPath||!reviewPath||!output||!process.argv.includes("--review-confirmed"))throw Error("Explicit private archive/review, pinned predecessor, output and --review-confirmed required");
if(![archivePath,previousPath,reviewPath,output].every(p=>resolve(p).startsWith(resolve(".data")+sep)))throw Error("Append inputs and outputs must remain private .data paths");
const previousBytes=await readFile(previousPath),archiveBytes=await readFile(archivePath),review=draftAppendReviewSchema.parse(JSON.parse(await readFile(reviewPath,"utf8")));
if(draftHash(previousBytes)!==pin.bodySha256||review.previousBodySha256!==pin.bodySha256)throw Error("Unpinned append predecessor");
if(archiveBytes.length>500000||draftHash(archiveBytes)!==review.archiveSha256)throw Error("Unreviewed append archive bytes");
const old=draftEventSchema.parse(JSON.parse(previousBytes.toString()));
if(draftHash(JSON.stringify(old.forecast))!==pin.forecastSha256)throw Error("Pinned forecast mismatch");
const {data,audit}=appendReviewedDraftResults(old,JSON.parse(archiveBytes.toString()),review);
const body=Buffer.from(JSON.stringify(data)),gzip=gzipSync(body);
if(tag&&!/^npb-draft-2026-[a-z0-9-]+$/.test(tag))throw Error("New immutable release tag required");
if(tag)assertImmutableReleaseTag(tag,draftHash(body),draftHash(gzip),[...retained,pin]);
assertReleasePredecessor(tag,draftHash(body),pin.bodySha256,true);
const report={...draftUpdateReport(old,data),previousBodySha256:pin.bodySha256,archiveSha256:review.archiveSha256,
  additionalSources:data.additionalSources,oldSourcesUnchanged:JSON.stringify(old.sources)===JSON.stringify(data.sources),oldCandidatesUnchanged:old.candidates.every((c,i)=>JSON.stringify(c)===JSON.stringify(data.candidates[i])),
  oldSelectionsUnchanged:old.selections.every((s,i)=>JSON.stringify(s)===JSON.stringify(data.selections[i])),oldLotteriesUnchanged:JSON.stringify(old.lotteries)===JSON.stringify(data.lotteries),
  total:data.selections.length,regular:data.selections.filter(s=>s.type==="regular").length,developmental:data.selections.filter(s=>s.type==="developmental").length,
  sourceAuditRows:audit.rows.length,sourceQuarantine:audit.quarantine,
  unadmittedNewSourceSlots:audit.rows.filter(r=>!data.selections.some(s=>s.teamId===r.teamId&&s.type===r.type&&s.round===r.round)).map(r=>({teamId:r.teamId,type:r.type,round:r.round,evidenceSha256:r.evidenceSha256,status:"not_reviewed_for_admission"})),
  interpretation:"A supported raw table shape is not identity/affiliation admission. Old observations retain old sources; unreviewed corrections and other source rows are held.",
  bytes:body.length,compressedBytes:gzip.length,bodySha256:draftHash(body),sha256:draftHash(gzip)};
await mkdir(output,{recursive:true});await writeFile(join(output,"draft-2026.json"),body);await writeFile(join(output,"draft-2026.json.gz"),gzip);await writeFile(join(output,"review-report.json"),JSON.stringify(report,null,2));
if(tag)await writeFile(join(output,"pin.json"),JSON.stringify({tag,assetUrl:`https://github.com/tomoya41/baseball-notes/releases/download/${tag}/draft-2026.json.gz`,sha256:draftHash(gzip),bodySha256:draftHash(body),bytes:body.length,forecastSha256:pin.forecastSha256},null,2));
console.log(JSON.stringify({total:report.total,regular:report.regular,developmental:report.developmental,added:report.addedSelections.length,oldSourcesUnchanged:report.oldSourcesUnchanged,oldCandidatesUnchanged:report.oldCandidatesUnchanged,oldSelectionsUnchanged:report.oldSelectionsUnchanged,oldLotteriesUnchanged:report.oldLotteriesUnchanged,sourceAuditRows:report.sourceAuditRows,held:report.sourceQuarantine.length,bodySha256:report.bodySha256,sha256:report.sha256,bytes:report.bytes,compressedBytes:report.compressedBytes,sourceRequests:0,canonicalWrites:0}));
