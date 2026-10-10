import { describe,it,expect,vi } from "vitest";
import { mlbProductMetrics,seasonCheckpoints } from "../src/domain/mlb-product-metrics";
import { foldRecent,recentMonths,recentMonthSchema,recentIndexSchema,battingDailyKeys,pitchingDailyKeys,type RecentMonth,type RecentIndex } from "../src/domain/mlb-recent-explorer";
import { readMlbAllRecent } from "../src/application/mlb-recent-explorer";
import { portableRoute } from "../src/domain/product-sharing";
import { canonicalDeepLink } from "../src/domain/native-navigation";
import { metricHelp } from "../src/presentation/metric-help";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import type { ExplorerValues } from "../src/domain/data-explorer";
const player="mlb:player:00000000-0000-4000-8000-000000000001",team="mlb:team:00000000-0000-4000-8000-000000000010",other="mlb:team:00000000-0000-4000-8000-000000000011";
const fingerprint="a".repeat(64), names=new Map([[player,"選手"]]);
const index:RecentIndex={schemaVersion:1,league:"MLB",competitionType:"regular",season:2025,sourceFingerprint:fingerprint,firstDate:"2025-03-01",lastDate:"2025-09-30",coverage:"complete",gameCount:10,months:[{month:"2025-03",rows:3,compressedBytes:10}]};
const bat=(day:number,teamIndex=0,missing=false)=>[day,0,teamIndex,...battingDailyKeys.map(k=>k==="G"?1:k==="PA"?5:k==="AB"?4:k==="H"?2:k==="BB"?missing?null:1:k==="HR"?1:0)];
const pitch=(day:number,outs=3)=>[day,0,0,...pitchingDailyKeys.map(k=>k==="G"?1:k==="GS"?0:k==="outsRecorded"?outs:k==="BF"?5:k==="H"?2:k==="BB"?1:k==="HBP"?2:k==="SO"?3:0)];
const month:RecentMonth={schemaVersion:1,league:"MLB",competitionType:"regular",season:2025,sourceFingerprint:fingerprint,month:"2025-03",players:[player],teams:[team,other],batting:[bat(1),bat(15),bat(29,1)],pitching:[pitch(29)]};
const values=(input:Record<string,number|null>)=>Object.fromEntries(Object.entries(input).map(([k,value])=>[k,{value,status:value===null?"unavailable":"complete"}])) as ExplorerValues;
describe("MLB historical derived metrics and season checkpoints",()=>{
  it("uses independent BB, excludes HBP and keeps role denominators",()=>{
    const input=values({SO:3,BB:1,H:2,HBP:2,PA:10,BF:5,outsRecorded:3});
    const b=mlbProductMetrics(input,"batting")!,p=mlbProductMetrics(input,"pitching")!;
    expect(b["K%"]?.value).toBe(30);expect(p["K%"]?.value).toBe(60);expect(p["BB%"]?.value).toBe(20);expect(p.WHIP?.value).toBe(3);expect(p.BB9?.value).toBe(9);expect(b.WHIP).toBeUndefined();expect(input).not.toHaveProperty("WHIP");
  });
  it.each([0,null])("does not infer a rate from zero/missing outs %s",outs=>{const p=mlbProductMetrics(values({SO:1,BB:0,H:0,BF:1,outsRecorded:outs}),"pitching")!;expect(p.WHIP?.value).toBeNull();expect(p.BB9?.value).toBeNull();expect(p["K%"]?.value).toBe(100);});
  it("rejects partial inputs for additional rates",()=>{const input=values({H:5,BB:2,outsRecorded:9});input.BB!.status="partial";expect(mlbProductMetrics(input,"pitching")?.WHIP).toEqual({value:null,status:"partial"});});
  it("uses the same deterministic checkpoint interval as Watch and skips unavailable",()=>{
    const result=seasonCheckpoints(values({H:197,HR:20,RBI:null}),values({SO:149,W:0}));
    expect(result.find(c=>c.metric==="H")).toMatchObject({previous:150,next:200,remaining:3});expect(result.find(c=>c.metric==="HR")).toMatchObject({previous:20,next:30});expect(result.some(c=>c.metric==="RBI")).toBe(false);expect(result).not.toHaveProperty("career");
  });
  it.each(["WHIP","BB9","K%","BB%"])("explains %s formula, inputs and sample",key=>{const help=metricHelp(key)!;expect(help.formula).toBeTruthy();expect(help.sample).toBeTruthy();expect(help.scope).toContain("別集計");});
});
describe("all-player Historical Recent shards",()=>{
  it.each([[7,1],[14,1],[30,3]] as const)("folds an inclusive %s-day window without fetching Profiles",(days,games)=>{
    const row=foldRecent(index,[month],names,"2025-03-30",days)[0]!;
    expect(row.batting?.G?.value).toBe(games);expect(row.batting?.AVG?.value).toBe(.5);expect(row.pitching?.WHIP?.value).toBe(3);
  });
  it("filters by actual team in the window, including a transferred player",()=>{expect(foldRecent(index,[month],names,"2025-03-30",30,team)[0]?.batting?.G?.value).toBe(2);expect(foldRecent(index,[month],names,"2025-03-30",30,other)[0]?.batting?.G?.value).toBe(1);});
  it("keeps null BB and zero-out rates unavailable",()=>{const changed={...month,batting:[bat(29,0,true)],pitching:[pitch(29,0)]};const row=foldRecent(index,[changed],names,"2025-03-30",7)[0]!;expect(row.batting?.BB?.value).toBeNull();expect(row.batting?.OBP?.value).toBeNull();expect(row.pitching?.ERA?.value).toBeNull();});
  it("keeps a no-appearance window empty",()=>{expect(foldRecent(index,[{...month,batting:[],pitching:[]}],names,"2025-03-30",7)).toEqual([]);});
  it("rejects scope, generation, identity, missing-shard and invalid date drift",()=>{
    expect(()=>foldRecent(index,[{...month,competitionType:"postseason"}],names,"2025-03-30",7)).toThrow();expect(()=>foldRecent(index,[{...month,sourceFingerprint:"b".repeat(64)}],names,"2025-03-30",7)).toThrow();expect(()=>foldRecent(index,[month],new Map(),"2025-03-30",7)).toThrow();expect(()=>foldRecent(index,[],names,"2025-03-30",7)).toThrow();expect(()=>recentMonths(index,"2026-01-01",7)).toThrow();expect(()=>recentMonths(index,"2025-02-30",7)).toThrow();
  });
  it("validates arrays, duplicate rows and canonical dictionary bounds before caching",()=>{
    expect(recentMonthSchema.safeParse(month).success).toBe(true);expect(recentIndexSchema.safeParse(index).success).toBe(true);
    expect(recentMonthSchema.safeParse({...month,batting:[bat(32)]}).success).toBe(false);expect(recentMonthSchema.safeParse({...month,batting:[bat(1),bat(1)]}).success).toBe(false);expect(recentMonthSchema.safeParse({...month,players:[]}).success).toBe(false);
    expect(validStaticPayload("exploration/recent/2025/2025-03.json",month)).toBe(true);expect(validStaticPayload("exploration/recent/2024/2025-03.json",month)).toBe(false);expect(validStaticPayload("postseason/exploration/recent/2025/2025-03.json",month)).toBe(false);
  });
  it("reads only index and matching months with strict publication context",async()=>{
    const read=vi.fn(async(path:string)=>path.endsWith("index.json")?index:month);
    const result=await readMlbAllRecent(2025,"regular","2025-03-30",14,[{id:player,name:"選手",seasons:[2025],positions:[],teamIds:[team]}],index,"",read as Parameters<typeof readMlbAllRecent>[7]);
    expect(read).toHaveBeenCalledTimes(2);expect(result.values).toHaveLength(1);expect(read.mock.calls.flat().join()).not.toContain("players/");
  });
  it("reuses an already-probed index and still validates its publication context",async()=>{
    const read=vi.fn(async()=>month);
    await readMlbAllRecent(2025,"regular","2025-03-30",14,[{id:player,name:"選手",seasons:[2025],positions:[],teamIds:[team]}],index,"",read as Parameters<typeof readMlbAllRecent>[7],index);
    expect(read).toHaveBeenCalledExactlyOnceWith("exploration/recent/2025/2025-03.json");
    await expect(readMlbAllRecent(2025,"postseason","2025-03-30",14,[],index,"",read as Parameters<typeof readMlbAllRecent>[7],index)).rejects.toThrow("publication mismatch");expect(read).toHaveBeenCalledTimes(1);
  });
  it("includes up to three calendar shards for a 30-day window",()=>{const data={...index,firstDate:"2025-01-31",months:["2025-01","2025-02","2025-03"].map(month=>({month,rows:1,compressedBytes:1}))};expect(recentMonths(data,"2025-03-01",30)).toHaveLength(3);});
  it("shares date/window/scope and only canonical matchup identities",()=>{
    expect(portableRoute("/MLB/milestones","season=2025&role=pitching&metric=HLD")).not.toContain("metric=");
    const holds=canonicalDeepLink("baseballnotes://MLB/milestones?season=2025&role=pitching&metric=HLD");expect(holds).not.toContain("HLD");
    expect(portableRoute("/MLB/milestones", "season=2025&mode=achieved&metric=HR")).toContain("mode=achieved&metric=HR");
    const path=portableRoute("/MLB/data",`season=2025&period=14&asOfDate=2025-08-20&competition=postseason`)!;expect(path).toContain("asOfDate=2025-08-20");
    const matchup=portableRoute("/MLB/matchup",`batter=${player}&pitcher=not-canonical&season=2025&competition=postseason`)!;expect(matchup).toContain("batter=");expect(matchup).not.toContain("pitcher");expect(canonicalDeepLink(`https://tomoya41.github.io/baseball-notes/#${matchup}`)).toBe(matchup);
  });
});
