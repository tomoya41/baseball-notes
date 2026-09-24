import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { gameCompletenessSchema } from "../src/domain/game-facts";
import { migrateData, openDataClient, type DataClient } from "../src/data/database";
import { classifyDay, previousJstDate, recordDayBackup, runNpbDayFacts } from "../src/data/npb-day-collector";
import type { NpbGameProofResult } from "../src/data/npb-game-collector";

const clients:DataClient[]=[];
afterEach(()=>{for(const client of clients.splice(0)) client.close();});
async function database(statuses:string[]) {
  const dir=await mkdtemp(join(tmpdir(),"npb-day-collector-"));
  const client=openDataClient(`file:${join(dir,"data.db")}`);clients.push(client);
  await migrateData(client);
  for(let i=0;i<statuses.length;i++) {
    const status=statuses[i]!;
    await client.execute({sql:"INSERT INTO npb_games VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args:[`game-${i}`,2026,"2026-09-23","home","away",i+1,null,"18:00",status,status==="final"?2:null,
        status==="final"?1:null,"nf3",`game-${i}`,"https://nf3.sakura.ne.jp/","2026-09-24","hash"]});
  }
  return client;
}
const gameResult=(gameId:string,status:"complete"|"partial"):NpbGameProofResult=>({
  report:gameCompletenessSchema.parse({gameId,battingStatus:status,pitchingStatus:status,gameStatus:status,
    expectedBatters:20,collectedBatters:status==="complete"?20:19,mappedBatters:status==="complete"?20:19,
    expectedPitchers:5,collectedPitchers:5,mappedPitchers:5,checks:{coverage:status==="complete"},
    issues:status==="complete"?[]:["Missing batter"],sourceKey:"nf3",verifiedAt:"2026-09-24T00:00:00Z"}),
  fetchedPages:20,battingFacts:status==="complete"?20:19,pitchingFacts:5,insertedBatting:0,insertedPitching:0,
  wouldCreateMappings:[],observed:{sacrificeFlies:0,fractionalTwoOutPitchers:0},nonBattingSubstitutes:[]});

test("JST yesterday is independent of UTC day and delayed schedule time",()=>{
  expect(previousJstDate(new Date("2026-09-25T19:00:00Z"))).toBe("2026-09-25");
  expect(previousJstDate(new Date("2026-09-26T03:00:00Z"))).toBe("2026-09-25");
});
test("a full day dry-run handles fewer games, postponement and no DB mutation",async()=>{
  const client=await database(["final","postponed","final"]);
  const result=await runNpbDayFacts(client,{targetDate:"2026-09-23",trigger:"manual",dryRun:true,
    runGame:async(game)=>gameResult(game.id,"complete")});
  expect(result).toMatchObject({status:"complete",scheduledGames:3,finalGames:2,completeGames:2,
    expectedBatters:40,storedBatters:40,expectedPitchers:10,storedPitchers:10});
  const rows=await client.execute("SELECT COUNT(*) AS n FROM npb_day_runs");
  expect(Number(rows.rows[0]?.n)).toBe(0);
});
test("no final games is a successful no_games day",async()=>{
  const client=await database(["postponed"]);
  const result=await runNpbDayFacts(client,{targetDate:"2026-09-23",trigger:"scheduled",dryRun:true});
  expect(result).toMatchObject({status:"no_games",scheduledGames:1,finalGames:0});
});
test("one partial game or parser failure cannot mark day complete",async()=>{
  const client=await database(["final","final"]);
  const partial=await runNpbDayFacts(client,{targetDate:"2026-09-23",trigger:"repair",dryRun:true,
    runGame:async(game)=>gameResult(game.id,game.id==="game-1"?"partial":"complete")});
  expect(partial).toMatchObject({status:"partial",completeGames:1,partialGames:1});
  const failed=await runNpbDayFacts(client,{targetDate:"2026-09-23",trigger:"manual",dryRun:true,
    runGame:async(game)=>{if(game.id==="game-1") throw new Error("Unknown nf3 marker");return gameResult(game.id,"complete");}});
  expect(failed).toMatchObject({status:"partial",completeGames:1,failedGames:1});
});
test("backup failure warns without changing a committed day status",async()=>{
  const client=await database([]);
  await client.execute({sql:`INSERT INTO npb_day_runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args:["run","2026-09-23","manual","2026-09-24","2026-09-24","complete","succeeded",1,1,1,0,0,20,5,0,25,0,"pending",null]});
  await recordDayBackup(client,"run",false,new Error("archive failed"));
  const row=(await client.execute("SELECT * FROM npb_day_runs WHERE run_id='run'")).rows[0]!;
  expect(row.day_status).toBe("complete");
  expect(row.operational_status).toBe("completed_with_warning");
  expect(row.backup_status).toBe("failed");
});
test("day status supports zero games and rejects missing processed games",()=>{
  expect(classifyDay([],0,0)).toBe("no_games");
  expect(classifyDay([],2,2)).toBe("partial");
  expect(classifyDay([],0,0,false)).toBe("failed");
});
