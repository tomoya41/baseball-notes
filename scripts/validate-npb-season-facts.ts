import { openDataClient } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { validateNpbGameFacts } from "../src/data/npb-game-collector";
import type { NpbGame } from "../src/data/npb-nf3";
const url=process.env.TURSO_DATABASE_URL;
if(!url || url.startsWith("file:") || !process.env.TURSO_AUTH_TOKEN) throw new Error("Remote read-only connection required");
const client=openDataClient(url,process.env.TURSO_AUTH_TOKEN);
try {
  const repo=new NpbRepository(client),started=performance.now();
  const date=(await repo.findLatestStandings())[0]?.date;
  if(!date) throw new Error("No completed date");
  const [games,batting,pitching,evidence]=await Promise.all([
    client.execute({sql:"SELECT * FROM npb_games WHERE season=2026 AND game_date<=?",args:[date]}),
    repo.findBattingByPeriod("2026-03-27",date,null,2026),repo.findPitchingByPeriod("2026-03-27",date,null,2026),
    client.execute("SELECT * FROM npb_game_completeness")]);
  const proofs=new Map(evidence.rows.map(r=>[String(r.game_id),r]));
  const results=games.rows.filter(r=>r.status==="final").map(r=>{
    const game={id:String(r.game_id),date:String(r.game_date),homeTeamId:String(r.home_team_id),awayTeamId:String(r.away_team_id),
      homeScore:r.home_score===null?null:Number(r.home_score),awayScore:r.away_score===null?null:Number(r.away_score)} as NpbGame;
    const proof=proofs.get(game.id);
    if(!proof) return {gameId:game.id,date:game.date,status:"unverified",issues:["expected_participants_unverified"]};
    const result=validateNpbGameFacts(game,Number(proof.expected_batters),batting.filter(b=>b.gameId===game.id),
      Number(proof.expected_pitchers),pitching.filter(p=>p.gameId===game.id),Number(proof.mapped_batters),Number(proof.mapped_pitchers));
    return {gameId:game.id,date:game.date,status:result.gameStatus,storedStatus:proof.game_status,issues:result.issues};
  });
  console.log(JSON.stringify({queryCount:5,durationMs:performance.now()-started,games:games.rows.length,batting:batting.length,
    pitching:pitching.length,validated:results.filter(r=>r.status==="complete").length,results}));
} finally {client.close();}
