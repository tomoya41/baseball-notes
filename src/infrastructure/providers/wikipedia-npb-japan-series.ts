import { createHash } from "node:crypto";
import { z } from "zod";
import { dateInZone } from "../../domain/analysis-query";
import { npbJapanSeriesSchema, assertJapanSeriesAdvancement, type NpbJapanSeries } from "../../domain/npb-japan-series";
import type { NpbPostseasonSeries } from "../../domain/npb-postseason-series";
import { npbSeriesId } from "./wikipedia-npb-series";
import reviewedSources from "../../data/npb-japan-series-sources.json";
import { csSourceSchema } from "../../domain/npb-cs-observations";
import { applyReviewedJapanResults } from "./wikipedia-npb-japan-results";

const page=z.object({pageid:z.number().int(),title:z.string(),revisions:z.array(z.object({revid:z.number().int().positive(),timestamp:z.iso.datetime(),slots:z.object({main:z.object({content:z.string().max(100000)})})})).length(1)});
const archiveSchema=z.object({observedAt:z.iso.datetime(),response:z.object({query:z.object({pages:z.array(page).length(2)})})});
const team:Record<string,string>={福岡ソフトバンクホークス:"npb:team:hawks",横浜DeNAベイスターズ:"npb:team:baystars"};
// Presentation markup only; unknown attributes/templates remain unaccepted text.
const plain=(s:string)=>s.replace(/^style="background:#[A-Fa-f0-9]{6}; color:#[A-Fa-f0-9]{6};"\|\s*/,"").replace(/'''([^']+)'''/g,"$1").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,a:string,b?:string)=>b??a).trim();
const digest=(s:string)=>createHash("sha256").update(s).digest("hex");
export function japanGameId(gameNumber:number){return `npb:game:${digest(`baseball-notes:npb:japan-series:v1:2026:5306035:${gameNumber}`).slice(0,20)}`;}

/** One bounded official API request; candidates are private and do not admit a new revision. */
export async function fetchJapanSeriesCandidate(request:typeof fetch=fetch){
  const url=new URL("https://ja.wikipedia.org/w/api.php");
  for(const [key,value] of Object.entries({action:"query",format:"json",formatversion:"2",prop:"revisions",rvprop:"ids|timestamp|content",rvslots:"main",pageids:"5306035|5307595",maxlag:"5"}))url.searchParams.set(key,value);
  const response=await request(url,{headers:{"User-Agent":"BaseballNotes/1.0 (https://github.com/tomoya41/baseball-notes; licensed Japan Series review)"},signal:AbortSignal.timeout(30000)});
  if(!response.ok||!response.body)throw Error(`Japan Series candidate HTTP ${response.status}`);
  const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
  try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>500000)throw Error("Japan Series API byte budget exceeded");parts.push(p.value);}}catch(e){await reader.cancel().catch(()=>undefined);throw e;}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  const archive=archiveSchema.parse({observedAt:new Date().toISOString(),response:JSON.parse(new TextDecoder().decode(bytes))});
  const allowed=new Map([[5306035,"2026年の日本シリーズ"],[5307595,"Template:2026年の日本シリーズ"]]);
  if(new Set(archive.response.query.pages.map(p=>p.pageid)).size!==2||archive.response.query.pages.some(p=>allowed.get(p.pageid)!==p.title))throw Error("Unexpected Japan Series source identity");
  return archive;
}

/** Only the admitted article + its exact schedule transclusion; never news bodies or NPB scraping. */
export function buildWikipediaJapanSeries(raw:unknown,cs:NpbPostseasonSeries,csSeriesBodySha256:string,admittedSources:readonly z.infer<typeof csSourceSchema>[]=reviewedSources,review?:unknown,now=Date.now()){
  const archive=archiveSchema.parse(raw),asOf=dateInZone(Date.parse(archive.observedAt),"Asia/Tokyo");
  if(Date.parse(archive.observedAt)>now)throw Error("Future Japan Series acquisition");
  const article=archive.response.query.pages.find(p=>p.pageid===5306035&&p.title==="2026年の日本シリーズ"),schedule=archive.response.query.pages.find(p=>p.pageid===5307595&&p.title==="Template:2026年の日本シリーズ");
  if(!article||!schedule||archive.response.query.pages.some(p=>p.revisions[0]!.timestamp>archive.observedAt||/\{\{\s*(?:著作権侵害|Copyvio|転載疑惑)/i.test(p.revisions[0]!.slots.main.content)))throw Error("Unadmitted Japan Series source/revision");
  const admitted=z.array(csSourceSchema).length(2).parse(admittedSources);
  for(const p of archive.response.query.pages){const a=admitted.find(s=>s.pageId===p.pageid),v=p.revisions[0]!;
    if(!a||a.title!==p.title||a.revision!==v.revid||a.revisionAt!==v.timestamp||a.contentSha256!==digest(v.slots.main.content))throw Error("Japan Series reviewed revision/hash mismatch");
  }
  const text=article.revisions[0]!.slots.main.content.replace(/<!--[\s\S]*?-->/g,"");
  if(!text.includes("{{2026年の日本シリーズ}}")||!["横浜DeNAベイスターズ","福岡ソフトバンクホークス"].every(t=>text.includes(`[[${t}]]`))||!text.includes("4勝先取"))throw Error("Unverified Japan Series participants/rules");
  const games:NpbJapanSeries["series"]["games"]=[],venues:Record<string,string>={},results:NpbJapanSeries["results"]=[];
  const scheduleScores=new Map<string,string>();let venue="",remaining=0;
  for(const row of schedule.revisions[0]!.slots.main.content.split(/\n\|-\s*\n/).slice(1)){
    const line=row.split("\n")[0]??"";if(!line.startsWith("|"))continue;
    const cells=line.slice(1).split("||").map(v=>v.trim());
    if(cells.length===2&&/^colspan="5"\|移動日$/.test(cells[1]!))continue;
    if(cells.length!==5&&cells.length!==6)throw Error("Unsupported Japan Series schedule columns");
    const date=/^(\d{1,2})月(\d{1,2})日（[月火水木金土日]）$/.exec(cells[0]!),number=/^第(\d+)戦$/.exec(cells[1]!);
    if(!date||!number)throw Error("Unverified schedule date/number");
    const gameNumber=Number(number[1]),day=`2026-${date[1]!.padStart(2,"0")}-${date[2]!.padStart(2,"0")}`,away=team[plain(cells[2]!)],home=team[plain(cells[4]!)];
    if(!z.iso.date().safeParse(day).success||gameNumber!==games.length+1||!away||!home||away===home)throw Error("Schedule identity/sequence mismatch");
    if(cells[5]){if(remaining>0)throw Error("Overlapping venue rowspan");const span=/^rowspan="([1-9])"\|\s*(.+)$/.exec(cells[5]);venue=plain(span?.[2]??cells[5]);remaining=span?Number(span[1])-1:0;}else {if(remaining<1)throw Error("Unproven inherited venue");remaining--;}
    if(!["横浜スタジアム","みずほPayPayドーム福岡"].includes(venue))throw Error("Unknown venue");
    // A dash in the schedule and RR=0/HR=0 in a future Linescore are NOT results.
    const gameId=japanGameId(gameNumber);venues[gameId]=venue;
    const score=plain(cells[3]!);
    if(score!=="-"){
      const result=/^(\d+)\s*[-–−]\s*(\d+)$/.exec(score);
      if(!review||!result)throw Error("Changed schedule result needs separately reviewed completion evidence");
      scheduleScores.set(gameId,`${Number(result[1])}-${Number(result[2])}`);
    }
    games.push({gameId,gameNumber,date:day,awayTeamId:away,homeTeamId:home,awayRuns:null,homeRuns:null,status:"scheduled",scheduledAt:null,winnerId:null});
  }
  if(games.length<7||games.length>9||remaining!==0||games[0]!.date!=="2026-10-24"||!review&&(games.length!==7||games.some(g=>g.date<asOf)))throw Error("Schedule-only admission requires reviewed pre-opening dates; additional Games need reviewed completion evidence");
  const sources=archive.response.query.pages.map(p=>({pageId:p.pageid,title:p.title,revision:p.revisions[0]!.revid,revisionAt:p.revisions[0]!.timestamp,contentSha256:digest(p.revisions[0]!.slots.main.content)}));
  // Extra Games can only be validated together with the reviewed first seven/eight
  // finals. Do not validate their temporary scoreless skeleton as a public snapshot.
  const data:NpbJapanSeries={schemaVersion:1,league:"NPB",season:2026,competition:"postseason",provider:"Wikipedia",license:"CC-BY-SA-4.0",coverage:"partial",observedAt:archive.observedAt,csSeriesBodySha256,sources,
    series:{id:npbSeriesId(5306035,"japan_series"),league:"NPB",season:2026,competitionType:"postseason",round:"japan_series",name:"2026 日本シリーズ",bestOf:7,winsRequired:4,teams:["npb:team:baystars","npb:team:hawks"].map(teamId=>({teamId,playedWins:0,advantageWins:0,seriesTotal:0})),games,status:"in_progress",winnerId:null,clinched:false,clinchReason:"wins_required",advancesToSeriesId:null,effectiveDate:asOf},venues,results,playerStats:"unavailable",transformation:"Article-linked clubs and schedule-template rows normalized with explicit venue rowspans. Pre-opening placeholder zero scores excluded. No player stats, Current Facts, inferred start times or official certification."};
  const validated=review?applyReviewedJapanResults(data,text,review,scheduleScores,now):npbJapanSeriesSchema.parse(data);
  assertJapanSeriesAdvancement(validated,cs);return validated;
}
