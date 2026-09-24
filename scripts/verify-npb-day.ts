import { openDataClient } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { previousJstDate } from "../src/data/npb-day-collector";

const date=process.argv.find((arg)=>arg.startsWith("--date="))?.slice(7)??previousJstDate();
const url=process.env.TURSO_DATABASE_URL??"file:.data/baseball.db";
if(process.argv.includes("--require-remote") && (url.startsWith("file:")||!process.env.TURSO_AUTH_TOKEN))
  throw new Error("Remote database required");
const client=openDataClient(url,process.env.TURSO_AUTH_TOKEN);
try {
  const repo=new NpbRepository(client);
  const games=(await repo.findGamesByDate(date)).filter((game)=>game.status==="final");
  const details=[];
  for(const game of games) {
    const [batting,pitching,report]=await Promise.all([
      repo.findBattingByGame(game.id),repo.findPitchingByGame(game.id),repo.findGameCompleteness(game.id)]);
    details.push({gameId:game.id,batters:batting.length,pitchers:pitching.length,
      status:report?.gameStatus??"missing",expectedBatters:report?.expectedBatters??null,
      expectedPitchers:report?.expectedPitchers??null});
  }
  const mappings=await client.execute("SELECT COUNT(*) AS n FROM source_entity_mappings WHERE source_key='nf3' AND entity_kind='player'");
  const result={targetDate:date,finalGames:games.length,batters:details.reduce((sum,row)=>sum+row.batters,0),
    pitchers:details.reduce((sum,row)=>sum+row.pitchers,0),playerMappings:Number(mappings.rows[0]?.n??0),games:details};
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
  if(process.argv.includes("--require-complete") && details.some((game)=>game.status!=="complete"||
    game.batters!==game.expectedBatters||game.pitchers!==game.expectedPitchers)) process.exitCode=1;
} finally {client.close();}
