import { describe,expect,it } from "vitest";
import { classifyNpbCoverageGaps,regularIssueCategory } from "../scripts/lib/npb-coverage-gaps";

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const bridge=(n:number)=>({playerId:id(n),npbId:String(10000000+n),wikidataId:`Q${n}`});
const link=(n:number)=>({...bridge(n),title:`同じ名前${n}`});
describe("bounded NPB gap diagnostics",()=>{
  it("separates identity, missing archive, quarantined rows and absent admitted rows without inventing debuts",()=>{
    const players=[{id:id(1),bridge:false,years:[]},{id:id(2),bridge:true,years:[]},{id:id(3),bridge:true,years:[]},{id:id(4),bridge:true,years:[]},{id:id(5),bridge:true,years:[2025]}];
    const result=classifyNpbCoverageGaps(players,[bridge(2),bridge(3),bridge(4),bridge(5)],{titles:[link(3),link(4),link(5)]},[{playerId:id(3),reason:"Rate discrepancy: WHIP"}],[]);
    expect(result.details.map(p=>p.status)).toEqual(["independent_identity_required","article_archive_required","source_rows_quarantined","no_admitted_season_rows","partial_history_collected"]);
    expect(result.details.every(p=>p.careerCompleteness==="unverified"&&p.registrationStatus==="unknown")).toBe(true);
    expect(result.details[3]!.requiredEvidence).toBe("verified_season_rows_in_admitted_years");
  });
  it("requires exact independent ID triples, even when an article name would appear plausible",()=>{
    expect(()=>classifyNpbCoverageGaps([], [bridge(2)],{titles:[{...link(2),npbId:"99999999"}]},[],[])).toThrow(/independently admitted/);
    expect(()=>classifyNpbCoverageGaps([{id:id(2),bridge:false,years:[]}],[bridge(2)],{titles:[]},[],[])).toThrow(/status mismatch/);
  });
  it("rejects identity collisions and keeps historical-only articles out of Current archive matching",()=>{
    expect(()=>classifyNpbCoverageGaps([], [bridge(2),{...bridge(3),npbId:bridge(2).npbId}],{titles:[]},[],[])).toThrow(/Conflicting/);
    expect(()=>classifyNpbCoverageGaps([], [],{titles:[{...link(1),identityScope:"historical_only"},{...link(2),wikidataId:link(1).wikidataId,identityScope:"historical_only"}]},[],[])).toThrow(/Conflicting/);
    expect(()=>classifyNpbCoverageGaps([], [bridge(1),bridge(2)],{titles:[link(1),{...link(2),title:link(1).title}]},[],[])).toThrow(/article title/);
    expect(()=>classifyNpbCoverageGaps([], [bridge(1)],{titles:[{...link(1),identityScope:"historical_only"}]},[],[])).toThrow(/Current canonical namespace/);
    const r=classifyNpbCoverageGaps([{id:id(1),bridge:true,years:[]}],[bridge(1)],{titles:[{...link(2),identityScope:"historical_only"}]},[],[]);
    expect(r.details[0]!.status).toBe("article_archive_required");
  });
  it("classifies defects independently and does not turn unknown reasons into accepted values",()=>{
    expect(["unsupported_table_definition","Unsupported numeric cell","Rate without denominator: AVG","PA components exceed PA; Rate discrepancy: OPS","new unhandled issue"].map(regularIssueCategory))
      .toEqual(["unsupported_source_table","unparseable_numeric","insufficient_components","inconsistent_statistics","unclassified_quarantine"]);
  });
  it("counts CS diagnostics as observations, retains exact linked targets and never maps plain names",()=>{
    const r=classifyNpbCoverageGaps([],[],{titles:[]},[],[{reason:"unverified_article_identity",article:"選手甲"},{reason:"unverified_article_identity",article:"選手甲"},{reason:"unverified_article_identity"}]);
    expect(r.csQuarantine).toMatchObject({diagnostics:3,explicitArticleTargets:["選手甲"],reasonCounts:{unverified_article_identity:3}});
    expect(r.details).toHaveLength(0);
  });
});
