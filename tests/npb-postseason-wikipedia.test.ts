import { describe,expect,it } from "vitest";
import source from "./fixtures/npb-historical/wikipedia-postseason.json";
import { parseWikipediaNpbPostseason,parseWikipediaHistorical } from "../src/infrastructure/providers/wikipedia-npb-historical";
import { sumNpbCompetitionRows } from "../src/domain/npb-competition";
function changed(text:string){return {...source.page,revisions:source.page.revisions.map(r=>({...r,slots:{main:{content:text}}}))};}
const text=source.page.revisions[0]!.slots.main.content;
describe("bounded Wikipedia NPB postseason admission",()=>{
  it("reads exact labelled stages, fractional innings, and per-team rows without inventing missing fields",()=>{
    const result=parseWikipediaNpbPostseason(source.page,source.bridge,[2023,2024,2025]);
    expect(result.rows.map(r=>[r.season,r.scope.stage,r.metrics.outsRecorded])).toEqual([[2023,"npb_cs_first",24],[2024,"npb_cs_first",12],[2024,"japan_series",21],[2025,"npb_cs_final",17]]);
    expect(result.rows.every(r=>r.playerId===source.bridge.playerId&&r.metrics.WHIP===null&&r.metrics.CG===null)).toBe(true);
    expect(()=>sumNpbCompetitionRows(result.rows)).toThrow(/mix/);
    expect(parseWikipediaHistorical(source.page,source.bridge,[2023,2024,2025]).rows).toEqual([]);
  });
  it("fails closed for different headers, identities, ambiguous stages and shifted columns",()=>{
    expect(()=>parseWikipediaNpbPostseason(source.page,{...source.bridge,wikidataId:"Q999"},[2024])).toThrow();
    for(const bad of [text.replace('[[打者|','[[打席|'),text.replace('CSファースト]]','不明]]'),text.replace('29||8.0||5','29||8.0||5||0')])expect(()=>parseWikipediaNpbPostseason(changed(bad),source.bridge,[2023,2024])).toThrow();
    expect(parseWikipediaNpbPostseason(changed(text.replace('=== ポストシーズン投手成績 ===','=== MLBポストシーズン投手成績 ===')),source.bridge,[2024]).rows).toEqual([]);
  });
  it("does not turn historical observations into 2026 results",()=>expect(parseWikipediaNpbPostseason(source.page,source.bridge,[2026]).rows).toEqual([]));
});
