import { z } from "zod";
import type { DraftEvent } from "./npb-draft-event";

// Bibliographic links only: article bodies, media rankings and forecast tables are not licensed dataset inputs.
const reference = z.strictObject({
  id:z.string().regex(/^[a-z0-9-]+$/), url:z.url().refine(value=>{
    const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&["sportiva.shueisha.co.jp","thedigestweb.com","www.nikkan-gendai.com","www.nikkansports.com"].includes(u.hostname);
  }), publisher:z.string().min(1).max(60), author:z.string().min(1).max(80),
  publishedOn:z.iso.date(), updatedOn:z.iso.date(), checkedAt:z.iso.datetime(),
  kind:z.enum(["commentary","report"]), topic:z.string().min(1).max(60),
});
export const draftResearchedForecastSchema = z.strictObject({
  id:z.literal("2026-premeeting-v3"), createdAt:z.iso.datetime(), author:z.literal("Baseball Notes（独自予想）"),
  references:z.array(reference).min(1).max(24),
  clubs:z.array(z.strictObject({teamId:z.string(),context:z.string().min(1).max(240),judgment:z.string().min(1).max(280),referenceIds:z.array(z.string()).min(1).max(4)})).length(12),
  predictions:z.array(z.strictObject({teamId:z.string(),round:z.number().int().min(1).max(3),candidateId:z.string(),reason:z.string().min(1).max(240)})).length(36),
}).superRefine((f,ctx)=>{
  const fail=(message:string)=>ctx.addIssue({code:"custom",message});
  const ids=new Set(f.references.map(r=>r.id));
  if(ids.size!==f.references.length)fail("Duplicate research reference");
  for(const r of f.references)if(r.publishedOn>r.updatedOn||Date.parse(r.updatedOn+"T00:00:00+09:00")>Date.parse(r.checkedAt)||Date.parse(r.checkedAt)>Date.parse(f.createdAt))fail("Invalid research reference time");
  if(new Set(f.clubs.map(c=>c.teamId)).size!==12)fail("Research needs 12 distinct clubs");
  for(const c of f.clubs)if(new Set(c.referenceIds).size!==c.referenceIds.length||c.referenceIds.some(id=>!ids.has(id)))fail("Missing club research reference");
});

/** First bid needs explicit attempt-one lottery evidence. Final first selection is not first-bid proof. */
export function draftResearchedPredictionOutcome(data:DraftEvent,teamId:string,round:number){
  const prediction=data.researchedForecast?.predictions.find(p=>p.teamId===teamId&&p.round===round);
  if(!prediction)return "unavailable";
  if(round===1){
    const first=data.lotteries.filter(l=>l.attempt===1&&l.teamIds.includes(teamId));
    if(first.length!==1)return "unavailable";
    return compare(first[0]!.candidateId);
  }
  const earlier=data.selections.filter(s=>s.type==="regular"&&s.round<round);
  if(earlier.some(s=>s.candidateId===prediction.candidateId))return "not_applicable";
  const target=data.candidates.find(c=>c.id===prediction.candidateId);
  if(earlier.some(s=>{const c=data.candidates.find(c=>c.id===s.candidateId);return target?.article&&target.article===c?.article||target?.name===c?.name;}))return "unverified";
  const result=data.selections.find(p=>p.teamId===teamId&&p.type==="regular"&&p.round===round);
  return result?compare(result.candidateId):"unavailable";
  function compare(actualId:string){
    if(prediction!.candidateId===actualId)return "match";
    const expected=data.candidates.find(c=>c.id===prediction!.candidateId),actual=data.candidates.find(c=>c.id===actualId);
    return expected?.article&&expected.article===actual?.article||expected?.name===actual?.name?"unverified":"different";
  }
}
