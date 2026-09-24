import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { gameCompletenessSchema } from "../src/domain/game-facts";
import { migrateData, openDataClient, type DataClient } from "../src/data/database";
import { runNpbDayDryRun, summarizeNpbDay } from "../src/data/npb-day-dry-run";
import type { NpbGameProofResult } from "../src/data/npb-game-collector";

const clients:DataClient[]=[];
afterEach(()=>{for(const client of clients.splice(0)) client.close();});
const date="2026-09-23";
function result(gameId:string,status:"complete"|"partial",issues:string[]=[]):NpbGameProofResult {
  return {report:gameCompletenessSchema.parse({gameId,battingStatus:status,pitchingStatus:status,gameStatus:status,
    expectedBatters:20,collectedBatters:status==="complete"?20:19,mappedBatters:status==="complete"?20:19,
    expectedPitchers:5,collectedPitchers:5,mappedPitchers:5,checks:{coverage:status==="complete"},
    issues,sourceKey:"nf3",verifiedAt:"2026-09-24T00:00:00Z"}),fetchedPages:25,battingFacts:20,
    pitchingFacts:5,insertedBatting:0,insertedPitching:0,wouldCreateMappings:[],
    observed:{sacrificeFlies:0,fractionalTwoOutPitchers:0},nonBattingSubstitutes:[]};
}
async function seeded() {
  const dir=await mkdtemp(join(tmpdir(),"npb-day-test-"));
  const client=openDataClient(`file:${join(dir,"data.db")}`); clients.push(client);
  await migrateData(client);
  for(const [id,home,away] of [["game-a","npb:team:giants","npb:team:carp"],
    ["game-b","npb:team:hawks","npb:team:lions"]] as const)
    await client.execute({sql:"INSERT INTO npb_games VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args:[id,2026,date,home,away,1,null,"18:00","final",2,1,"nf3",id,"https://nf3.sakura.ne.jp/",date,"hash"]});
  return client;
}

test("day dry-run enumerates Repository games, completes without DB mutations",async()=>{
  const client=await seeded();
  const day=await runNpbDayDryRun(client,date,{runGame:async(game)=>result(game.id,"complete")});
  expect(day).toMatchObject({gamesExpected:2,gamesProcessed:2,gamesComplete:2,gamesPartial:0,
    gamesFailed:0,dayStatus:"complete",battersCollected:40,pitchersCollected:10,noMutation:true});
  const count=await client.execute("SELECT COUNT(*) AS n FROM npb_game_completeness");
  expect(Number(count.rows[0]?.n)).toBe(0);
});

test("one partial game prevents day completeness",async()=>{
  const client=await seeded();
  const day=await runNpbDayDryRun(client,date,{runGame:async(game)=>result(game.id,
    game.id==="game-b"?"partial":"complete",game.id==="game-b"?["missing batter"]:[])});
  expect(day).toMatchObject({gamesComplete:1,gamesPartial:1,dayStatus:"partial",validationErrors:1});
});

test("parser failure is distinct from zero participants and processing continues",async()=>{
  const client=await seeded();
  const day=await runNpbDayDryRun(client,date,{runGame:async(game)=>{
    if(game.id==="game-a") throw new Error("nf3 standings schema changed");
    return result(game.id,"complete");
  }});
  expect(day).toMatchObject({gamesProcessed:2,gamesFailed:1,gamesComplete:1,dayStatus:"partial",parserFailures:1});
  expect(day.games[0]?.report.issues[0]).toContain("schema changed");
});

test("unresolved player and duplicate mapping candidates are surfaced",()=>{
  const first=result("game-a","partial",["Unresolved possible existing/transferred player"]);
  first.wouldCreateMappings=[{sourceId:"one",name:"同名 選手",teamId:"one",sourceUrl:"https://nf3.sakura.ne.jp/one"}];
  const second=result("game-b","complete");
  second.wouldCreateMappings=[{sourceId:"two",name:"同名選手",teamId:"two",sourceUrl:"https://nf3.sakura.ne.jp/two"}];
  const game=(value:NpbGameProofResult)=>({gameId:value.report.gameId,matchup:"A–B",...value,
    expectedMutations:{batting:20,pitching:5,mapping:1,completeness:1,ingestion:1}});
  const day=summarizeNpbDay(date,[game(first),game(second)],2,{httpRequests:50,uniquePages:48,retries:2},1000,true);
  expect(day).toMatchObject({unresolvedPlayers:1,wouldCreateMappings:2,dayStatus:"partial",httpRequests:50,
    uniquePages:48,retries:2});
  expect(day.duplicateCandidateNames).toHaveLength(1);
});
