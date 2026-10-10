import { z } from "zod";
import type { ExplorerValues, ExplorerRow } from "./data-explorer";
import { mlbProductMetrics } from "./mlb-product-metrics";
import { dateWindow } from "./mlb-historical-aggregate";

export const battingDailyKeys = ["G", "PA", "AB", "R", "H", "2B", "3B", "HR", "RBI", "BB", "HBP", "SH", "SF", "SO", "SB", "CS"] as const;
export const pitchingDailyKeys = ["G", "GS", "outsRecorded", "BF", "H", "HR", "BB", "HBP", "SO", "R", "ER", "W", "L", "SV"] as const;
const count = z.number().int().nonnegative(), nullable = count.nullable();
const envelope = { schemaVersion: z.literal(1), league: z.literal("MLB"), competitionType: z.enum(["regular", "postseason"]), season: z.number().int().min(2016).max(2025), sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/) };
const canonical = (kind: string) => z.string().regex(new RegExp(`^mlb:${kind}:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`));
const tuple = z.array(nullable);
export const recentMonthSchema = z.object({ ...envelope, month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/), players: z.array(canonical("player")).max(2840), teams: z.array(canonical("team")).max(30),
  batting: z.array(tuple).max(60000), pitching: z.array(tuple).max(20000) }).superRefine((p,c) => {
    if (Number(p.month.slice(0,4)) !== p.season || new Set(p.players).size !== p.players.length || new Set(p.teams).size !== p.teams.length) c.addIssue({code:"custom",message:"Dictionary/season mismatch"});
    for (const [rows, keys] of [[p.batting, battingDailyKeys], [p.pitching, pitchingDailyKeys]] as const) {
      const seen = new Set<string>();
      for (const r of rows) {
        const [day,player,team] = r, date = `${p.month}-${String(day).padStart(2,"0")}`;
        const key = r.slice(0,3).join(":");
        if (r.length !== keys.length+3 || day === null || !z.iso.date().safeParse(date).success || player === null || player === undefined || player >= p.players.length || team === null || team === undefined || team >= p.teams.length || seen.has(key) || r[3] === null || r[3] === 0) c.addIssue({code:"custom",message:"Invalid daily aggregate"});
        seen.add(key);
      }
    }
  });
export const recentIndexSchema = z.object({ ...envelope, firstDate: z.iso.date(), lastDate: z.iso.date(), coverage: z.enum(["complete","partial","unavailable"]), gameCount: count,
  months: z.array(z.object({ month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/), compressedBytes: count, rows: count })).max(12) }).superRefine((p,c)=>{
    if (!p.firstDate.startsWith(String(p.season)) || !p.lastDate.startsWith(String(p.season)) || p.firstDate>p.lastDate || new Set(p.months.map(m=>m.month)).size!==p.months.length || p.months.some(m=>!m.month.startsWith(String(p.season)))) c.addIssue({code:"custom",message:"Invalid recent index"});
  });
export type RecentMonth = z.infer<typeof recentMonthSchema>;
export type RecentIndex = z.infer<typeof recentIndexSchema>;

export function recentMonths(index: RecentIndex, asOf: string, days: 7|14|30) {
  if (!z.iso.date().safeParse(asOf).success || asOf < index.firstDate || asOf > index.lastDate) throw Error("Historical as-of date is outside the saved scope");
  const {from,to} = dateWindow(asOf,days);
  return index.months.filter(m=>m.month >= from.slice(0,7) && m.month<=to.slice(0,7)).map(m=>m.month);
}
export function foldRecent(index: RecentIndex, months: readonly RecentMonth[], names: ReadonlyMap<string,string>, asOf: string, days:7|14|30, teamId = ""): ExplorerRow[] {
  const required=recentMonths(index,asOf,days), {from,to}=dateWindow(asOf,days);
  if (months.length!==required.length || new Set(months.map(m=>m.month)).size!==months.length || required.some(m=>!months.some(p=>p.month===m)) || months.some(m=>m.sourceFingerprint!==index.sourceFingerprint || m.season!==index.season || m.competitionType!==index.competitionType)) throw Error("Recent generation/scope mismatch");
  const rows=new Map<string,ExplorerRow>();
  for (const month of months) for (const role of ["batting","pitching"] as const) {
    const keys=role==="batting"?battingDailyKeys:pitchingDailyKeys;
    for (const r of month[role]) {
      const date=`${month.month}-${String(r[0]).padStart(2,"0")}`, id=month.players[r[1]!]!, team=month.teams[r[2]!]!;
      if (!names.has(id)) throw Error("Recent identity absent from Directory");
      if (date<from || date>to || (teamId && team!==teamId)) continue;
      const row=rows.get(id) ?? {playerId:id,name:names.get(id)!,teamId:teamId||null,batting:null,pitching:null};
      const totals=row[role] ?? {};
      keys.forEach((k,i)=>{const v=r[i+3]!, prior=totals[k]; totals[k]={value:v===null || prior?.value===null ? null:(prior?.value??0)+v,status:v===null || prior?.status==="unavailable"?"unavailable":"complete"};});
      row[role]=totals;rows.set(id,row);
    }
  }
  const ratio=(m:ExplorerValues,key:string,parts:string[],denom:string[],scale=1)=>{
    const complete=[...parts,...denom].every(k=>m[k]?.status==="complete" && m[k]?.value!==null);
    const d=denom.reduce((n,k)=>n+(m[k]?.value??0),0);
    m[key]={value:complete&&d>0?parts.reduce((n,k)=>n+(m[k]?.value??0),0)*scale/d:null,status:complete&&d>0?"complete":"unavailable"};
  };
  for (const row of rows.values()) {
    const b=row.batting,p=row.pitching;
    if(b){ratio(b,"AVG",["H"],["AB"]);ratio(b,"OBP",["H","BB","HBP"],["AB","BB","HBP","SF"]);
      const fields=["H","2B","3B","HR","AB"],known=fields.every(k=>b[k]?.status==="complete"&&b[k]?.value!==null),ab=b.AB?.value??0;
      b.SLG={value:known&&ab>0?(b.H!.value!+b["2B"]!.value!+2*b["3B"]!.value!+3*b.HR!.value!)/ab:null,status:known&&ab>0?"complete":"unavailable"};
      b.OPS={value:b.OBP!.value!==null&&b.SLG.value!==null?b.OBP!.value+b.SLG.value:null,status:b.SLG.status==="complete"&&b.OBP!.status==="complete"?"complete":"unavailable"};
    }
    if(p){ratio(p,"ERA",["ER"],["outsRecorded"],27);ratio(p,"K9",["SO"],["outsRecorded"],27);p.appearances=p.G!;}
    row.batting=mlbProductMetrics(b,"batting");row.pitching=mlbProductMetrics(p,"pitching");
  }
  return [...rows.values()].sort((a,b)=>a.playerId.localeCompare(b.playerId));
}
