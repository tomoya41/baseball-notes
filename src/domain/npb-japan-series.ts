import { z } from "zod";
import { seriesSchema } from "./competition";
import { csSourceSchema } from "./npb-cs-observations";
import type { NpbPostseasonSeries } from "./npb-postseason-series";
import { dateInZone } from "./analysis-query";

export const npbJapanSeriesSchema = z.strictObject({
  schemaVersion: z.literal(1), league: z.literal("NPB"), season: z.literal(2026), competition: z.literal("postseason"),
  provider: z.literal("Wikipedia"), license: z.literal("CC-BY-SA-4.0"), coverage: z.literal("partial"), observedAt: z.iso.datetime(),
  sources: z.array(csSourceSchema).length(2), csSeriesBodySha256: z.string().regex(/^[a-f0-9]{64}$/),
  review: z.strictObject({ reviewedBy:z.string().min(1).max(80), reviewedAt:z.iso.datetime() }).optional(),
  series: seriesSchema, venues: z.record(z.string(), z.string().min(1).max(80)),
  results: z.array(z.strictObject({ gameId: z.string(), awayInnings: z.array(z.number().int().nonnegative()).min(9).max(30), homeInnings: z.array(z.number().int().nonnegative()).min(9).max(30), durationMinutes: z.number().int().positive(), homeLastInning:z.enum(["completed","not_played","walk_off"]).optional(), sourcePageId:z.number().int().positive().optional(), evidenceSha256:z.string().regex(/^[a-f0-9]{64}$/).optional() })).max(15),
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
  if(s.games.some((g,i)=>g.status==="suspended"||i>0&&g.date<=s.games[i-1]!.date))
    c.addIssue({code:"custom",message:"Japan Series requires ordered observed dates and does not use suspended games"});
  for(const g of s.games.filter(g=>g.gameNumber>=8)){
    const previous=s.games.filter(p=>p.gameNumber<g.gameNumber);
    if(previous.some(p=>p.status!=="final")||!previous.some(p=>p.winnerId===null)||s.teams.some(t=>previous.filter(p=>p.winnerId===t.teamId).length>=4))
      c.addIssue({code:"custom",message:"Additional Japan Series Game requires seven or more reviewed finals, a tie and no prior clinch"});
    if(g.status==="final"&&g.winnerId===null)
      c.addIssue({code:"custom",message:"Japan Series Game eight onward cannot finish as an innings-limit tie"});
    const seventh=s.games[6],last=previous.at(-1);
    const home=g.gameNumber===8?seventh?.homeTeamId:seventh?.awayTeamId,away=g.gameNumber===8?seventh?.awayTeamId:seventh?.homeTeamId;
    const homeVenues=new Set(previous.filter(p=>p.gameNumber<=7&&p.homeTeamId===home).map(p=>d.venues[p.gameId]));
    if(g.gameNumber===8&&(!seventh||g.homeTeamId!==home||g.awayTeamId!==away||d.venues[g.gameId]!==d.venues[seventh.gameId])||g.gameNumber===9&&(!last||g.homeTeamId!==home||g.awayTeamId!==away||homeVenues.size!==1||!homeVenues.has(d.venues[g.gameId])||Date.parse(g.date)-Date.parse(last.date)<2*86400000))
      c.addIssue({code:"custom",message:"Additional Japan Series venue/travel-day evidence violates the reviewed rules"});
  }
  if(d.results.some(r=>!s.games.some(g=>g.gameId===r.gameId&&g.status==="final")))c.addIssue({code:"custom",message:"Orphan Japan Series evidence"});
  if(d.results.length&&(!d.review||Date.parse(d.review.reviewedAt)<Date.parse(d.observedAt)))c.addIssue({code:"custom",message:"Results require review after acquisition"});
  for(const r of d.results){const g=s.games.find(g=>g.gameId===r.gameId);
    let away=0,home=0;
    for(let i=0;i<r.awayInnings.length-1;i++){
      away+=r.awayInnings[i]!;home+=r.homeInnings[i]!;
      if(i>=8&&away!==home)c.addIssue({code:"custom",message:"Extra inning cannot follow an already decided completed inning"});
    }
    if(r.sourcePageId!==5306035||!d.sources.some(p=>p.pageId===r.sourcePageId)||!r.evidenceSha256||!r.homeLastInning||r.homeLastInning!=="completed"&&(!g||g.homeRuns!<=g.awayRuns!||r.homeLastInning==="not_played"&&r.homeInnings.at(-1)!==0)||g&&g.gameNumber<=7&&(r.awayInnings.length>12||g.homeRuns===g.awayRuns&&r.awayInnings.length!==12))c.addIssue({code:"custom",message:"Invalid final half-inning or source evidence"});
    if(r.homeLastInning==="walk_off"&&(!r.homeInnings.at(-1)||g&&g.homeRuns!-r.homeInnings.at(-1)!>g.awayRuns!))c.addIssue({code:"custom",message:"Invalid walk-off inning"});
    if(g&&g.homeRuns!>g.awayRuns!&&r.homeLastInning==="completed")c.addIssue({code:"custom",message:"Home win requires explicit X or walk-off evidence"});
  }
  const clinchIndex=s.games.findIndex((_,i)=>s.teams.some(t=>s.games.slice(0,i+1).filter(g=>g.winnerId===t.teamId).length===4));
  if(clinchIndex>=0&&s.games.slice(clinchIndex+1).some(g=>g.status==="final"))c.addIssue({code:"custom",message:"Played Game after four-win clinch"});
});
export type NpbJapanSeries = z.infer<typeof npbJapanSeriesSchema>;
export function assertJapanSeriesAdvancement(japan:NpbJapanSeries,cs:NpbPostseasonSeries){
  const winners=cs.series.filter(s=>s.round==="npb_cs_final").map(s=>s.winnerId).sort();
  if(JSON.stringify(winners)!==JSON.stringify(japan.series.teams.map(t=>t.teamId).sort()))throw Error("Japan Series/CS advancement identity mismatch");
}

/** Ordinary updates append confirmed results, never rewrite a prior final or reassign its identity. */
export function assertJapanSeriesAdvance(previous:NpbJapanSeries,next:NpbJapanSeries){
  if(next.series.id!==previous.series.id||next.csSeriesBodySha256!==previous.csSeriesBodySha256||Date.parse(next.observedAt)<Date.parse(previous.observedAt)||previous.review&&(!next.review||next.review.reviewedAt<previous.review.reviewedAt))throw Error("Japan Series snapshot regression");
  for(const old of previous.series.games){const game=next.series.games.find(g=>g.gameId===old.gameId);
    if(!game||game.gameNumber!==old.gameNumber||game.awayTeamId!==old.awayTeamId||game.homeTeamId!==old.homeTeamId||old.status==="final"&&(JSON.stringify(game)!==JSON.stringify(old)||next.venues[old.gameId]!==previous.venues[old.gameId]||JSON.stringify(next.results.find(r=>r.gameId===old.gameId))!==JSON.stringify(previous.results.find(r=>r.gameId===old.gameId))))throw Error("Final correction/deletion or identity change requires separate review");
  }
}
