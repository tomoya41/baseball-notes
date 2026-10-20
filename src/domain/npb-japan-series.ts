import { z } from "zod";
import { seriesSchema } from "./competition";
import { csSourceSchema } from "./npb-cs-observations";
import type { NpbPostseasonSeries } from "./npb-postseason-series";
import { dateInZone } from "./analysis-query";

export const npbJapanSeriesSchema = z.strictObject({
  schemaVersion: z.literal(1), league: z.literal("NPB"), season: z.literal(2026), competition: z.literal("postseason"),
  provider: z.literal("Wikipedia"), license: z.literal("CC-BY-SA-4.0"), coverage: z.literal("partial"), observedAt: z.iso.datetime(),
  sources: z.array(csSourceSchema).length(2), csSeriesBodySha256: z.string().regex(/^[a-f0-9]{64}$/),
  series: seriesSchema, venues: z.record(z.string(), z.string().min(1).max(80)),
  results: z.array(z.strictObject({ gameId: z.string(), awayInnings: z.array(z.number().int().nonnegative()).min(9).max(30), homeInnings: z.array(z.number().int().nonnegative()).min(9).max(30), durationMinutes: z.number().int().positive() })).max(15),
  playerStats: z.literal("unavailable"), transformation: z.string().min(1),
}).superRefine((d,c)=>{
  const s=d.series, results=new Map(d.results.map(r=>[r.gameId,r])),asOf=dateInZone(Date.parse(d.observedAt),"Asia/Tokyo");
  if(s.league!=="NPB"||s.season!==2026||s.round!=="japan_series"||s.bestOf!==7||s.winsRequired!==4||s.teams.some(t=>t.advantageWins!==0||t.playedWins>4)||s.clinched!==s.teams.some(t=>t.playedWins===4)||s.games.length<1||s.games.length>15||s.effectiveDate>asOf||d.sources.some(p=>p.revisionAt>d.observedAt)||new Set(d.sources.map(p=>p.pageId)).size!==2||results.size!==d.results.length||Object.keys(d.venues).length!==s.games.length)
    c.addIssue({code:"custom",message:"Invalid Japan Series scope/source/rule"});
  for(const g of s.games){const r=results.get(g.gameId);
    const invalidResult=g.status==="final" ? !r||g.date>asOf||r.awayInnings.length!==r.homeInnings.length||r.awayInnings.reduce((a,b)=>a+b,0)!==g.awayRuns||r.homeInnings.reduce((a,b)=>a+b,0)!==g.homeRuns : !!r||g.homeRuns!==null||g.awayRuns!==null;
    if(!d.venues[g.gameId]||invalidResult)
      c.addIssue({code:"custom",message:"Japan Series result requires independent innings and completion evidence"});
  }
  if(d.results.some(r=>!s.games.some(g=>g.gameId===r.gameId&&g.status==="final")))c.addIssue({code:"custom",message:"Orphan Japan Series evidence"});
});
export type NpbJapanSeries = z.infer<typeof npbJapanSeriesSchema>;
export function assertJapanSeriesAdvancement(japan:NpbJapanSeries,cs:NpbPostseasonSeries){
  const winners=cs.series.filter(s=>s.round==="npb_cs_final").map(s=>s.winnerId).sort();
  if(JSON.stringify(winners)!==JSON.stringify(japan.series.teams.map(t=>t.teamId).sort()))throw Error("Japan Series/CS advancement identity mismatch");
}
