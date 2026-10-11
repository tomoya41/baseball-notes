import { z } from "zod";
import type { ExplorerValues } from "./data-explorer";
import { readableMetric } from "./data-explorer";
import { dateWindow } from "./mlb-historical-aggregate";
import { battingDailyKeys, pitchingDailyKeys } from "./mlb-recent-explorer";
import { mlbProductMetrics } from "./mlb-product-metrics";
import { battingDisplayRole, includesBattingRole, type BattingView } from "./player-display-role";

const count = z.number().int().nonnegative();
const playerId = z.string().regex(/^mlb:player:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
const teamId = z.string().regex(/^mlb:team:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
const envelope = { schemaVersion: z.literal(1), league: z.literal("MLB"), competitionType: z.enum(["regular", "postseason"]), season: z.number().int().min(2014).max(2025), sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/) };
const position = z.enum(["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"]);
export const formRoleSchema = z.object({ playerId, positions: z.array(position), positionDates: z.array(z.object({position,date:z.iso.date()})).max(10), battingRole: z.enum(["fielder", "dh", "pitcher", "unknown"]), twoWayEvidence: z.boolean(), twoWayEvidenceDate:z.iso.date().nullable() });
export const formIndexSchema = z.object({ ...envelope, firstDate: z.iso.date(), lastDate: z.iso.date(), coverage: z.enum(["complete", "partial", "unavailable"]), gameCount: count, roleSourceHash: z.string().regex(/^[a-f0-9]{64}$/), roles: z.array(formRoleSchema).max(2840), months: z.array(z.object({ month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/), compressedBytes: count, rows: count })).max(12) }).superRefine((p,c) => {
  if (!p.firstDate.startsWith(String(p.season)) || !p.lastDate.startsWith(String(p.season)) || p.firstDate > p.lastDate || new Set(p.roles.map(r=>r.playerId)).size !== p.roles.length || new Set(p.months.map(m=>m.month)).size !== p.months.length || p.months.some(m=>!m.month.startsWith(String(p.season))) || p.roles.some(r=>new Set(r.positionDates.map(v=>v.position)).size!==r.positions.length || r.positions.some(v=>!r.positionDates.some(d=>d.position===v)) || r.positionDates.some(v=>v.date<p.firstDate||v.date>p.lastDate) || r.battingRole!==battingDisplayRole(r.positions) || r.twoWayEvidence!==(r.twoWayEvidenceDate!==null) || (r.twoWayEvidenceDate!==null&&(r.twoWayEvidenceDate<p.firstDate||r.twoWayEvidenceDate>p.lastDate)))) c.addIssue({ code:"custom", message:"Invalid form index" });
});
export const formMonthSchema = z.object({ ...envelope, month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/), players: z.array(playerId).max(2840), teams: z.array(teamId).max(30), batting: z.array(z.array(count.nullable())).max(60000), starters: z.array(z.array(count.nullable())).max(20000), relievers: z.array(z.array(count.nullable())).max(20000), unknown: z.array(z.array(count.nullable())).max(20000) }).superRefine((p,c) => {
  if (!p.month.startsWith(String(p.season)) || new Set(p.players).size!==p.players.length || new Set(p.teams).size!==p.teams.length) c.addIssue({code:"custom",message:"Invalid form dictionary"});
  for (const category of ["batting","starters","relievers","unknown"] as const) {
    const seen=new Set<string>(), keys=category==="batting"?battingDailyKeys:pitchingDailyKeys;
    for(const r of p[category]) {
      const key=r.slice(0,3).join(":");
      if(r.length!==3+keys.length || r[0]==null || !z.iso.date().safeParse(`${p.month}-${String(r[0]).padStart(2,"0")}`).success || r[1]==null || r[1]>=p.players.length || r[2]==null || r[2]>=p.teams.length || r[3]==null || (category!=="batting"&&r[3]===0) || seen.has(key) || (category==="starters" && r[4]!==r[3]) || (category==="relievers" && r[4]!==0) || (category==="unknown" && r[4]!==null)) c.addIssue({code:"custom",message:"Invalid form aggregate/role"});
      seen.add(key);
    }
  }
});
export type FormIndex = z.infer<typeof formIndexSchema>;
export type FormMonth = z.infer<typeof formMonthSchema>;
export type FormCategory = "batting" | "starters" | "relievers";
export type FormMode = "hot" | "monthly" | "change" | "monthly-change";
export const isMonthlyForm = (mode:FormMode) => mode === "monthly" || mode === "monthly-change";
export const isFormComparison = (mode:FormMode) => mode === "change" || mode === "monthly-change";
export function formPlayerRole(index:FormIndex, playerId:string, asOf=index.lastDate) {
  const proof=index.roles.find(r=>r.playerId===playerId);
  return battingDisplayRole(proof?.positionDates.filter(p=>p.date<=asOf).map(p=>p.position)??[]);
}
export type FormEntry = { playerId:string; name:string; teamIds:string[]; metrics:ExplorerValues; rank:number; reason:string; change:"rising"|"stable"|"cooling"|"insufficient"; previous:number|null; delta:number|null; previousSample?:number|null };
export const FORM_POLICY = { batting: { sample:"PA", minimum: {7:20,14:40,30:80}, monthly:80 }, starters: { sample:"outsRecorded", minimum:{7:15,14:30,30:60}, monthly:60 }, relievers: { sample:"outsRecorded", minimum:{7:6,14:12,30:24}, monthly:24 } } as const;
export function formWindow(asOf:string, days:7|14|30, mode:FormMode) {
  if(!z.iso.date().safeParse(asOf).success) throw Error("Invalid Historical as-of date");
  const current=isMonthlyForm(mode)?{from:`${asOf.slice(0,7)}-01`,to:asOf}:dateWindow(asOf,days);
  const previousTo=new Date(`${current.from}T00:00:00Z`);previousTo.setUTCDate(previousTo.getUTCDate()-1);
  if (mode === "monthly-change") {
    // Completed months compare full calendar months. Mid-month compares through
    // the same day number, capped at the previous month's end. Only rates change.
    const monthEnd = new Date(Date.UTC(Number(asOf.slice(0,4)),Number(asOf.slice(5,7)),0)).getUTCDate();
    if (Number(asOf.slice(8)) !== monthEnd) previousTo.setUTCDate(Math.min(Number(asOf.slice(8)),previousTo.getUTCDate()));
    const to=previousTo.toISOString().slice(0,10);
    return {current,previous:{from:`${to.slice(0,7)}-01`,to}};
  }
  return {current,previous:dateWindow(previousTo.toISOString().slice(0,10),days)};
}
export function formMonths(index:FormIndex, asOf:string, days:7|14|30, mode:FormMode) {
  if(asOf<index.firstDate||asOf>index.lastDate)throw Error("Historical as-of outside saved scope");
  const {current,previous}=formWindow(asOf,days,mode),from=isFormComparison(mode)?previous.from:current.from;
  return index.months.filter(m=>m.month>=from.slice(0,7)&&m.month<=asOf.slice(0,7)).map(m=>m.month);
}
function aggregate(index:FormIndex, months:readonly FormMonth[], names:ReadonlyMap<string,string>, category:FormCategory, from:string,to:string) {
  const rows=new Map<string,{playerId:string;name:string;metrics:ExplorerValues;teamIds:Set<string>}>(), keys=category==="batting"?battingDailyKeys:pitchingDailyKeys;
  const known = new Set(index.roles.map(p=>p.playerId));
  for(const month of months) for(const r of month[category]) {
    const date=month.month+"-"+String(r[0]).padStart(2,"0");
    if(date<from||date>to)continue;
    const id=month.players[r[1]!]!;
    if(!names.has(id) || !known.has(id))throw Error("Unknown form identity");
    const row=rows.get(id)??{playerId:id,name:names.get(id)!,metrics:{},teamIds:new Set<string>()};
    keys.forEach((key,i)=>{const v=r[i+3]!,prior=row.metrics[key];const unknown=v===null||prior?.value===null;row.metrics[key]={value:unknown?null:(prior?.value??0)+v,status:unknown?"unavailable":"complete"};});
    row.teamIds.add(month.teams[r[2]!]!);rows.set(id,row);
  }
  for(const row of rows.values()){recalculate(row.metrics,category);row.metrics=mlbProductMetrics(row.metrics,category==="batting"?"batting":"pitching")!;}
  return [...rows.values()];
}
function recalculate(m:ExplorerValues, category:FormCategory) {
  const v=(k:string)=>readableMetric(m[k]),ratio=(key:string,n:number|null,d:number|null,scale=1)=>{m[key]={value:n!==null&&d!==null&&d>0?n*scale/d:null,status:n!==null&&d!==null&&d>0?"complete":"unavailable"};};
  if(category==="batting") {
    ratio("AVG",v("H"),v("AB"));
    const sum=(ks:string[])=>ks.every(k=>v(k)!==null)?ks.reduce((a,k)=>a+v(k)!,0):null;
    ratio("OBP",sum(["H","BB","HBP"]),sum(["AB","BB","HBP","SF"]));
    const bases=["H","2B","3B","HR"].every(k=>v(k)!==null)?v("H")!+v("2B")!+2*v("3B")!+3*v("HR")!:null;
    ratio("SLG",bases,v("AB"));m.OPS={value:v("OBP")!==null&&v("SLG")!==null?v("OBP")!+v("SLG")!:null,status:v("OBP")!==null&&v("SLG")!==null?"complete":"unavailable"};
  }else {ratio("ERA",v("ER"),v("outsRecorded"),27);ratio("K9",v("SO"),v("outsRecorded"),27);ratio("BB9",v("BB"),v("outsRecorded"),27);ratio("WHIP",v("H")!==null&&v("BB")!==null?v("H")!+v("BB")!:null,v("outsRecorded"),3);}
}
export function evaluateHistoricalForm(index:FormIndex, months:readonly FormMonth[], names:ReadonlyMap<string,string>, asOf:string,days:7|14|30,mode:FormMode,category:FormCategory, view:BattingView="standard") {
  const required=formMonths(index,asOf,days,mode),{current,previous}=formWindow(asOf,days,mode);
  if(months.length!==required.length || new Set(months.map(m=>m.month)).size!==months.length || required.some(m=>!months.some(p=>p.month===m)) || months.some(m=>m.sourceFingerprint!==index.sourceFingerprint||m.season!==index.season||m.competitionType!==index.competitionType))throw Error("Form generation/scope mismatch");
  const monthly=isMonthlyForm(mode),comparison=isFormComparison(mode);
  const policy=FORM_POLICY[category],minimum=monthly?policy.monthly:policy.minimum[days],metric=category==="batting"?"OPS":"ERA";
  const roles=new Map(index.roles.map(r=>[r.playerId,battingDisplayRole(r.positionDates.filter(p=>p.date<=asOf).map(p=>p.position))]));
  const rows=aggregate(index,months,names,category,current.from,current.to), old=comparison?aggregate(index,months,names,category,previous.from,previous.to):[];
  const previousRows=new Map(old.map(r=>[r.playerId,r.metrics]));
  const value=(m:ExplorerValues,k:string)=>readableMetric(m[k]);
  const enough=(m:ExplorerValues)=>index.coverage==="complete" && value(m,policy.sample)!==null && value(m,policy.sample)!>=minimum && value(m,metric)!==null && (category!=="batting" || ["HR","H"].every(k=>value(m,k)!==null)) && (category==="batting" || (value(m,"K9")!==null && value(m,"G")!>=(category==="starters"?Math.ceil((monthly?28:days)/7):Math.ceil((monthly?28:days)/7)*2)));
  const entries:FormEntry[]=rows.flatMap(row=>{
    const metrics=row.metrics;
    if(category==="batting"&&!includesBattingRole(roles.get(row.playerId),view))return [];
    if(!comparison&&!enough(metrics))return [];
    const prior=previousRows.get(row.playerId);
    const before=prior&&enough(prior)?value(prior,metric):null, after=value(metrics,metric);
    const delta=before!==null&&after!==null?after-before:null, qualified=enough(metrics)&&before!==null;
    const improvement=delta===null?0:category==="batting"?delta:-delta, threshold=category==="batting"?.1:1;
    const change=!qualified?"insufficient":improvement>=threshold?"rising":improvement<=-threshold?"cooling":"stable";
    const teams=[...row.teamIds];
    return [{playerId:row.playerId,name:row.name,teamIds:teams,metrics,rank:0,previous:before,previousSample:prior?value(prior,policy.sample):null,delta:qualified?delta:null,change:change as FormEntry["change"],reason:category==="batting"?`OPS ${after?.toFixed(3)??"—"} · ${value(metrics,"PA")??"—"}打席 · ${value(metrics,"HR")??"—"}本塁打`:`防御率 ${after?.toFixed(2)??"—"} · ${value(metrics,"G")??"—"}登板 · K/9 ${value(metrics,"K9")?.toFixed(1)??"—"}`}];
  });
  entries.sort((a,b)=>{
    if(comparison){
      const order={rising:0,cooling:1,stable:2,insufficient:3};
      const diff=order[a.change]-order[b.change];if(diff)return diff;
      if(a.delta!==null&&b.delta!==null&&a.delta!==b.delta){
        const improvementOrder=category==="batting"?b.delta-a.delta:a.delta-b.delta;
        return a.change==="cooling"?-improvementOrder:improvementOrder;
      }
    }
    const keys=category==="batting"?["OPS","PA","HR","H"]:["ERA","K9",category==="starters"?"outsRecorded":"G","outsRecorded"];
    for(const k of keys){const av=value(a.metrics,k),bv=value(b.metrics,k);if(av===null&&bv!==null)return 1;if(av!==null&&bv===null)return -1;if(av!==null&&bv!==null&&av!==bv)return k==="ERA"?av-bv:bv-av;}
    return a.playerId.localeCompare(b.playerId);
  });
  entries.forEach((e,i)=>e.rank=i+1);
  const monthEnd=new Date(Date.UTC(Number(asOf.slice(0,4)),Number(asOf.slice(5,7)),0)).getUTCDate();
  const unknownRoleRows=months.reduce((n,m)=>n+m.unknown.filter(r=>{const date=`${m.month}-${String(r[0]).padStart(2,"0")}`;return date>=current.from&&date<=current.to||comparison&&date>=previous.from&&date<=previous.to;}).length,0);
  const ready=index.coverage==="complete" && (category==="batting"||unknownRoleRows===0) && (!monthly||index.competitionType==="regular");
  return {entries:ready?entries:[],from:current.from,to:current.to,previous,minimum,metric,coverage:ready?"complete":"partial",monthlyComplete:Number(asOf.slice(8))===monthEnd,unknownRoleRows};
}
