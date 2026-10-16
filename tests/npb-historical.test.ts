import { describe, expect, it } from "vitest";
import { parseWikipediaHistorical, inningsToOuts } from "../src/infrastructure/providers/wikipedia-npb-historical";
import { historicalBattingKeys, historicalPitchingKeys, historicalRates, npbHistoricalDatasetSchema, npbHistoricalRowSchema, sumHistoricalRows } from "../src/domain/npb-historical";
import { portableRoute } from "../src/domain/product-sharing";
import archivedFormats from "./fixtures/npb-historical/wikipedia-formats.json";
import emptyAttributes from "./fixtures/npb-historical/wikipedia-empty-attributes.json";
const playerId="00000000-0000-4000-8000-000000000001", bridge={playerId,wikidataId:"Q123",npbId:"12345"};
const metrics={G:10,PA:43,AB:40,R:2,H:10,"2B":2,"3B":0,HR:2,TB:18,RBI:3,SB:0,CS:0,SH:0,SF:1,BB:2,IBB:1,HBP:0,SO:10,GDP:1,AVG:0.25,OBP:12/43,SLG:.45,OPS:12/43+.45};
const pitching=Object.fromEntries(historicalPitchingKeys.map(k=>[k,null]));Object.assign(pitching,{G:2,GS:1,outsRecorded:20,H:5,BB:1,IBB:0,HBP:2,SO:7,R:2,ER:1,ERA:1.35,WHIP:.9});
const row={playerId,season:2025,teamId:"npb:team:tigers" as const,role:"batting" as const,metrics};
const page=(content:string)=>({title:"架空テスト選手",pageprops:{wikibase_item:"Q123"},revisions:[{revid:123,timestamp:"2026-01-01T00:00:00Z",slots:{main:{content}}}]});
const table=(body:string,role="batting",league="日本野球機構")=>`=== 年度別${role==="batting"?"打撃":"投手"}成績 ===\n{| {{${role==="batting"?"年度別打撃成績":"投手成績"}|リーグ=${league}}}\n|-\n${body}\n|}`;
const counts=(m:Record<string,number|null>,keys:readonly string[])=>keys.map(k=>m[k]??"--").join("||");
describe("NPB historical aggregate source adapter",()=>{
  it("excludes whole commented tables and rows before applying visible rowspans",()=>{
    const line=counts(metrics,historicalBattingKeys);
    const hiddenTable=`<!--${table(`|2024\n|阪神\n|${line}`)}-->`;
    const source=hiddenTable+"\n"+table(`|2023\n|rowspan=2|阪神\n|${line}\n|-\n<!--|2024\n|${line}\n|-\n-->\n|2025\n|${line}`);
    const parsed=parseWikipediaHistorical(page(source),bridge,[2023,2024,2025]);
    expect(parsed.rows.map(r=>[r.season,r.teamId])).toEqual([[2023,"npb:team:tigers"],[2025,"npb:team:tigers"]]);
    expect(parsed.player.contentSha256).toBe(parseWikipediaHistorical(page(source),bridge,[]).player.contentSha256);
    expect(parseWikipediaHistorical(page(`<!--${table(`|2025\n|阪神\n|${line}`)}`),bridge,[2025]).rows).toHaveLength(0);
  });
  it("reads empty MediaWiki cell attributes without accepting malformed nonempty attributes",()=>{
    const read=(title:string)=>{const f=emptyAttributes.find(f=>f.page.title===title)!;return parseWikipediaHistorical(f.page,f.bridge,[2023,2024,2025]);};
    expect(read("山﨑伊織").rows.map(r=>[r.season,r.metrics.G])).toEqual([[2023,23],[2024,24],[2025,25]]);
    expect(read("ネフタリ・ソト").rows.find(r=>r.season===2024)?.metrics.SLG).toBe(.45);
    expect(read("石川慎吾").rows.some(r=>r.season===2024)).toBe(false);
    expect(read("石川慎吾").issues.some(i=>i.reason==="Unsupported numeric cell")).toBe(true);
  });
  it("recovers archived missing-value/colored cells and comments without editing statistics",()=>{
    const result=(name:string)=>{const f=archivedFormats.find(f=>f.page.title===name)!;return parseWikipediaHistorical(f.page,f.bridge,Array.from({length:11},(_,i)=>2015+i));};
    expect(result("佐藤輝明").rows.find(r=>r.season===2025)?.metrics.HR).toBe(40);
    expect(result("大山悠輔").rows).toHaveLength(9);
    expect(result("陽柏翔").rows).toHaveLength(1);
    const traded=result("伊藤光");
    expect(traded.rows.filter(r=>r.season===2018).map(r=>r.teamId)).toEqual(["npb:team:buffaloes","npb:team:baystars"]);
    expect(traded.rows.some(r=>r.season===2024&&r.teamId==="npb:team:baystars")).toBe(true);
    expect(traded.rows.some(r=>r.season===2025)).toBe(false); // .000 AVG with zero AB stays rejected.
    const pitcher=result("戸郷翔征");
    expect(pitcher.issues.some(i=>i.reason.includes("WHIP"))).toBe(true);
    expect(pitcher.rows.some(r=>r.season===2019)).toBe(false);
    expect(pitcher.rows.some(r=>r.season===2024)).toBe(true); // Independent later rows survive a numeric error.
  });
  it("accepts only explicit, fixed numeric decorations and preserves unknown versus zero",()=>{
    const m={...metrics,G:1000,IBB:null,SB:0};
    const line=counts(m,historicalBattingKeys).replace("1000||","{{Color|red|'''1,000'''}}||").replace("||--||","||{{Nowrap|----}}||");
    const r=parseWikipediaHistorical(page(table(`|2025\n|阪神\n|${line}`,"batting","日本プロ野球")),bridge,[2025]);
    expect(r.rows[0]?.metrics).toMatchObject({G:1000,IBB:null,SB:0});
    const malformed=counts(metrics,historicalBattingKeys).replace("10||43","1|0||43");
    expect(parseWikipediaHistorical(page(table(`|2025\n|阪神\n|${malformed}`)),bridge,[2025]).rows).toEqual([]);
  });
  it("stops on ambiguous spans rather than guessing subsequent column positions",()=>{
    const r=parseWikipediaHistorical(page(table(`|2024\n|colspan=2|阪神\n|${counts(metrics,historicalBattingKeys)}\n|-\n|2025\n|阪神\n|${counts(metrics,historicalBattingKeys)}`)),bridge,[2024,2025]);
    expect(r.rows).toEqual([]);expect(r.issues[0]?.reason).toContain("colspan");
  });
  it("parses exact NPB yearly columns, excluding article career and international scopes",()=>{
    const source=table(`|{{by2|2025}}\n|[[阪神タイガース|阪神]]\n|${counts(metrics,historicalBattingKeys)}\n|-\n!colspan=2|通算\n|${counts(metrics,historicalBattingKeys)}`);
    const result=parseWikipediaHistorical(page(source),bridge,[2025]);expect(result.rows).toEqual([row]);expect(result.issues).toEqual([]);
    expect(parseWikipediaHistorical(page(table(`|{{by2|2025}}\n|阪神\n|${counts(metrics,historicalBattingKeys)}`,"batting","メジャーリーグベースボール")),bridge,[2025]).rows).toEqual([]);
  });
  it("uses explicit rowspan team evidence and does not infer missing years",()=>{
    const source=table(`|{{by2|2023}}\n|rowspan="2" style="text-align:center;"|[[阪神タイガース|阪神]]\n|${counts(metrics,historicalBattingKeys)}\n|-\n|{{by2|2025}}\n|${counts(metrics,historicalBattingKeys)}`);
    const result=parseWikipediaHistorical(page(source),bridge,[2023,2024,2025]);expect(result.rows.map(r=>[r.season,r.teamId])).toEqual([[2023,"npb:team:tigers"],[2025,"npb:team:tigers"]]);
  });
  it("quarantines unsupported numeric templates instead of silently skipping a cell",()=>{
    const bad=counts(metrics,historicalBattingKeys).replace("10||43","{{0}}||43");
    const result=parseWikipediaHistorical(page(table(`|{{by2|2025}}\n|阪神\n|${bad}`)),bridge,[2025]);expect(result.rows).toEqual([]);expect(result.issues[0]?.reason).toBe("Unsupported numeric cell");
  });
  it("does not infer a club from latest affiliation or merge names",()=>{
    expect(()=>parseWikipediaHistorical({...page(""),pageprops:{wikibase_item:"Q999"}},bridge,[2025])).toThrow(/identity/);
    const result=parseWikipediaHistorical(page(table(`|{{by2|2025}}\n|不明球団\n|${counts(metrics,historicalBattingKeys)}`)),bridge,[2025]);expect(result.rows).toEqual([]);
    expect(()=>parseWikipediaHistorical(page("npb.jp/bis/players/99999.html"),bridge,[2025])).toThrow(/evidence mismatch/);
  });
  it("handles pitching innings as outs and keeps walks independent of HBP",()=>{
    const line=historicalPitchingKeys.map(k=>k==="outsRecorded"?"6.2":pitching[k]??"--").join("||");
    const r=parseWikipediaHistorical(page(table(`|{{By2|2025}}\n|楽天\n|${line}`,"pitching")),bridge,[2025]);expect(r.rows[0]?.metrics.outsRecorded).toBe(20);expect(r.rows[0]?.metrics.BB).toBe(1);expect(r.rows[0]?.metrics.HBP).toBe(2);
  });
  it.each([["0.0",0],["0.1",1],["7.2",23],["150.1",451],["--",null]])("converts IP %s safely",(input,expected)=>expect(inningsToOuts(String(input))).toBe(expected));
  it("normalizes the source .000 placeholder without decisions to unavailable",()=>{
    const m:Record<string,number|null>={...pitching,W:0,L:0,WPCT:0};
    const line=historicalPitchingKeys.map(k=>k==="outsRecorded"?"6.2":m[k]??"--").join("||");
    const result=parseWikipediaHistorical(page(table(`|{{by2|2025}}\n|楽天\n|${line}`,"pitching")),bridge,[2025]);
    expect(result.rows).toHaveLength(1);expect(result.rows[0]?.metrics.WPCT).toBeNull();expect(result.rows[0]?.metrics.SO).toBe(7);
  });
  it.each(["6.3","1.7","NaN","1/3","-1.0"])("rejects unsupported innings %s",input=>expect(()=>inningsToOuts(input)).toThrow());
});
describe("historical data boundaries",()=>{
  it("rejects shifted columns, impossible hits and inconsistent rates",()=>{
    expect(npbHistoricalRowSchema.safeParse({...row,metrics:{...metrics,H:50}}).success).toBe(false);
    expect(npbHistoricalRowSchema.safeParse({...row,metrics:{...metrics,AVG:.9}}).success).toBe(false);
    expect(npbHistoricalRowSchema.safeParse({...row,metrics:{...metrics,PA:3}}).success).toBe(false);
    expect(npbHistoricalRowSchema.safeParse({...row,metrics:{...metrics,AB:1.5}}).success).toBe(false);
  });
  it("never accepts 2026 as historical or adds game facts/postseason",()=>{
    expect(npbHistoricalRowSchema.safeParse({...row,season:2026}).success).toBe(false);
    expect(npbHistoricalRowSchema.safeParse({...row,gameId:"invented"}).success).toBe(false);
    const d={schemaVersion:1,league:"NPB",temporalScope:"historical",competition:"regular",granularity:"season_aggregate",license:"CC-BY-SA-4.0",observedAt:"2026-10-02T00:00:00Z",inputSha256:"a".repeat(64),transformation:"test",coverage:"partial",players:[{playerId,name:"架空テスト選手",wikidataId:"Q123",npbId:"12345",article:"架空テスト選手",revision:123,revisionAt:"2026-01-01T00:00:00Z",contentSha256:"b".repeat(64)}],rows:[row]};
    expect(npbHistoricalDatasetSchema.safeParse(d).success).toBe(true);
    for(const change of [{coverage:"complete"},{competition:"postseason"},{rows:[row,row]},{players:[]}])expect(npbHistoricalDatasetSchema.safeParse({...d,...change}).success).toBe(false);
  });
  it("sums selected seasons and club stints without averaging rates or hiding unknowns",()=>{
    const rs=[row,{...row,season:2023,teamId:"npb:team:hawks" as const,metrics:{...metrics,H:0,TB:0,"2B":0,HR:0,AVG:0,SLG:0,OBP:2/43,OPS:2/43}}];
    const total=sumHistoricalRows(rs);expect(total.seasons).toEqual([2023,2025]);expect(total.metrics.H).toBe(10);expect(total.metrics.AVG).toBe(.125);expect(total.metrics.OPS).toBeCloseTo(14/86+18/80);
    expect(sumHistoricalRows([row,{...row,season:2024,metrics:{...metrics,BB:null}}]).metrics.OBP).toBeNull();
    expect(()=>sumHistoricalRows([row,{...row,playerId:"another"}])).toThrow();
  });
  it("keeps zero-outs and zero-denominator rates unavailable",()=>{
    expect(historicalRates("pitching",{ER:0,H:0,BB:0,outsRecorded:0})).toEqual({ERA:null,WHIP:null,WPCT:null});
    expect(historicalRates("batting",{H:0,AB:0,BB:0,HBP:0,SF:0,TB:0})).toEqual({AVG:null,OBP:null,SLG:null,OPS:null});
  });
  it("validates and recomputes pitching win percentage from decisions, never averages rates",()=>{
    const r={...row,role:"pitching" as const,metrics:{...pitching,W:2,L:1,WPCT:2/3}};
    expect(npbHistoricalRowSchema.safeParse(r).success).toBe(true);
    expect(npbHistoricalRowSchema.safeParse({...r,metrics:{...r.metrics,WPCT:.9}}).success).toBe(false);
    const total=sumHistoricalRows([r,{...r,season:2024,metrics:{...r.metrics,W:1,L:3,WPCT:.25}}]);
    expect(total.metrics.WPCT).toBeCloseTo(3/7);
    for(const [W,L] of [[0,0],[null,1],[1,null]]) {
      expect(historicalRates("pitching",{W:W!,L:L!}).WPCT).toBeNull();
      expect(npbHistoricalRowSchema.safeParse({...r,metrics:{...r.metrics,W,L,WPCT:.5}}).success).toBe(false);
    }
  });
  it("retains historical history selection without authorizing NPB current rankings",()=>{
    expect(portableRoute("/NPB/history",`season=2025&player=${playerId}&role=pitching&recentPlayers=${playerId}`)).toContain("season=2025");
  });
});
