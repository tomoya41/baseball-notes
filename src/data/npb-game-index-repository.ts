import type { DataClient } from "./database";
import { NpbRepository } from "./npb-repository";
import { NpbPeriodCoverageRepository } from "./npb-period-coverage-repository";
import { findNpbRegularSeason } from "./npb-season-metadata";
import { gameIndexRowSchema,gameDateIndexSchema,orderGames,type GameIndexRow } from "../domain/npb-game-index";
import { periodDates } from "../domain/period-coverage";

// Five batch SELECTs (teams, Games+availability, three coverage evidence queries).
export async function readNpbGameIndex(client:DataClient,effectiveDate:string) {
  const started=performance.now(),season=findNpbRegularSeason(effectiveDate);
  if(!season)throw Error("Season metadata missing");
  const [teams,result,coverage]=await Promise.all([
    new NpbRepository(client).findTeams(),
    client.execute({sql:`SELECT g.game_id,g.game_date,g.game_number,g.scheduled_time,g.status,
      g.home_team_id,g.away_team_id,g.home_score,g.away_score,c.game_status,
      EXISTS(SELECT 1 FROM player_game_batting b WHERE b.game_id=g.game_id) AS has_batting,
      EXISTS(SELECT 1 FROM player_game_pitching p WHERE p.game_id=g.game_id) AS has_pitching
      FROM npb_games g LEFT JOIN npb_game_completeness c ON c.game_id=g.game_id
      WHERE g.game_date BETWEEN ? AND ? ORDER BY g.game_date,g.game_id`,args:[season.startDate,season.endDate]}),
    new NpbPeriodCoverageRepository(client).findPeriodCoverage({from:season.startDate,to:effectiveDate,timeZone:"Asia/Tokyo"}),
  ]);
  const generatedAt=new Date().toISOString();const byDate=new Map<string,GameIndexRow[]>();
  for(const r of result.rows){const side=(id:unknown,score:unknown)=>{
    const t=teams.find(t=>t.id===String(id));return {id:String(id),name:t?.names.japaneseShort??t?.names.canonical??"球団名未登録",
      score:score===null?null:Number(score)};};
    const row=gameIndexRowSchema.parse({gameId:r.game_id,date:r.game_date,gameNumber:Number(r.game_number),
      scheduledTime:r.scheduled_time??null,status:r.status,home:side(r.home_team_id,r.home_score),away:side(r.away_team_id,r.away_score),
      completeness:r.game_status??null,battingAvailable:!!r.has_batting,pitchingAvailable:!!r.has_pitching,detailAvailable:true});
    byDate.set(row.date,[...(byDate.get(row.date)??[]),row]);}
  const days=periodDates({from:season.startDate,to:season.endDate,timeZone:"Asia/Tokyo"}).map(date=>gameDateIndexSchema.parse({schemaVersion:1,league:"NPB",date,
    generatedAt,coverage:coverage.calendar.find(d=>d.date===date)?.status??"unknown",games:orderGames(byDate.get(date)??[])}));
  const recent=[...byDate.values()].flat().filter(g=>g.status==="final"&&g.date<=effectiveDate)
    .sort((a,b)=>b.date.localeCompare(a.date)||a.gameId.localeCompare(b.gameId)).slice(0,6);
  return {days,recent,coverage,generatedAt,from:season.startDate,to:season.endDate,rows:result.rows.length,readMs:performance.now()-started};
}
