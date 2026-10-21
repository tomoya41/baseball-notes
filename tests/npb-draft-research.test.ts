import {it,expect} from "vitest";
import {draftResearchedPredictionOutcome} from "../src/domain/npb-draft-research";
import {draftEventSchema,assertDraftSnapshotAdvance} from "../src/domain/npb-draft-event";
import {draftTournamentObservation} from "../src/infrastructure/providers/wikipedia-npb-draft-amateurs";
import {researchedDraftFixture} from "./fixtures/npb-draft";
import {assertCarriedDraftEvidence,pinnedDraftPredecessor,draftHash,fetchDraftCandidateArchive} from "../src/infrastructure/providers/wikipedia-npb-draft";
import sources from "../src/data/npb-draft-2026-sources.json";

it("keeps independent club scenarios, allowing shared first bids without calling them actual lotteries",()=>{
  const d=researchedDraftFixture();d.researchedForecast!.predictions[3]!.candidateId=d.researchedForecast!.predictions[0]!.candidateId;
  expect(draftEventSchema.safeParse(d).success).toBe(true);expect(d.lotteries).toHaveLength(0);
  expect(draftResearchedPredictionOutcome(d,"npb:team:giants",1)).toBe("unavailable");
  d.selections=[{teamId:"npb:team:giants",candidateId:d.researchedForecast!.predictions[0]!.candidateId,type:"regular",round:1,status:"confirmed",sourcePageId:5209342,evidenceSha256:"e".repeat(64)}];
  // Even an identical confirmed final first pick is not independent first-bid evidence.
  expect(draftResearchedPredictionOutcome(d,"npb:team:giants",1)).toBe("unavailable");
  d.lotteries=[{attempt:2,candidateId:d.selections[0]!.candidateId,teamIds:["npb:team:giants","npb:team:tigers"],winnerId:"npb:team:giants",sourcePageId:5209342,evidenceSha256:"f".repeat(64)}];
  expect(draftResearchedPredictionOutcome(d,"npb:team:giants",1)).toBe("unavailable");
  d.lotteries[0]!.attempt=1;d.lotteries[0]!.winnerId="npb:team:tigers";expect(draftResearchedPredictionOutcome(d,"npb:team:giants",1)).toBe("match");
  d.selections[0]!.round=2;d.selections[0]!.candidateId=d.researchedForecast!.predictions[1]!.candidateId;expect(draftResearchedPredictionOutcome(d,"npb:team:giants",2)).toBe("match");
  d.selections[0]!.type="developmental";expect(draftResearchedPredictionOutcome(d,"npb:team:giants",2)).toBe("unavailable");
});
it("holds same-name identity ambiguity and never matches unrelated unlinked candidates",()=>{
  const d=researchedDraftFixture(),target=d.candidates[0]!;target.article=null;
  const other={...target,id:"npb:draft:2026:"+"d".repeat(24),name:"架空別人",affiliation:"別の架空学校"};d.candidates.push(other);
  d.lotteries=[{attempt:1,candidateId:other.id,teamIds:["npb:team:giants","npb:team:tigers"],winnerId:null,sourcePageId:5209342,evidenceSha256:"f".repeat(64)}];
  expect(draftResearchedPredictionOutcome(d,"npb:team:giants",1)).toBe("different");other.name=target.name;expect(draftResearchedPredictionOutcome(d,"npb:team:giants",1)).toBe("unverified");
});
it("freezes researched opinions and bibliography independently of prior editions and later actual source revisions",()=>{
  const old=researchedDraftFixture(),next=structuredClone(old);next.observedAt="2026-10-22T10:00:00Z";next.review!.reviewedAt="2026-10-22T10:01:00Z";next.eventState="in_progress";next.sources[0]!.revisionAt="2026-10-22T09:00:00Z";
  expect(draftEventSchema.safeParse(next).success).toBe(true);expect(()=>assertDraftSnapshotAdvance(old,next)).not.toThrow();
  next.researchedForecast!.clubs[0]!.judgment="変更";expect(()=>assertDraftSnapshotAdvance(old,next)).toThrow(/immutable/);
});
it.each(["club","pick","reference","time","protocol","postmeeting"])("rejects invalid researched %s",kind=>{
  const d=researchedDraftFixture(),f=d.researchedForecast!;
  if(kind==="club")f.clubs[0]!.teamId="npb:team:unknown";
  if(kind==="pick")f.predictions[1]!.round=1;
  if(kind==="reference")f.clubs[0]!.referenceIds=["missing"];
  if(kind==="time")f.references[0]!.checkedAt="2026-10-23T00:00:00Z";
  if(kind==="protocol")f.references[0]!.url="javascript:alert(1)";
  if(kind==="postmeeting")f.createdAt="2026-10-22T08:00:00Z";
  expect(draftEventSchema.safeParse(d).success).toBe(false);
});
it("preserves explicitly unlinked tournament observations without inventing individual pages, roles or canonical IDs",()=>{
  const row="* 第1号：架空候補（架空学校）",content="== 大会本塁打 ==\n"+row+"\n== 別章 ==\n";
  const c=draftTournamentObservation(content,5110570,row);expect(c.article).toBeNull();expect(c.position).toBe("未確認");expect(c.throws).toBe("未確認");expect(c.id).toMatch(/^npb:draft:2026:/);
  for(const [body,id] of [[content,1],[content.replace(row,"[[架空候補]]"),5110570],[content.replace(row,row+"\n"+row),5110570]] as const)expect(()=>draftTournamentObservation(body,id,row)).toThrow();
});

it("revalidates carried evidence on source revision changes, including non-university rows and multiline result evidence",()=>{
  const d=researchedDraftFixture();d.candidates=d.candidates.slice(0,1);const row="|11||[[架空選手]]||架空所属",source={...d.sources[0]!,revision:2};d.candidates[0]!.evidenceSha256=draftHash(row);
  const incoming=[{source,content:row}];expect(()=>assertCarriedDraftEvidence(d,incoming)).not.toThrow();
  for(const content of ["|11||[[訂正後]]||架空所属",row+"\n"+row])expect(()=>assertCarriedDraftEvidence(d,[{source,content}])).toThrow(/Carried Draft evidence/);
  d.candidates=d.candidates.slice(0,1);d.candidates[0]!.evidenceSha256=draftHash("!1位\n"+row);expect(()=>assertCarriedDraftEvidence(d,[{source,content:"!1位\n"+row}])).not.toThrow();
});
it("recognizes an immutable retained predecessor after the active pin changes",()=>{
  const d=researchedDraftFixture(),bytes=new TextEncoder().encode(JSON.stringify(d)),old={bodySha256:draftHash(bytes),forecastSha256:draftHash(JSON.stringify(d.forecast))},current={...old,bodySha256:"c".repeat(64)};
  expect(pinnedDraftPredecessor(bytes,[current,old])).toEqual(d);expect(()=>pinnedDraftPredecessor(bytes,[current])).toThrow(/Unpinned/);
});
it.each(["core","preview","research"] as const)("retrieves only the documented %s page set in one bounded request",async scope=>{
  let count=0;const pages=sources.filter(s=>scope==="research"||scope==="preview"&&s.pageId!==5110570||[5282993,5209342].includes(s.pageId));
  const request:typeof fetch=async input=>{count++;const url=new URL(String(input));expect(new Set(url.searchParams.get("pageids")!.split("|").map(Number))).toEqual(new Set(pages.map(s=>s.pageId)));return new Response(JSON.stringify({query:{pages:pages.map(s=>({pageid:s.pageId,title:s.title,revisions:[{revid:s.revision,timestamp:s.revisionAt,slots:{main:{content:"架空内容"}}}]}))}}));};
  const archive=await fetchDraftCandidateArchive(request,scope);expect(archive.response.query.pages).toHaveLength(pages.length);expect(count).toBe(1);
});
