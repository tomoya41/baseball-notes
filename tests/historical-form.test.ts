import { describe,it,expect } from "vitest";
import { historicalId, type HistoricalGame, type HistoricalBatter, type HistoricalPitcher } from "../src/data/mlb-historical";
import { buildFormMonths, buildFormRoles } from "../scripts/generate-historical-form";
import { zipSync,strToU8 } from "fflate";
import { evaluateHistoricalForm, formIndexSchema, formMonthSchema, formMonths, formPlayerRole, formWindow } from "../src/domain/historical-form";
import { battingDisplayRole, includesBattingRole } from "../src/domain/player-display-role";
import { battingAggregate, pitchingAggregate } from "../src/domain/mlb-historical-aggregate";
import { readHistoricalForm } from "../src/application/historical-form";
import { formWatchObservations } from "../src/application/form-watch";
import { emptyWatchState,evaluateWatch } from "../src/domain/personal-watch";
import { canonicalDeepLink } from "../src/domain/native-navigation";
import { portableRoute } from "../src/domain/product-sharing";
import { validStaticPayload } from "../src/domain/mlb-historical-public";

const id=historicalId("player","one"),other=historicalId("player","two"),team=historicalId("team","one"),away=historicalId("team","two");
const batter=(playerId=id, hits=2,pa=4):HistoricalBatter=>({playerId,teamId:team,battingOrder:1,appearanceOrder:1,starter:true,pa,ab:pa,runs:1,hits,doubles:0,triples:0,homeRuns:0,rbi:1,bb:0,hbp:0,sh:0,sf:0,so:1,sb:0,cs:0});
const pitcher=(role:"starter"|"reliever"|"unknown"="starter",outs=18,er=0):HistoricalPitcher=>({playerId:id,teamId:team,role,appearanceOrder:1,outsRecorded:outs,bf:24,hits:3,homeRuns:0,bb:1,hbp:1,so:6,runs:er,er,pitchCount:null,win:false,loss:false,save:false,hold:null});
function fixture(days=31,competition:"regular"|"postseason"="regular") {
  const games:HistoricalGame[]=Array.from({length:days},(_,i)=>({id:historicalId("game",String(i)),season:2024,date:`2024-08-${String(i+1).padStart(2,"0")}`,homeTeamId:team,awayTeamId:away,homeRuns:1,awayRuns:0,innings:9,number:0,batting:[batter(),batter(other)],pitching:[pitcher()],validationIssues:[],...(competition==="postseason"?{competitionType:competition}: {})}));
  const months=buildFormMonths(games.map(game=>({game,hash:"a".repeat(64)})),competition,2024);
  const index=formIndexSchema.parse({schemaVersion:1,league:"MLB",competitionType:competition,season:2024,sourceFingerprint:months[0]!.sourceFingerprint,roleSourceHash:"b".repeat(64),firstDate:"2024-08-01",lastDate:`2024-08-${String(days).padStart(2,"0")}`,gameCount:days,coverage:"complete",roles:[id,other].map(playerId=>({playerId,positions:["DH"],positionDates:[{position:"DH",date:"2024-08-01"}],battingRole:"dh",twoWayEvidence:false,twoWayEvidenceDate:null})),months:[{month:"2024-08",compressedBytes:123,rows:93}]});
  const names=new Map([[id,"選手A"],[other,"選手B"]]);return {games,months,index,names};
}
describe("Historical form evaluation",()=>{
  it("uses dated fielding/DH evidence and does not infer two-way status from a cameo",()=>{
    const f=fixture(),retro="proof",uuid="proof-uuid",pid=historicalId("player",`chadwick:${uuid}`);
    const source=(n:number)=>`TST202408${String(n).padStart(2,"0")}0`;
    f.games.forEach((g,i)=>{g.id=historicalId("game",source(i+1));g.batting=[{...g.batting[0]!,playerId:pid}];g.pitching=[{...g.pitching[0]!,playerId:pid,outsRecorded:i<4?18:0}];});
    const csv=(dh:boolean)=>zipSync({"2024fielding.csv":strToU8(`gid,id,stattype,d_pos\n${source(1)},${retro},value,1\n`),"2024batting.csv":strToU8(`gid,id,stattype,dh,b_seq,b_pa\n`+f.games.map((_,i)=>`${source(i+1)},${retro},value,${dh?1:0},1,4`).join("\n"))});
    const roles=buildFormRoles(csv(true),2024,new Map([[retro,uuid]]),f.games);
    expect(roles[0]!.twoWayEvidenceDate).toBe("2024-08-20");expect(roles[0]!.battingRole).toBe("dh");
    expect(buildFormRoles(csv(false),2024,new Map([[retro,uuid]]),f.games)[0]!.twoWayEvidence).toBe(false);
    f.games.forEach(g=>g.pitching[0]!.outsRecorded=0);expect(buildFormRoles(csv(true),2024,new Map([[retro,uuid]]),f.games)[0]!.twoWayEvidence).toBe(false);
    expect(()=>buildFormRoles(csv(true),2024,new Map(),f.games)).toThrow("Unresolved");
  });
  it.each([7,14,30] as const)("uses an exact %i day window without future Facts",days=>{
    const f=fixture(),r=evaluateHistoricalForm(f.index,f.months,f.names,"2024-08-30",days,"hot","batting");
    expect(r.entries).toHaveLength(2);expect(r.entries[0]!.metrics.PA!.value).toBe(days*4);expect(r.to).toBe("2024-08-30");
    const reference=battingAggregate(id,f.games.map(g=>({...g.batting[0]!,date:g.date,gameId:g.id,season:g.season,home:true,opponentTeamId:away})),r.from,r.to);
    for(const metric of ["PA","H","AVG","OBP","SLG","OPS"] as const)expect(r.entries.find(e=>e.playerId===id)!.metrics[metric]!.value).toBe(reference.metrics[metric]!.value);
  });
  it("counts all 31 calendar days, labels mid-month and enforces monthly samples",()=>{
    const f=fixture();expect(evaluateHistoricalForm(f.index,f.months,f.names,"2024-08-31",7,"monthly","batting").entries[0]!.metrics.PA!.value).toBe(124);
    expect(evaluateHistoricalForm(f.index,f.months,f.names,"2024-08-31",7,"monthly","batting").monthlyComplete).toBe(true);
    expect(evaluateHistoricalForm(f.index,f.months,f.names,"2024-08-15",7,"monthly","batting").entries).toEqual([]);
    expect(evaluateHistoricalForm(f.index,f.months,f.names,"2024-08-25",7,"monthly","batting").monthlyComplete).toBe(false);
  });
  it("keeps same-day mixed-role appearances separate, including a zero-out relief",()=>{
    const f=fixture();f.games[30]!.pitching=[pitcher("starter",18,0),pitcher("reliever",0,3)];
    // Different doubleheader Games; duplicate same-game Facts remain invalid.
    const last=f.games[30]!;last.pitching=[pitcher("starter",18,0)];f.games.push({...last,id:historicalId("game","doubleheader"),number:2,pitching:[pitcher("reliever",0,3)]});
    f.games[29]!.pitching=[pitcher("reliever",6,0)];f.games[28]!.pitching=[pitcher("reliever",6,0)];
    const months=buildFormMonths(f.games.map(game=>({game,hash:"a".repeat(64)})),"regular",2024),index={...f.index,sourceFingerprint:months[0]!.sourceFingerprint};
    const starter=evaluateHistoricalForm(index,months,f.names,"2024-08-31",7,"hot","starters").entries[0]!;
    const relief=evaluateHistoricalForm(index,months,f.names,"2024-08-31",7,"hot","relievers").entries[0]!;
    expect(starter.metrics.G!.value).toBe(5);expect(starter.metrics.ER!.value).toBe(0);expect(relief.metrics.G!.value).toBe(3);expect(relief.metrics.ER!.value).toBe(3);expect(relief.metrics.ERA!.value).toBe(6.75);
    const rows=f.games.flatMap(g=>g.pitching.filter(p=>p.role==="reliever").map(p=>({...p,date:g.date,gameId:g.id,season:g.season,home:true,opponentTeamId:away})));
    const expected=pitchingAggregate(id,rows,"2024-08-25","2024-08-31");expect(relief.metrics.ERA!.value).toBe(expected.metrics.ERA!.value);
  });
  it("does not rank incomplete coverage, missing metrics, unknown roles or zero innings",()=>{
    const f=fixture();expect(evaluateHistoricalForm({...f.index,coverage:"partial"},f.months,f.names,"2024-08-31",7,"hot","batting").entries).toEqual([]);
    for(const g of f.games)g.pitching=[pitcher("unknown")];let months=buildFormMonths(f.games.map(game=>({game,hash:"a".repeat(64)})),"regular",2024);let index={...f.index,sourceFingerprint:months[0]!.sourceFingerprint};expect(evaluateHistoricalForm(index,months,f.names,"2024-08-31",7,"hot","starters").coverage).toBe("partial");
    for(const g of f.games)g.pitching=[pitcher("reliever",0)];months=buildFormMonths(f.games.map(game=>({game,hash:"a".repeat(64)})),"regular",2024);index={...f.index,sourceFingerprint:months[0]!.sourceFingerprint};expect(evaluateHistoricalForm(index,months,f.names,"2024-08-31",7,"hot","relievers").entries).toEqual([]);
    const broken=structuredClone(f.months);for(const r of broken[0]!.batting)r[10]=null;expect(evaluateHistoricalForm(f.index,broken,f.names,"2024-08-31",7,"hot","batting").entries).toEqual([]);
  });
  it("suppresses pitching changes when the previous window contains unknown roles",()=>{const f=fixture();f.games[20]!.pitching=[pitcher("unknown")];const months=buildFormMonths(f.games.map(game=>({game,hash:"a".repeat(64)})),"regular",2024);const index={...f.index,sourceFingerprint:months[0]!.sourceFingerprint};expect(evaluateHistoricalForm(index,months,f.names,"2024-08-31",7,"change","starters").coverage).toBe("partial");});
  it("is deterministic including exact ties and reversed input order",()=>{
    const f=fixture(),a=evaluateHistoricalForm(f.index,f.months,f.names,"2024-08-31",7,"hot","batting");
    f.months[0]!.batting.reverse();expect(evaluateHistoricalForm(f.index,f.months,f.names,"2024-08-31",7,"hot","batting").entries).toEqual(a.entries);expect(a.entries.map(e=>e.playerId)).toEqual([id,other].sort());
  });
  it("retains a player with legitimate appearances for both teams in one resumed Game",()=>{
    const f=fixture(1);f.games[0]!.batting.push({...batter(),teamId:away});
    const m=buildFormMonths(f.games.map(game=>({game,hash:"a".repeat(64)})),"regular",2024);
    expect(m[0]!.batting.filter(r=>m[0]!.players[r[1]!]===id)).toHaveLength(2);
    expect(m[0]!.batting.filter(r=>m[0]!.players[r[1]!]===id).reduce((n,r)=>n+r[3]!,0)).toBe(1);
    f.games[0]!.batting.push({...batter(),teamId:away});expect(()=>buildFormMonths(f.games.map(game=>({game,hash:"a".repeat(64)})),"regular",2024)).toThrow("Duplicate");
  });
  it("compares adjacent equal windows; no appearance cannot become Cooling",()=>{
    const f=fixture();for(const g of f.games){g.batting=[batter(id,Number(g.date.slice(8))>=25?3:1),batter(other,Number(g.date.slice(8))>=25?0:2)];}
    const months=buildFormMonths(f.games.map(game=>({game,hash:"a".repeat(64)})),"regular",2024),index={...f.index,sourceFingerprint:months[0]!.sourceFingerprint};const r=evaluateHistoricalForm(index,months,f.names,"2024-08-31",7,"change","batting");
    expect(r.entries.find(e=>e.playerId===id)!.change).toBe("rising");expect(r.entries.find(e=>e.playerId===other)!.change).toBe("cooling");expect(r.previous.to).toBe("2024-08-24");
    expect(evaluateHistoricalForm(index,months,f.names,"2024-08-06",7,"change","batting").entries.every(e=>e.change==="insufficient")).toBe(true);
    for(const g of f.games)if(g.date>="2024-08-25")g.batting=g.batting.filter(p=>p.playerId!==other);
    const absent=buildFormMonths(f.games.map(game=>({game,hash:"a".repeat(64)})),"regular",2024);expect(evaluateHistoricalForm({...index,sourceFingerprint:absent[0]!.sourceFingerprint},absent,f.names,"2024-08-31",7,"change","batting").entries.some(e=>e.playerId===other)).toBe(false);
  });
  it("separates Postseason; calendar MVP is not admitted",()=>{
    const f=fixture(31,"postseason");expect(evaluateHistoricalForm(f.index,f.months,f.names,"2024-08-31",7,"monthly","batting").entries).toEqual([]);
    expect(()=>evaluateHistoricalForm({...f.index,competitionType:"regular"},f.months,f.names,"2024-08-31",7,"hot","batting")).toThrow("scope");
  });
  it("rejects malformed, duplicate, stale-generation or missing shards and unknown identity",()=>{
    const f=fixture();expect(formMonthSchema.safeParse({...f.months[0],batting:[...f.months[0]!.batting,f.months[0]!.batting[0]]}).success).toBe(false);
    expect(()=>evaluateHistoricalForm(f.index,[],f.names,"2024-08-31",7,"hot","batting")).toThrow();
    expect(()=>evaluateHistoricalForm(f.index,f.months,new Map(),"2024-08-31",7,"hot","batting")).toThrow("identity");
    expect(()=>formMonths(f.index,"2026-08-31",7,"hot")).toThrow();expect(()=>formWindow("2024-02-30",7,"hot")).toThrow();
    expect(validStaticPayload("exploration/form/2024/index.json",f.index)).toBe(true);expect(validStaticPayload("postseason/exploration/form/2024/index.json",f.index)).toBe(false);
  });
  it("reads only bounded monthly aggregates, never player profiles or PA",async()=>{
    const f=fixture(),paths:string[]=[];const read=async<T>(path:string):Promise<T>=>{paths.push(path);return f.months[0] as T;};
    const r=await readHistoricalForm({index:f.index,asOf:"2024-08-31",days:7,mode:"hot",category:"batting",names:f.names,view:"standard"},read);expect(r.fetches).toBe(1);expect(paths).toEqual(["exploration/form/2024/2024-08.json"]);
  });
});
describe("Season roles and Historical Watch",()=>{
  it("keeps unknowns, ordinary pitcher batting and DH without pitching, never treats one outing as two-way",()=>{
    expect(battingDisplayRole(["P"])).toBe("pitcher");expect(battingDisplayRole(["P","DH"])).toBe("dh");expect(battingDisplayRole(["RF","P"])).toBe("fielder");expect(battingDisplayRole([])).toBe("unknown");expect(includesBattingRole("unknown","standard")).toBe(true);expect(includesBattingRole("pitcher","standard")).toBe(false);expect(includesBattingRole("pitcher","pitchers")).toBe(true);
    const f=fixture();f.index.roles[0]!.positionDates=[{position:"P",date:"2024-08-02"},{position:"DH",date:"2024-08-25"}];expect(formPlayerRole(f.index,id,"2024-08-20")).toBe("pitcher");expect(formPlayerRole(f.index,id,"2024-08-31")).toBe("dh");expect(formPlayerRole(f.index,id,"2024-08-01")).toBe("unknown");
    expect(formPlayerRole(fixture().index,id)).toBe("dh");
  });
  it("baselines, deduplicates and never turns Historical membership into a live event",()=>{
    const f=fixture(),now=Date.parse("2026-10-11T00:00:00Z"),fav=[{league:"MLB",kind:"player",entityId:id}] as Parameters<typeof formWatchObservations>[6];
    const initial=formWatchObservations(f.index,"2024-08-20",7,"hot","batting",[],fav,now);let state=emptyWatchState();state.preferences.recent=true;state=evaluateWatch(state,initial,now);expect(state.alerts).toEqual([]);
    const result=evaluateHistoricalForm(f.index,f.months,f.names,"2024-08-31",7,"hot","batting"),next=formWatchObservations(f.index,"2024-08-31",7,"hot","batting",result.entries,fav,now);
    state=evaluateWatch(state,next,now);expect(state.alerts).toHaveLength(1);expect(state.alerts[0]!.title).toContain("Historical");expect(evaluateWatch(state,next,now).alerts).toHaveLength(1);expect(evaluateWatch(state,initial,now).observations[0]!.effectiveDate).toBe("2024-08-31");
    expect(canonicalDeepLink(`baseballnotes://MLB/form?season=2024&mode=monthly&asOfDate=2024-08-31`)).toContain("mode=monthly");expect(portableRoute("/NPB/form")).toBe(null);
  });
});
