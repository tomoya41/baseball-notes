import { draftEventSchema,draftTeams,draftCandidateGroups } from "../../src/domain/npb-draft-event";
export function draftFixture(){return draftEventSchema.parse({schemaVersion:1,league:"NPB",season:2026,scheduledAt:"2026-10-22T16:50:00+09:00",observedAt:"2026-10-21T00:00:00Z",eventState:"scheduled",coverage:"unavailable",license:"CC-BY-SA-4.0",sources:[{provider:"Wikipedia",pageId:5209342,title:"架空fixture",revision:1,revisionAt:"2026-10-20T00:00:00Z",contentSha256:"a".repeat(64),license:"CC-BY-SA-4.0"}],candidates:[{id:"npb:draft:2026:"+"a".repeat(24),name:"架空の長い選手名一郎",article:"架空一郎",affiliation:"架空の長い大学硬式野球部",position:"投手",throws:"右",bats:"左",context:"検証専用の架空名簿",eligibility:"unverified",sourcePageId:5209342,evidenceSha256:"b".repeat(64)}],forecast:{id:"2026-premeeting-v1",createdAt:"2026-10-20T00:00:00Z",author:"Baseball Notes（独自仮説）",predictions:draftTeams.map(teamId=>({teamId,candidateId:"npb:draft:2026:"+"a".repeat(24),reason:"架空の独自仮説です"}))},selections:[],lotteries:[]});}

/** Synthetic only; never admitted or published. */
export function expandedDraftFixture(){
  const data=draftFixture(),first=data.candidates[0]!;
  data.candidates=[first,...Array.from({length:35},(_,i)=>({...first,id:"npb:draft:2026:"+(i+1).toString(16).padStart(24,"0"),name:"架空候補"+(i+1),article:"架空記事"+(i+1)}))];
  data.candidateGroups=data.candidates.map((c,i)=>({candidateId:c.id,group:draftCandidateGroups[i%4]!}));
  data.review={reviewedBy:"fixture reviewer",reviewedAt:"2026-10-21T00:01:00Z"};
  data.expandedForecast={id:"2026-premeeting-v2",createdAt:"2026-10-21T00:01:00Z",author:"Baseball Notes（独自仮説）",predictions:draftTeams.flatMap((teamId,i)=>[1,2,3].map(round=>({teamId,round,candidateId:data.candidates[i*3+round-1]!.id,reason:"架空の検証用予想"})))};
  return draftEventSchema.parse(data);
}

export function researchedDraftFixture(){
  const d=expandedDraftFixture();
  d.researchedForecast={id:"2026-premeeting-v3",createdAt:"2026-10-21T00:01:00Z",author:"Baseball Notes（独自予想）",references:[{id:"fixture",url:"https://sportiva.shueisha.co.jp/clm/baseball/fixture/",publisher:"架空の参照資料",author:"架空の執筆者",publishedOn:"2026-10-20",updatedOn:"2026-10-20",checkedAt:"2026-10-20T23:00:00Z",kind:"commentary",topic:"検証用・実際の報道ではありません"}],clubs:draftTeams.map(teamId=>({teamId,context:"架空の編成仮説",judgment:"架空の独自判断",referenceIds:["fixture"]})),predictions:structuredClone(d.expandedForecast!.predictions)};
  return draftEventSchema.parse(d);
}
