import {createHash} from "node:crypto";
import {z} from "zod";
import {dateInZone} from "../../domain/analysis-query";
import {npbJapanSeriesSchema,type NpbJapanSeries} from "../../domain/npb-japan-series";
import {splitWikipediaCells} from "./wikipedia-cells";

const reviewSchema=z.strictObject({reviewedBy:z.string().min(1).max(80),reviewedAt:z.iso.datetime(),games:z.array(z.strictObject({gameId:z.string(),linescore:z.string().min(20).max(20000)})).min(1).max(15)});
const plain=(s:string)=>s.replace(/'''([^']+)'''/g,"$1").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,a:string,b?:string)=>b??a).trim();
const clubs:Record<string,string>={ソフトバンク:"npb:team:hawks",福岡ソフトバンクホークス:"npb:team:hawks",DeNA:"npb:team:baystars",横浜DeNAベイスターズ:"npb:team:baystars"};

/** Review exact licensed source blocks; no scheduled placeholder or score alone proves a final. */
export function applyReviewedJapanResults(base:NpbJapanSeries,article:string,raw:unknown,scheduleScores:Map<string,string>,now=Date.now()){
  const review=reviewSchema.parse(raw),d=structuredClone(base),asOf=dateInZone(Date.parse(d.observedAt),"Asia/Tokyo"),seen=new Set<string>();
  if(Date.parse(d.observedAt)>Date.parse(review.reviewedAt)||Date.parse(review.reviewedAt)>now)throw Error("Invalid Japan Series review time");
  const text=article.replace(/<!--[\s\S]*?-->/g,"");
  for(const proof of review.games){
    const g=d.series.games.find(g=>g.gameId===proof.gameId),block=proof.linescore;
    if(!g||seen.has(g.gameId)||text.split(block).length!==2||!block.startsWith("{{Linescore\n")||!block.endsWith("}}"))throw Error("Missing/duplicate exact Linescore evidence");
    seen.add(g.gameId);const fields:Record<string,string>={};
    for(const part of splitWikipediaCells(block.slice(11,-2),"|")){if(!part.trim())continue;const eq=part.indexOf("=");if(eq<1)throw Error("Unsupported Linescore cell");const key=part.slice(0,eq).trim();if(key in fields)throw Error("Duplicate Linescore cell");fields[key]=plain(part.slice(eq+1));}
    const date=/^(\d{1,2})月(\d{1,2})日$/.exec(fields.Date??""),day=date?`2026-${date[1]!.padStart(2,"0")}-${date[2]!.padStart(2,"0")}`:"";
    const duration=/試合時間[：:]\s*(\d+)時間(\d+)分/.exec(fields.Note2??""),minutes=duration?Number(duration[1])*60+Number(duration[2]):0;
    if(day!==g.date||day>asOf||clubs[fields.Road??""]!==g.awayTeamId||clubs[fields.Home??""]!==g.homeTeamId||!duration||Number(duration[2])>=60||minutes<=0)throw Error("Unverified Game date/teams/completion");
    const parse=(prefix:string)=>{const keys=Object.keys(fields).filter(k=>new RegExp(`^${prefix}[0-9]+$`).test(k));const n=keys.length;if(n<9||n>30)throw Error("Incomplete inning evidence");return Array.from({length:n},(_,i)=>{const value=fields[`${prefix}${i+1}`];if(!value||!(prefix==="H"&&i===n-1?/^(?:\d+[xX]?|[xX])$/:/^\d+$/).test(value))throw Error("Missing/unsupported inning cell");return value;});};
    const away=parse("R"),home=parse("H"),counts=(v:string[])=>v.map(n=>Number(n.replace(/[xX]/g,"")||0));
    const awayInnings=counts(away),homeInnings=counts(home);
    if(away.length!==home.length||!/^\d+$/.test(fields.RR??"")||!/^\d+$/.test(fields.HR??""))throw Error("Unknown final score");
    const awayRuns=Number(fields.RR),homeRuns=Number(fields.HR);
    if(awayRuns!==awayInnings.reduce((a,b)=>a+b,0)||homeRuns!==homeInnings.reduce((a,b)=>a+b,0)||scheduleScores.get(g.gameId)!==`${awayRuns}-${homeRuns}`||awayRuns!==homeRuns&&!fields.WP)throw Error("Score/schedule/innings mismatch");
    g.status="final";g.awayRuns=awayRuns;g.homeRuns=homeRuns;g.winnerId=homeRuns>awayRuns?g.homeTeamId:awayRuns>homeRuns?g.awayTeamId:null;
    const last=home.at(-1)!;d.results.push({gameId:g.gameId,awayInnings,homeInnings,durationMinutes:minutes,homeLastInning:/^[xX]$/.test(last)?"not_played":/[xX]$/.test(last)?"walk_off":"completed",sourcePageId:5306035,evidenceSha256:createHash("sha256").update(block).digest("hex")});
  }
  if([...scheduleScores.keys()].some(id=>!seen.has(id)))throw Error("Schedule result has no reviewed completion evidence");
  for(const t of d.series.teams){t.playedWins=d.series.games.filter(g=>g.winnerId===t.teamId).length;t.seriesTotal=t.playedWins;}
  const winner=d.series.teams.find(t=>t.playedWins===4);d.series.clinched=!!winner;d.series.winnerId=winner?.teamId??null;d.series.status=winner?"complete":"in_progress";
  d.review={reviewedBy:review.reviewedBy,reviewedAt:review.reviewedAt};d.transformation+=" Reviewed exact Linescore blocks matched to schedule scores; final half-innings retained, played wins derived only from admitted finals. Player statistics unavailable.";return npbJapanSeriesSchema.parse(d);
}
