import { z } from "zod";
import { draftResearchedForecastSchema } from "./npb-draft-research";

export const draftTeams = ["giants","tigers","dragons","carp","swallows","baystars","hawks","fighters","lions","marines","eagles","buffaloes"].map(t=>`npb:team:${t}`);
const team = z.string().refine(id=>draftTeams.includes(id),"Unknown NPB team");
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const draftSourceSchema = z.strictObject({provider:z.literal("Wikipedia"),pageId:z.number().int().positive(),title:z.string().min(1).max(120),revision:z.number().int().positive(),revisionAt:z.iso.datetime(),contentSha256:digest,license:z.literal("CC-BY-SA-4.0")});
const evidenceRevision = z.number().int().positive().optional();
const candidate = z.strictObject({id:z.string().regex(/^npb:draft:2026:[a-f0-9]{24}$/),name:z.string().min(1).max(80),article:z.string().min(1).max(120).nullable(),affiliation:z.string().min(1).max(120),position:z.enum(["投手","捕手","内野手","外野手","未確認"]),throws:z.enum(["右","左","両","未確認"]),bats:z.enum(["右","左","両","未確認"]),context:z.string().min(1).max(160),eligibility:z.literal("unverified"),sourcePageId:z.number().int().positive(),sourceRevision:evidenceRevision,evidenceSha256:digest});
const prediction = z.strictObject({teamId:team,candidateId:z.string(),reason:z.string().min(1).max(240)});
export const draftCandidateGroups = ["high_school","university","corporate","independent"] as const;
export const draftExpandedForecastSchema = z.strictObject({id:z.literal("2026-premeeting-v2"),createdAt:z.iso.datetime(),author:z.literal("Baseball Notes（独自仮説）"),predictions:z.array(prediction.extend({round:z.number().int().min(1).max(3)})).length(36)});
const candidateGroups = z.array(z.strictObject({candidateId:z.string(),group:z.enum(draftCandidateGroups)})).max(250);
const selection = z.strictObject({teamId:team,candidateId:z.string(),type:z.enum(["regular","developmental"]),round:z.number().int().min(1).max(30),status:z.literal("confirmed"),sourcePageId:z.number().int().positive(),sourceRevision:evidenceRevision,evidenceSha256:digest});
const lottery = z.strictObject({attempt:z.number().int().min(1).max(12),candidateId:z.string(),teamIds:z.array(team).min(2).max(12),winnerId:team.nullable(),sourcePageId:z.number().int().positive(),sourceRevision:evidenceRevision,evidenceSha256:digest});
export const draftEventSchema = z.strictObject({schemaVersion:z.literal(1),league:z.literal("NPB"),season:z.literal(2026),scheduledAt:z.literal("2026-10-22T16:50:00+09:00"),observedAt:z.iso.datetime(),review:z.strictObject({reviewedBy:z.string().min(1).max(80),reviewedAt:z.iso.datetime()}).optional(),eventState:z.enum(["scheduled","checking","in_progress","ended"]),coverage:z.enum(["unavailable","partial"]),license:z.literal("CC-BY-SA-4.0"),sources:z.array(draftSourceSchema).min(1).max(6),additionalSources:z.array(draftSourceSchema).min(1).max(4).optional(),candidates:z.array(candidate).max(250),forecast:z.strictObject({id:z.literal("2026-premeeting-v1"),createdAt:z.iso.datetime(),author:z.literal("Baseball Notes（独自仮説）"),predictions:z.array(prediction).length(12)}),expandedForecast:draftExpandedForecastSchema.optional(),researchedForecast:draftResearchedForecastSchema.optional(),candidateGroups:candidateGroups.optional(),selections:z.array(selection).max(240),lotteries:z.array(lottery).max(30)}).superRefine((d,ctx)=>{
  const fail=(message:string)=>ctx.addIssue({code:"custom",message});
  const ids=new Set(d.candidates.map(c=>c.id)),pages=new Set(d.sources.map(s=>s.pageId));
  if(ids.size!==d.candidates.length||pages.size!==d.sources.length)fail("Duplicate identity/source");
  if(new Set(d.forecast.predictions.map(p=>p.teamId)).size!==12)fail("Forecast must cover all 12 teams");
  if(Date.parse(d.forecast.createdAt)>=Date.parse(d.scheduledAt)||Date.parse(d.forecast.createdAt)>Date.parse(d.observedAt))fail("Forecast must be saved before meeting and observation");
  const allSources=[...d.sources,...d.additionalSources??[]];
  if(new Set(allSources.map(s=>`${s.pageId}:${s.revision}`)).size!==allSources.length)fail("Duplicate source revision");
  for(const source of allSources)if(Date.parse(source.revisionAt)>Date.parse(d.observedAt))fail("Future revision");
  for(const source of d.additionalSources??[]){
    const original=d.sources.find(s=>s.pageId===source.pageId);
    if(!original||source.title!==original.title||source.revision<=original.revision||Date.parse(source.revisionAt)<Date.parse(original.revisionAt))fail("Invalid supplemental source continuity");
    if(![...d.candidates,...d.selections,...d.lotteries].some(row=>row.sourcePageId===source.pageId&&row.sourceRevision===source.revision))fail("Unused supplemental source");
  }
  const hasSource=(row:{sourcePageId:number;sourceRevision?:number|undefined})=>row.sourceRevision===undefined?pages.has(row.sourcePageId):allSources.some(s=>s.pageId===row.sourcePageId&&s.revision===row.sourceRevision);
  for(const c of d.candidates)if(!hasSource(c))fail("Candidate source missing");
  for(const p of d.forecast.predictions)if(!ids.has(p.candidateId))fail("Forecast identity missing");
  if(d.expandedForecast){
    const f=d.expandedForecast;
    if(!d.review||Date.parse(f.createdAt)>=Date.parse(d.scheduledAt)||Date.parse(f.createdAt)>Date.parse(d.review.reviewedAt))fail("Expanded forecast must be reviewed and saved before meeting");
    const keys=new Set<string>(),picks=new Set<string>();
    for(const p of f.predictions){const key=p.teamId+":"+p.round;if(keys.has(key)||picks.has(p.candidateId)||!ids.has(p.candidateId))fail("Expanded forecast duplicate or missing identity");keys.add(key);picks.add(p.candidateId);}
    if(draftTeams.some(t=>[1,2,3].some(r=>!keys.has(t+":"+r))))fail("Expanded forecast needs three rounds per team");
    if(!d.candidateGroups)fail("Expanded forecast groups missing");
    if(f.predictions.some(p=>!d.candidateGroups?.some(g=>g.candidateId===p.candidateId)))fail("Expanded prediction group missing");
  }
  if(d.researchedForecast){
    const f=d.researchedForecast,keys=new Set<string>();
    if(!d.review||Date.parse(f.createdAt)>=Date.parse(d.scheduledAt)||Date.parse(f.createdAt)>Date.parse(d.review.reviewedAt))fail("Research must be reviewed and saved before meeting");
    if(f.clubs.some(c=>!draftTeams.includes(c.teamId)))fail("Unknown research club");
    for(const p of f.predictions){const key=p.teamId+":"+p.round;if(keys.has(key)||!draftTeams.includes(p.teamId)||!ids.has(p.candidateId)||!d.candidateGroups?.some(g=>g.candidateId===p.candidateId))fail("Research pick duplicate or missing identity/group");keys.add(key);}
    for(const t of draftTeams){const picks=f.predictions.filter(p=>p.teamId===t);if([1,2,3].some(r=>!keys.has(t+":"+r))||new Set(picks.map(p=>p.candidateId)).size!==3)fail("Research needs three distinct targets per club");}
  }
  if(d.candidateGroups&&(new Set(d.candidateGroups.map(c=>c.candidateId)).size!==d.candidateGroups.length||d.candidateGroups.some(c=>!ids.has(c.candidateId))))fail("Candidate group identity mismatch");
  const keys=new Set<string>(),selected=new Set<string>();
  for(const s of d.selections){const k=`${s.teamId}:${s.type}:${s.round}`;if(keys.has(k)||selected.has(s.candidateId)||!ids.has(s.candidateId)||!hasSource(s))fail("Selection duplicate or missing identity/source");keys.add(k);selected.add(s.candidateId);}
  const lots=new Set<string>();
  for(const l of d.lotteries){const k=`${l.attempt}:${l.candidateId}`;if(lots.has(k)||!ids.has(l.candidateId)||!hasSource(l)||new Set(l.teamIds).size!==l.teamIds.length||l.winnerId!==null&&!l.teamIds.includes(l.winnerId))fail("Invalid lottery");lots.add(k);}
  if(d.eventState==="scheduled"&&(d.selections.length||d.lotteries.length))fail("No premeeting results");
  if(Date.parse(d.observedAt)<Date.parse(d.scheduledAt)&&d.eventState!=="scheduled")fail("Future meeting results");
  if(d.coverage==="unavailable"&&(d.selections.length||d.lotteries.length))fail("Unavailable results must be empty");
  if((d.selections.length||d.lotteries.length||d.eventState==="in_progress"||d.eventState==="ended")&&!d.review)fail("Results need public review metadata");
  if(d.review&&Date.parse(d.review.reviewedAt)<Date.parse(d.observedAt))fail("Review precedes acquisition");
});
export type DraftEvent = z.infer<typeof draftEventSchema>;
/** A legacy row always resolves to its original source; latest supplemental revisions never shadow it. */
export function draftEvidenceSource(data:Pick<DraftEvent,"sources"|"additionalSources">,row:{sourcePageId:number;sourceRevision?:number|undefined}){
  return row.sourceRevision===undefined?data.sources.find(s=>s.pageId===row.sourcePageId)
    :[...data.sources,...data.additionalSources??[]].find(s=>s.pageId===row.sourcePageId&&s.revision===row.sourceRevision);
}
export function draftAllSources(data:Pick<DraftEvent,"sources"|"additionalSources">){return [...data.sources,...data.additionalSources??[]];}
/** Normal updates append evidence. Corrections/deletions require a separate reviewed migration. */
export function assertDraftSnapshotAdvance(previous:DraftEvent,next:DraftEvent){
  const rank={scheduled:0,checking:1,in_progress:2,ended:3};
  if(Date.parse(next.observedAt)<Date.parse(previous.observedAt)||rank[next.eventState]<rank[previous.eventState]||previous.coverage==="partial"&&next.coverage!=="partial")throw Error("Draft snapshot state/time regression");
  if(previous.review&&(!next.review||Date.parse(next.review.reviewedAt)<Date.parse(previous.review.reviewedAt)))throw Error("Draft review timestamp regression");
  if(JSON.stringify(previous.forecast)!==JSON.stringify(next.forecast))throw Error("Premeeting forecast must remain immutable");
  if(previous.researchedForecast&&JSON.stringify(previous.researchedForecast)!==JSON.stringify(next.researchedForecast))throw Error("Researched premeeting forecast must remain immutable");
  if(previous.expandedForecast&&JSON.stringify(previous.expandedForecast)!==JSON.stringify(next.expandedForecast))throw Error("Expanded premeeting forecast must remain immutable");
  for(const group of previous.candidateGroups??[])if(!next.candidateGroups?.some(g=>g.candidateId===group.candidateId&&g.group===group.group))throw Error("Candidate group correction requires separate review");
  for(const candidate of previous.candidates){const current=next.candidates.find(c=>c.id===candidate.id);if(!current||JSON.stringify(current)!==JSON.stringify(candidate))throw Error("Candidate correction requires separate review");}
  if(previous.additionalSources||next.additionalSources){
    if(JSON.stringify(previous.sources)!==JSON.stringify(next.sources))throw Error("Original Draft source must remain immutable when supplemental revisions are used");
    for(const source of previous.additionalSources??[])if(!next.additionalSources?.some(s=>JSON.stringify(s)===JSON.stringify(source)))throw Error("Supplemental Draft source correction/deletion requires separate review");
    for(const kind of ["candidates","selections"] as const){
      const oldRows=new Set(previous[kind].map(row=>JSON.stringify(row)));
      if(next[kind].some(row=>!oldRows.has(JSON.stringify(row))&&row.sourceRevision===undefined))throw Error("New Draft evidence must explicitly identify its source revision");
    }
    if(next.lotteries.some(row=>!previous.lotteries.some(old=>old.attempt===row.attempt&&old.candidateId===row.candidateId)&&row.sourceRevision===undefined))throw Error("New Draft evidence must explicitly identify its source revision");
  }
  const keys=new Set(next.selections.map(s=>JSON.stringify(s)));
  if(previous.selections.some(s=>!keys.has(JSON.stringify(s))))throw Error("Selection correction/deletion requires separate review");
  for(const old of previous.lotteries){
    const current=next.lotteries.find(l=>l.attempt===old.attempt&&l.candidateId===old.candidateId);
    if(!current||current.sourcePageId!==old.sourcePageId||current.sourceRevision!==old.sourceRevision||current.evidenceSha256!==old.evidenceSha256||JSON.stringify([...current.teamIds].sort())!==JSON.stringify([...old.teamIds].sort())||old.winnerId!==null&&current.winnerId!==old.winnerId)throw Error("Lottery correction/deletion requires separate review");
  }
}
/** First actual selection, distinct from first-bid lottery. Missing results never mean a miss. */
export function draftPredictionOutcome(data:DraftEvent,teamId:string){
  const prediction=data.forecast.predictions.find(p=>p.teamId===teamId);
  const result=data.selections.find(p=>p.teamId===teamId&&p.type==="regular"&&p.round===1);
  if(!prediction||!result)return "unavailable";
  if(prediction.candidateId===result.candidateId)return "match";
  const expected=data.candidates.find(c=>c.id===prediction.candidateId),actual=data.candidates.find(c=>c.id===result.candidateId);
  // Same article/name with differing school labels is not proof of a different person or of a match.
  if(expected?.article&&expected.article===actual?.article||expected?.name===actual?.name)return "unverified";
  return "different";
}

export function draftPredictionComparison(data:DraftEvent,teamId:string){
  const prediction=data.forecast.predictions.find(p=>p.teamId===teamId),selection=data.selections.find(s=>s.teamId===teamId&&s.type==="regular"&&s.round===1);
  return {teamId,outcome:draftPredictionOutcome(data,teamId),expected:data.candidates.find(c=>c.id===prediction?.candidateId),actual:data.candidates.find(c=>c.id===selection?.candidateId)};
}

/** Compare the frozen three-round scenario with confirmed regular picks, never developmental picks or lottery bids. */
export function draftExpandedPredictionOutcome(data:DraftEvent,teamId:string,round:number){
  const prediction=data.expandedForecast?.predictions.find(p=>p.teamId===teamId&&p.round===round);
  const result=data.selections.find(p=>p.teamId===teamId&&p.type==="regular"&&p.round===round);
  if(!prediction||!result)return "unavailable";
  if(prediction.candidateId===result.candidateId)return "match";
  const expected=data.candidates.find(c=>c.id===prediction.candidateId),actual=data.candidates.find(c=>c.id===result.candidateId);
  return expected?.article&&expected.article===actual?.article||expected?.name===actual?.name?"unverified":"different";
}
