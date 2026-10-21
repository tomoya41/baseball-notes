import { expect,it } from "vitest";
import { draftAdditionalAmateurs,draftIndependentPitcher } from "../src/infrastructure/providers/wikipedia-npb-draft-amateurs";
import { draftCandidateId } from "../src/infrastructure/providers/wikipedia-npb-draft";
import { assertDraftSnapshotAdvance,draftEventSchema,draftExpandedPredictionOutcome } from "../src/domain/npb-draft-event";
import { expandedDraftFixture } from "./fixtures/npb-draft";

const table=(section:string,name:string)=>`=== ${section} ===\n!!!#!!氏名!!英語表記!!所属!!投!!打!!備考\n|-\n|監督\n|79||[[架空監督]]||Manager||<small>架空学校</small>||||||\n|-\n|rowspan="1"|コーチ\n|90||[[架空コーチ]]||Coach||架空大学||||||\n|-\n|rowspan="1"|投手\n|11||[[${name}]]||Player||[[架空所属|架空チーム]]||左||左||\n|-\n|rowspan="1"|捕手\n|2||[[架空捕手${section}]]||Catcher||架空チーム||右||左||\n|}\n`;
const national=`== 招集選手 ==\n${table("社会人","架空社会人")}${table("U-18","架空高校生")}=== U-15 ===\n${table("別大会","対象外")}== 試合結果 ==\n`;
it("extracts separate corporate/high-school roster scopes, roles and exact identities without coaches or inferred eligibility",()=>{
  const rows=draftAdditionalAmateurs(national);expect(rows).toHaveLength(4);expect(rows.map(r=>r.group)).toEqual(["corporate","corporate","high_school","high_school"]);
  expect(rows[0]!.candidate.id).toBe(draftCandidateId("架空社会人","架空チーム"));expect(rows[0]!.candidate.context).toContain("2026年社会人代表");expect(rows[2]!.candidate.context).toContain("2026年U-18代表");expect(rows[1]!.candidate.position).toBe("捕手");expect(rows.every(r=>r.candidate.eligibility==="unverified")).toBe(true);
});
it.each([national.replace("氏名!!英語表記","所属!!氏名"),national.replace("[[架空社会人]]","架空社会人"),national.replace('rowspan="1"|捕手','rowspan="1"|不明役割'),national.replace("||左||左||","||不明||左||"),national.replace("[[架空所属|架空チーム]]","{{未対応所属}}")])("holds unreviewed roster layouts/fields",content=>expect(()=>draftAdditionalAmateurs(content)).toThrow());
it("does not inherit the prior section's role when a corrected U-18 table lacks its first role marker",()=>{
  const malformed=national.replace(table("U-18","架空高校生"),table("U-18","架空高校生").replace(/\|rowspan="1"\|コーチ\n\|90[^\n]+\n\|-\n/,"").replace('|rowspan="1"|投手\n',""));
  expect(()=>draftAdditionalAmateurs(malformed)).toThrow(/role missing/);
});
it("rejects incomplete or exhausted rowspan evidence rather than assigning the preceding role",()=>{
  expect(()=>draftAdditionalAmateurs(national.replace('rowspan="1"|投手','rowspan="2"|投手'))).toThrow(/Incomplete amateur role span/);
  expect(()=>draftAdditionalAmateurs(national.replace('rowspan="1"|投手','rowspan="0"|投手'))).toThrow(/role span/);
});
const independent=`== 現役選手・スタッフ ==\n=== 投手 ===\n!名前!!背番号!!投打!!備考\n|-\n|[[架空独立]]||20||右左||2026年度新入団\n|}\n=== 捕手 ===\n|[[別人]]||3||右右||\n== 過去に在籍した選手 ==\n|[[架空退団]]||14||右右||\n`;
it("reads independent pitchers only from the exact current-roster section, keeping source-local identity",()=>{
  const c=draftIndependentPitcher(independent,528913,"架空独立");expect(c.affiliation).toBe("徳島インディゴソックス");expect(c.throws).toBe("右");expect(c.bats).toBe("左");expect(c.sourcePageId).toBe(528913);expect(c.id).toMatch(/^npb:draft:2026:/);
  const numberFirst=`== 所属選手 ==\n=== 投手 ===\n!背番号!!選手名!!投!!打!!備考\n|-\n!19\n|[[架空独立]]||右||右||\n|}\n`;expect(draftIndependentPitcher(numberFirst,3859496,"架空独立").bats).toBe("右");
  for(const [body,id,name] of [[independent,528913,"架空退団"],[independent,123,"架空独立"],[independent.replace("2026年度新入団","元・NPB"),528913,"架空独立"],[independent.replace("右左","右"),528913,"架空独立"]] as const)expect(()=>draftIndependentPitcher(body,id,name)).toThrow();
});
it("freezes both prediction editions and each group, while comparing all three confirmed regular rounds",()=>{
  const old=expandedDraftFixture(),next=structuredClone(old);expect(old.expandedForecast!.predictions).toHaveLength(36);
  for(const round of [1,2,3])expect(draftExpandedPredictionOutcome(next,"npb:team:giants",round)).toBe("unavailable");
  next.observedAt="2026-10-22T10:00:00Z";next.review!.reviewedAt="2026-10-22T10:01:00Z";next.eventState="in_progress";next.coverage="partial";
  next.sources[0]!.revisionAt="2026-10-22T09:00:00Z";
  next.selections=[{teamId:"npb:team:giants",round:2,type:"regular",candidateId:next.expandedForecast!.predictions[1]!.candidateId,status:"confirmed",sourcePageId:5209342,evidenceSha256:"c".repeat(64)}];
  expect(draftEventSchema.safeParse(next).success).toBe(true);expect(()=>assertDraftSnapshotAdvance(old,next)).not.toThrow();expect(draftExpandedPredictionOutcome(next,"npb:team:giants",2)).toBe("match");
  next.selections[0]!.type="developmental";expect(draftExpandedPredictionOutcome(next,"npb:team:giants",2)).toBe("unavailable");
  next.expandedForecast!.predictions[0]!.reason="changed";expect(()=>assertDraftSnapshotAdvance(old,next)).toThrow(/immutable/);
});
it("rejects missing/duplicate picks, missing categories and postmeeting prediction creation",()=>{
  for(const change of [(d:ReturnType<typeof expandedDraftFixture>)=>{d.expandedForecast!.predictions[1]!.round=1;},(d:ReturnType<typeof expandedDraftFixture>)=>{d.expandedForecast!.predictions[1]!.candidateId=d.expandedForecast!.predictions[0]!.candidateId;},(d:ReturnType<typeof expandedDraftFixture>)=>{d.candidateGroups!.pop();},(d:ReturnType<typeof expandedDraftFixture>)=>{d.expandedForecast!.createdAt="2026-10-22T08:00:00Z";}]){const d=expandedDraftFixture();change(d);expect(draftEventSchema.safeParse(d).success).toBe(false);}
});
