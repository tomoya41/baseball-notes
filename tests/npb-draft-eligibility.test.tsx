// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { draftForecastAdmission, draftEligibilityReview, draftEligibilityReviewSchema } from "../src/domain/npb-draft-eligibility";
import { researchedDraftFixture } from "./fixtures/npb-draft";
import { NpbDraftEventScreen } from "../src/ui/npb-draft-event";
import { readNpbDraftEvent } from "../src/application/npb-draft-event-reader";
import { draftUpdateReport } from "../src/application/npb-draft-update-report";
vi.mock("../src/application/npb-draft-event-reader",()=>({readNpbDraftEvent:vi.fn()}));
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();});

function candidate(name:string){
  const r=draftEligibilityReview.records.find(r=>r.name===name)!;
  const c={...researchedDraftFixture().candidates[0]!,id:r.candidateId,name:r.name,affiliation:r.affiliation,evidenceSha256:r.evidenceSha256,sourcePageId:r.sourcePageId};
  return {c,group:r.group};
}
it("holds Yamada, Ishida, Fukushima and every unlisted student instead of advertising them as eligible",()=>{
  for(const name of ["山田凜虎","石田雄星","福島陽奈汰","小野舜友","萬谷堅心","杉本将吾","梶山侑政"]){const {c,group}=candidate(name);expect(draftForecastAdmission(c,group)).toMatchObject({status:"not_listed",admitted:false});}
  expect(draftEligibilityReview.records.filter(r=>r.status==="listed")).toHaveLength(23);
  expect(draftEligibilityReview.records.filter(r=>r.status==="not_listed")).toHaveLength(12);
});
it("accepts individually checked name AND school, never a same-name identity, new evidence or a different group",()=>{
  for(const name of ["杉本真滉","菰田陽生","渡部海","鈴木泰成"]){const {c,group}=candidate(name);expect(draftForecastAdmission(c,group).admitted).toBe(true);for(const changed of [{...c,id:c.id+"1"},{...c,affiliation:"別の学校"},{...c,evidenceSha256:"0".repeat(64)},{...c,sourcePageId:999},{...c,name:c.name+"別"}])expect(draftForecastAdmission(changed,group).admitted).toBe(false);expect(draftForecastAdmission(c,"corporate").admitted).toBe(false);}
});
it("does not resolve 前田侑仁 vs 前田侑大 or nonstudents by guessing, nor interpret no review as no submission",()=>{
  const {c,group}=candidate("前田侑仁");expect(draftForecastAdmission(c,group)).toMatchObject({status:"identity_mismatch",admitted:false});
  for(const group of [undefined,"corporate","independent"])expect(draftForecastAdmission({...c,id:"unreviewed"},group)).toMatchObject({status:"unverified",admitted:false});
  expect(draftEligibilityReviewSchema.safeParse({...draftEligibilityReview,records:[...draftEligibilityReview.records,draftEligibilityReview.records[0]]}).success).toBe(false);
});
it("also withholds all three editions in the offline result-update report",()=>{
  const d=researchedDraftFixture(),{c,group}=candidate("山田凜虎"),oldId=d.candidates[0]!.id;d.candidates[0]=c;d.candidateGroups![0]={candidateId:c.id,group};
  for(const p of d.forecast.predictions)if(p.candidateId===oldId)p.candidateId=c.id;
  for(const f of [d.expandedForecast!,d.researchedForecast!])for(const p of f.predictions)if(p.candidateId===oldId)p.candidateId=c.id;
  const r=draftUpdateReport(d,structuredClone(d));expect(r.comparisons[0]!.outcome).toBe("withheld");expect(r.expandedComparisons[0]!.outcome).toBe("withheld");expect(r.researchedComparisons[0]!.outcome).toBe("withheld");expect(r.addedSelections).toHaveLength(0);
});
it("masks invalid picks in latest AND both archived editions, excludes their scoring and keeps frozen data unchanged",async()=>{
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  for(const edition of ["latest","expanded","original"]){
    const d=researchedDraftFixture(),{c,group}=candidate("山田凜虎");d.candidates[0]=c;d.candidateGroups![0]={candidateId:c.id,group};
    d.forecast.predictions[0]!.candidateId=c.id;d.expandedForecast!.predictions[0]!.candidateId=c.id;d.researchedForecast!.predictions[0]!.candidateId=c.id;
    const before=JSON.stringify(d);vi.mocked(readNpbDraftEvent).mockResolvedValue(d);
    const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
    try{await act(async()=>root.render(<MemoryRouter initialEntries={[`/NPB/talent/2026?team=npb:team:giants&forecast=${edition}`]}><NpbDraftEventScreen/></MemoryRouter>));
      const row=host.querySelector("article")!;expect(row.textContent).toContain("予想を保留");expect(row.textContent).toContain("対象外");expect(row.querySelector("a.player-row")).toBeNull();expect(row.textContent).not.toContain("一致しています");expect(host.textContent).toContain("訂正：志望届を照合");expect(JSON.stringify(d)).toBe(before);
    }finally{await act(async()=>root.unmount());host.remove();}
  }
});
it("keeps withheld observations out of candidate rows, while retaining an explicitly corrected archive and recorded results",async()=>{
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  const d=researchedDraftFixture(),{c,group}=candidate("山田凜虎");d.candidates=[c];d.candidateGroups=[{candidateId:c.id,group}];vi.mocked(readNpbDraftEvent).mockResolvedValue(d);
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{await act(async()=>root.render(<MemoryRouter initialEntries={["/NPB/talent/2026?view=candidates&forecast=latest&q=山田"]}><NpbDraftEventScreen/></MemoryRouter>));expect(host.querySelectorAll("article")).toHaveLength(0);expect(host.textContent).toContain("以前の収録記録（1人）");expect(host.textContent).toContain("現在の注目候補・予想には含めません");}finally{await act(async()=>root.unmount());host.remove();}
});
it("does not suppress separately verified result facts even when a prediction was withheld",async()=>{
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  const d=researchedDraftFixture(),{c,group}=candidate("山田凜虎");d.candidates=[c];d.candidateGroups=[{candidateId:c.id,group}];
  // Synthetic result only: the production snapshot still contains zero selections.
  d.selections=[{teamId:"npb:team:giants",candidateId:c.id,type:"regular",round:1,status:"confirmed",sourcePageId:c.sourcePageId,evidenceSha256:"f".repeat(64)}];vi.mocked(readNpbDraftEvent).mockResolvedValue(d);
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{await act(async()=>root.render(<MemoryRouter initialEntries={["/NPB/talent/2026?view=results"]}><NpbDraftEventScreen/></MemoryRouter>));expect(host.querySelectorAll("article")).toHaveLength(1);expect(host.querySelector("article")!.textContent).toContain(c.name);expect(host.textContent).not.toContain("予想を保留");}finally{await act(async()=>root.unmount());host.remove();}
});
