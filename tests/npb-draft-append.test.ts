import { expect,it } from "vitest";
import { draftFixture } from "./fixtures/npb-draft";
import { draftEventSchema,draftEvidenceSource,assertDraftSnapshotAdvance } from "../src/domain/npb-draft-event";
import { draftHash,draftTeamFullNames,assertCarriedDraftEvidence } from "../src/infrastructure/providers/wikipedia-npb-draft";
import { auditDraft2026ResultTables } from "../src/infrastructure/providers/wikipedia-npb-draft-results";
import { appendReviewedDraftResults } from "../src/infrastructure/providers/wikipedia-npb-draft-append";

const now=Date.parse("2026-10-27T01:02:00Z"),observedAt="2026-10-27T01:00:00Z",reviewedAt="2026-10-27T01:01:00Z";
const teams=Object.keys(draftTeamFullNames);
function fixture(){
  const old=draftFixture(),roster="架空の旧名簿";
  old.sources[0]!.contentSha256=draftHash(roster);
  old.sources.push({provider:"Wikipedia",pageId:5282993,title:"架空の固定ドラフト記事",revision:2,revisionAt:"2026-10-23T00:00:00Z",contentSha256:draftHash("架空の旧結果"),license:"CC-BY-SA-4.0"});
  old.observedAt="2026-10-23T00:01:00Z";old.review={reviewedBy:"架空の旧審査",reviewedAt:"2026-10-23T00:02:00Z"};old.eventState="ended";old.coverage="partial";
  old.selections=[{teamId:"npb:team:tigers",type:"regular",round:1,candidateId:old.candidates[0]!.id,status:"confirmed",sourcePageId:5282993,evidenceSha256:draftHash("架空の旧行") }];
  const matrix=(rank:number,name:string,team:string)=>`!${rank}巡目→\n${teams.map(t=>`|${t===team?`[[${name}]]`:"---"}`).join("\n")}`;
  const header=teams.map(t=>`![[2026年の${draftTeamFullNames[t]}|表示]]`).join("\n");
  const team=(id:string,rank:number,name:string,school:string)=>`=== ${draftTeamFullNames[id]} ===\n{| class="wikitable"\n!colspan="5"|新人選手選択会議\n|-\n!順位!!選手名!!守備!!所属!!結果\n|-\n!${rank}位\n|[[${name}]]||投手||[[${school}]]||\n|}\n`;
  const content=`== 指名選手一覧 ==\n{| class="wikitable"\n|-\n!colspan="13"|支配下選手\n|-\n!指名順\n${header}\n|-\n${matrix(2,"架空右腕","giants")}\n|-\n${matrix(6,"架空左腕","eagles")}\n|}\n== 球団別指名選手一覧 ==\n${team("giants",2,"架空右腕","架空大学甲")}${team("eagles",6,"架空左腕","架空社会人乙")}`;
  const source={...old.sources[1]!,revision:3,revisionAt:"2026-10-26T00:00:00Z",contentSha256:draftHash(content)};
  const archive={observedAt,response:{query:{pages:[{pageid:5209342,title:old.sources[0]!.title,revisions:[{revid:1,timestamp:old.sources[0]!.revisionAt,slots:{main:{content:roster}}}]},{pageid:5282993,title:source.title,revisions:[{revid:3,timestamp:source.revisionAt,slots:{main:{content}}}]}]}}};
  const rows=auditDraft2026ResultTables(content).rows;
  const normalized=draftEventSchema.parse(old);
  const review={format:"2026_result_additions",previousBodySha256:draftHash(JSON.stringify(normalized)),archiveSha256:draftHash(JSON.stringify(archive)),reviewedBy:"架空の追加審査",reviewedAt,source,selections:rows.map(({teamId,type,round,name,article,affiliation,position,evidenceSha256})=>({teamId,type,round,name,article,affiliation,position,evidenceSha256}))};
  return {old:normalized,archive,review,content};
}
const apply=(f=fixture())=>appendReviewedDraftResults(f.old,f.archive,f.review,now);

it("appends only reviewed empty slots with exact new-revision provenance and preserves every old value",()=>{
  const f=fixture(),before=JSON.stringify(f.old),{data}=apply(f);
  expect(JSON.stringify(f.old)).toBe(before);expect(data.selections).toHaveLength(3);expect(data.candidates).toHaveLength(3);
  expect(data.sources).toEqual(f.old.sources);expect(data.candidates[0]).toEqual(f.old.candidates[0]);expect(data.selections[0]).toEqual(f.old.selections[0]);expect(data.forecast).toEqual(f.old.forecast);expect(data.lotteries).toEqual(f.old.lotteries);
  expect(draftEvidenceSource(data,data.selections[0]!)).toEqual(f.old.sources[1]);
  for(const row of [...data.selections.slice(1),...data.candidates.slice(1)])expect(draftEvidenceSource(data,row)?.revision).toBe(3);
  expect(data.additionalSources).toEqual([f.review.source]);expect(()=>assertDraftSnapshotAdvance(f.old,data)).not.toThrow();
});
it("rejects slot reuse, changed person/row hash, predecessor mutations and name-only merges",()=>{
  for(const mutate of [
    (f:ReturnType<typeof fixture>)=>{f.review.selections[0]!.round=1;f.review.selections[0]!.teamId="npb:team:tigers";},
    (f:ReturnType<typeof fixture>)=>{f.review.selections.push(f.review.selections[0]!);},
    (f:ReturnType<typeof fixture>)=>{f.review.selections[0]!.name="別の架空人物";},
    (f:ReturnType<typeof fixture>)=>{f.review.selections[0]!.evidenceSha256="0".repeat(64);},
    (f:ReturnType<typeof fixture>)=>{f.old.candidates[0]!.name="架空の改変";},
  ]){const f=fixture();mutate(f);expect(()=>apply(f)).toThrow();}
  const f=fixture(),accepted=apply(f).data.candidates[1]!;delete accepted.sourceRevision;f.old.candidates.push(accepted);f.review.previousBodySha256=draftHash(JSON.stringify(f.old));expect(()=>apply(f)).toThrow(/replace or merge/);
});
it("reuses an old candidate only by an explicit reviewed ID and exact article/name/affiliation/position",()=>{
  const f=fixture(),accepted=apply(f).data.candidates[1]!;delete accepted.sourceRevision;
  f.old.candidates.push(accepted);f.review.previousBodySha256=draftHash(JSON.stringify(f.old));
  const review={...f.review,selections:f.review.selections.map(s=>s.name===accepted.name?{...s,existingCandidateId:accepted.id}:s)};
  const d=appendReviewedDraftResults(f.old,f.archive,review,now).data;
  expect(d.candidates.filter(c=>c.id===accepted.id)).toHaveLength(1);expect(d.candidates.find(c=>c.id===accepted.id)).toEqual(accepted);
  expect(draftEvidenceSource(d,accepted)?.revision).toBe(2);expect(draftEvidenceSource(d,d.selections.find(s=>s.candidateId===accepted.id)!)?.revision).toBe(3);
  for(const field of ["name","article","affiliation","position"] as const){const old=structuredClone(f.old);if(field==="position")old.candidates[1]!.position="捕手";else old.candidates[1]![field]="別の架空値";expect(()=>appendReviewedDraftResults(old,f.archive,{...review,previousBodySha256:draftHash(JSON.stringify(old))},now)).toThrow(/replace or merge/);}
});
it("validates source continuity, revisions, review chronology and the unchanged second source",()=>{
  for(const mutate of [
    (f:ReturnType<typeof fixture>)=>{f.review.source.revision=2;},
    (f:ReturnType<typeof fixture>)=>{f.review.source.contentSha256="0".repeat(64);},
    (f:ReturnType<typeof fixture>)=>{f.review.source.title="新しい未許可記事";},
    (f:ReturnType<typeof fixture>)=>{f.review.reviewedAt="2026-10-27T00:59:00Z";},
    (f:ReturnType<typeof fixture>)=>{f.review.reviewedAt="2026-10-27T01:03:00Z";},
    (f:ReturnType<typeof fixture>)=>{f.archive.response.query.pages[0]!.revisions[0]!.slots.main.content="変更された別名簿";},
    (f:ReturnType<typeof fixture>)=>{f.archive.response.query.pages.push(f.archive.response.query.pages[0]!);},
  ]){const f=fixture();mutate(f);expect(()=>apply(f)).toThrow();}
});
it("holds whitespace/mixed-case copyright warning tags while distinguishing protection templates",()=>{
  for(const warning of ["{{ Copyvio|reason=架空}}","{{\n cOpYvIo\n|reason=架空}}","{{ Copyright violation |reason=架空}}","{{転載疑惑}}","{{著作権侵害|架空}}","{{ コピペ }}"]){
    const f=fixture();const content=warning+"\n"+f.content;f.archive.response.query.pages[1]!.revisions[0]!.slots.main.content=content;f.review.source.contentSha256=draftHash(content);f.review.archiveSha256=draftHash(JSON.stringify(f.archive));
    expect(()=>apply(f)).toThrow(/rights warning/);
  }
  const f=fixture(),content="{{pp-vandalism}}\n"+f.content;f.archive.response.query.pages[1]!.revisions[0]!.slots.main.content=content;f.review.source.contentSha256=draftHash(content);f.review.archiveSha256=draftHash(JSON.stringify(f.archive));expect(()=>apply(f)).not.toThrow();
});
it("rejects unresolved, duplicate, unused or conflicting supplemental references instead of falling back",()=>{
  const d=apply().data;
  for(const mutate of [
    (v:typeof d)=>{v.additionalSources!.push({...v.additionalSources![0]!,contentSha256:"0".repeat(64)});},
    (v:typeof d)=>{v.additionalSources![0]!.pageId=999999;},
    (v:typeof d)=>{v.additionalSources![0]!.revisionAt="2026-10-28T00:00:00Z";},
    (v:typeof d)=>{v.selections[1]!.sourceRevision=99;},
    (v:typeof d)=>{v.candidates[1]!.sourceRevision=99;},
    (v:typeof d)=>{v.additionalSources!.push({...v.additionalSources![0]!,revision:4});},
  ]){const v=structuredClone(d);mutate(v);expect(draftEventSchema.safeParse(v).success).toBe(false);}
  expect(draftEvidenceSource(d,{sourcePageId:5282993,sourceRevision:99})).toBeUndefined();
});
it("keeps both source generations immutable and rejects repeated advancement of the same result",()=>{
  const f=fixture(),d=apply(f).data;
  for(const mutate of [(v:typeof d)=>{delete v.additionalSources;},(v:typeof d)=>{v.additionalSources![0]!.contentSha256="0".repeat(64);},(v:typeof d)=>{v.sources[1]!.revision=3;},(v:typeof d)=>{v.candidates[0]!.evidenceSha256="0".repeat(64);},(v:typeof d)=>{v.selections.shift();}]){const changed=structuredClone(d);mutate(changed);expect(()=>assertDraftSnapshotAdvance(d,changed)).toThrow();}
  const review={...f.review,previousBodySha256:draftHash(JSON.stringify(d))};expect(()=>appendReviewedDraftResults(d,f.archive,review,now)).toThrow(/must advance/);
  for(const kind of ["candidates","selections"] as const){const changed=structuredClone(d);delete changed[kind][1]!.sourceRevision;expect(()=>assertDraftSnapshotAdvance(f.old,changed)).toThrow(/explicitly/);}
});
it("does not weaken the old normal builder's changed-carried-evidence guard",()=>{
  const f=fixture();
  expect(()=>assertCarriedDraftEvidence(f.old,[{source:f.review.source,content:f.content}])).toThrow(/evidence changed/);
  expect(()=>apply(f)).not.toThrow();
});
