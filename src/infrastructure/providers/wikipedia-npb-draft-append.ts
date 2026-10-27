import { z } from "zod";
import { assertDraftSnapshotAdvance,draftEventSchema,draftSourceSchema,type DraftEvent } from "../../domain/npb-draft-event";
import { admittedDraftArchive,draftHash } from "./wikipedia-npb-draft";
import { auditDraft2026ResultTables,draftResultRowId } from "./wikipedia-npb-draft-results";

const digest=z.string().regex(/^[a-f0-9]{64}$/);
export const draftAppendReviewSchema=z.strictObject({
  format:z.literal("2026_result_additions"),previousBodySha256:digest,archiveSha256:digest,
  reviewedBy:z.string().min(1).max(80),reviewedAt:z.iso.datetime(),
  source:draftSourceSchema.extend({pageId:z.literal(5282993)}),
  selections:z.array(z.strictObject({teamId:z.string(),type:z.enum(["regular","developmental"]),round:z.number().int().positive(),
    name:z.string(),article:z.string().nullable(),affiliation:z.string(),position:z.enum(["投手","捕手","内野手","外野手"]),evidenceSha256:digest,
    existingCandidateId:z.string().regex(/^npb:draft:2026:[a-f0-9]{24}$/).optional()})).min(1).max(2),
});

/** Explicit bounded append. Normal carried-evidence/correction guards remain unchanged. */
export function appendReviewedDraftResults(previous:DraftEvent,rawArchive:unknown,rawReview:unknown,now=Date.now()) {
  const old=draftEventSchema.parse(previous),review=draftAppendReviewSchema.parse(rawReview);
  if(draftHash(JSON.stringify(previous))!==review.previousBodySha256)throw Error("Reviewed predecessor value hash mismatch");
  const original=old.sources.find(s=>s.pageId===5282993);
  if(!original||original.title!==review.source.title||review.source.revision<=Math.max(original.revision,...(old.additionalSources??[]).filter(s=>s.pageId===5282993).map(s=>s.revision)))throw Error("Supplemental Draft source must advance the same admitted article");
  const archive=admittedDraftArchive(rawArchive,[...old.sources,review.source]);
  if(archive.pages.length!==2||new Set(archive.pages.map(p=>p.source.pageId)).size!==2||archive.pages.some(p=>![5209342,5282993].includes(p.source.pageId)))throw Error("Unexpected append source scope");
  if(Date.parse(archive.observedAt)>Date.parse(review.reviewedAt)||Date.parse(review.reviewedAt)>now||Date.parse(archive.observedAt)<Date.parse(old.observedAt)||Date.parse(review.reviewedAt)<Date.parse(old.review?.reviewedAt??old.observedAt))throw Error("Invalid append observation/review time");
  if(Date.parse(archive.observedAt)<Date.parse(old.scheduledAt)||old.eventState!=="ended"||old.coverage!=="partial")throw Error("Append requires a reviewed postmeeting predecessor");
  const source=archive.pages.find(p=>p.source.pageId===5282993)!;
  if(JSON.stringify(source.source)!==JSON.stringify(review.source))throw Error("Reviewed append source mismatch");
  if(/\{\{\s*(?:著作権侵害|copyvio|copyright\s+violation|転載疑惑|転載疑い|コピペ|削除依頼|即時削除)/i.test(source.content))throw Error("Unresolved source rights warning");
  const audit=auditDraft2026ResultTables(source.content),next=structuredClone(old);
  next.additionalSources=[...old.additionalSources??[],review.source];
  next.observedAt=archive.observedAt;next.review={reviewedBy:review.reviewedBy,reviewedAt:review.reviewedAt};
  const keys=new Set<string>();
  for(const entry of review.selections){
    const key=`${entry.teamId}:${entry.type}:${entry.round}`;
    if(keys.has(key)||old.selections.some(s=>`${s.teamId}:${s.type}:${s.round}`===key))throw Error("Existing or duplicate Draft slot cannot be appended/corrected");
    keys.add(key);
    const matches=audit.rows.filter(r=>r.teamId===entry.teamId&&r.type===entry.type&&r.round===entry.round&&r.name===entry.name&&r.article===entry.article&&r.affiliation===entry.affiliation&&r.position===entry.position&&r.evidenceSha256===entry.evidenceSha256);
    if(matches.length!==1)throw Error("Append row must have exact independently reviewed team/matrix evidence");
    const r=matches[0]!;
    // Linked IDs also contain affiliation text. A changed school spelling must
    // not create a second selection for an already-selected article identity.
    if(r.article&&next.selections.some(s=>next.candidates.find(c=>c.id===s.candidateId)?.article===r.article))throw Error("Selected article identity requires separate correction review");
    const id=draftResultRowId(r),existing=old.candidates.find(c=>c.id===id);
    if(existing){
      if(entry.existingCandidateId!==id||existing.name!==r.name||existing.article!==r.article||existing.affiliation!==r.affiliation||existing.position!==r.position)throw Error("Append cannot replace or merge an existing candidate identity without exact reviewed evidence");
      if(old.selections.some(s=>s.candidateId===id))throw Error("Existing candidate was already selected");
    }else{
      if(entry.existingCandidateId||next.candidates.some(c=>c.id===id))throw Error("Invalid reviewed candidate reuse");
      next.candidates.push({id,name:r.name,article:r.article,affiliation:r.affiliation,position:r.position,throws:"未確認",bats:"未確認",eligibility:"unverified",context:"記事の指名結果・当時の所属。入団・現在所属の認定ではありません",sourcePageId:5282993,sourceRevision:review.source.revision,evidenceSha256:r.evidenceSha256});
    }
    next.selections.push({teamId:r.teamId,type:r.type,round:r.round,candidateId:id,status:"confirmed",sourcePageId:5282993,sourceRevision:review.source.revision,evidenceSha256:r.evidenceSha256});
  }
  const data=draftEventSchema.parse(next);assertDraftSnapshotAdvance(old,data);
  if(JSON.stringify(old.sources)!==JSON.stringify(data.sources)||JSON.stringify(old.lotteries)!==JSON.stringify(data.lotteries))throw Error("Append changed frozen source/lottery context");
  return {data,audit,sourceHash:draftHash(source.content)};
}
