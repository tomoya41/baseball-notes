import type { DataClient } from "./database";

export type SeasonQualifierContext={teamGames:Map<string,number>;playerTeams:Map<string,string[]>};
export async function readSeasonQualifierContext(client:DataClient,from:string,to:string):Promise<SeasonQualifierContext> {
  const [games,teams]=await Promise.all([
    client.execute({sql:`SELECT team_id,count(*) n FROM (
      SELECT home_team_id team_id FROM npb_games WHERE status='final' AND game_date BETWEEN ? AND ?
      UNION ALL SELECT away_team_id FROM npb_games WHERE status='final' AND game_date BETWEEN ? AND ?)
      GROUP BY team_id`,args:[from,to,from,to]}),
    client.execute({sql:`SELECT DISTINCT player_id,team_id,'batting' role FROM player_game_batting
      WHERE game_id IN (SELECT game_id FROM npb_games WHERE game_date BETWEEN ? AND ?)
      UNION SELECT DISTINCT player_id,team_id,'pitching' role FROM player_game_pitching
      WHERE game_id IN (SELECT game_id FROM npb_games WHERE game_date BETWEEN ? AND ?)`,args:[from,to,from,to]}),
  ]);
  const playerTeams=new Map<string,string[]>();
  for (const row of teams.rows) {
    const key=`${row.role}:${row.player_id}`;
    playerTeams.set(key,[...(playerTeams.get(key) ?? []),String(row.team_id)]);
  }
  return {teamGames:new Map(games.rows.map(r=>[String(r.team_id),Number(r.n)])),playerTeams};
}
