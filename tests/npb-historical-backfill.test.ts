import { describe, expect, it, vi } from "vitest";
import { backfillDates, reconcileHistoricalSchedules, runHistoricalBackfill } from "../src/data/npb-historical-backfill";
import type { NpbGame } from "../src/data/npb-nf3";
import { openDataClient, migrateData, type DataClient } from "../src/data/database";
import { npbTeams } from "../src/data/npb-nf3";
import { parseNf3TeamGames } from "../src/data/npb-nf3";
import { NpbRepository } from "../src/data/npb-repository";
import { playerGameBattingSchema,playerGamePitchingSchema } from "../src/domain/game-facts";
import { validateNpbGameFacts } from "../src/data/npb-game-collector";

const now=new Date("2026-09-27T00:00:00Z");
describe("historical range safety",()=>{
  it("uses only completed season dates, excluding eleven future dates",()=>{
    expect(backfillDates("2026-03-27","2026-09-26",now)).toHaveLength(184);
    expect(()=>backfillDates("2026-03-27","2026-09-27",now)).toThrow();
    expect(()=>backfillDates("2026-03-26","2026-09-26",now)).toThrow();
    expect(()=>backfillDates("2026-04-31","2026-05-01",now)).toThrow();
  });
  it("requires explicit scratch ownership for dry-run before any read or mutation",async()=>{
    await expect(runHistoricalBackfill({} as DataClient,{from:"2026-09-20",to:"2026-09-20",dryRun:true,now}))
      .rejects.toThrow("scratch");
  });
  it("rejects the current-season Source alias after the JST year changes",async()=>{
    const request=vi.fn(),execute=vi.fn();
    await expect(runHistoricalBackfill({execute} as unknown as DataClient,{from:"2026-09-20",to:"2026-09-20",
      request,now:new Date("2026-12-31T15:00:00Z")})).rejects.toThrow("year changes");
    expect(request).not.toHaveBeenCalled();expect(execute).not.toHaveBeenCalled();
  });
  it("a failed monthly source is fetched once and never writes or declares no_games",async()=>{
    const execute=vi.fn();const request=vi.fn(async()=>{throw new Error("provider unavailable");});
    const result=await runHistoricalBackfill({execute} as unknown as DataClient,
      {from:"2026-09-20",to:"2026-09-21",request,now});
    expect(request).toHaveBeenCalledTimes(1);expect(execute).not.toHaveBeenCalled();
    expect(result.reports.map(d=>d.status)).toEqual(["unknown","unknown"]);
  });
  it("resumes a verified no-games day without ingesting or fetching participants",async()=>{
    const execute=vi.fn(async(statement:{sql:string})=>({rows:statement.sql.includes("SELECT stage,status")?
      [{stage:"games",status:"complete"}]:statement.sql.includes("SELECT day_status")?[{day_status:"no_games"}]:[]}));
    const request=vi.fn(async(url:string)=>{
      const code=new URL(url).searchParams.get("tm"),index=npbTeams.findIndex(t=>t.code===code);
      const opponent=npbTeams[index%2===0?index+1:index-1]!;
      const cells=Array.from({length:19},(_,i)=>i===0?"9/20":i===2?opponent.short:i===4?(index%2===0?"H":"V"):
        i===18?(index%2===0?"1-0":"0-1"):"-");
      return `<table class="Base"><caption>試合日程・先発</caption><tr class="Index2"><th>スコア</th></tr><tr onmouseover="x">${cells.map(c=>`<td>${c}</td>`).join("")}</tr></table>`;
    });
    const result=await runHistoricalBackfill({execute} as unknown as DataClient,{from:"2026-09-21",to:"2026-09-21",request,now});
    expect(result.reports[0]?.status).toBe("skipped_verified");expect(request).toHaveBeenCalledTimes(12);
    expect(execute.mock.calls.every(([s])=>s.sql.startsWith("SELECT"))).toBe(true);
  });
  it("keeps independently verified Game metadata but never invents unavailable historical Player Facts",async()=>{
    const client=openDataClient("file::memory:");await migrateData(client);
    try {
      const request=async(url:string)=>{
        const code=new URL(url).searchParams.get("tm");
        if(!code) throw new Error("historical participant date unavailable");
        const index=npbTeams.findIndex(t=>t.code===code),opponent=npbTeams[index%2===0?index+1:index-1]!;
        const cells=Array.from({length:19},(_,i)=>i===0?"9/20":i===2?opponent.short:i===4?(index%2===0?"H":"V"):
          i===18?(index%2===0?"1-0":"0-1"):"-");
        return `<table class="Base"><caption>試合日程・先発</caption><tr class="Index2"><th>スコア</th></tr><tr onmouseover="x">${cells.map(c=>`<td>${c}</td>`).join("")}</tr></table>`;
      };
      const result=await runHistoricalBackfill(client,{from:"2026-09-20",to:"2026-09-20",request,now});
      expect(result.reports[0]?.status).toBe("unknown");
      expect(Number((await client.execute("SELECT count(*) n FROM npb_games")).rows[0]?.n)).toBe(6);
      expect(Number((await client.execute("SELECT count(*) n FROM player_game_batting")).rows[0]?.n)).toBe(0);
      expect(Number((await client.execute("SELECT count(*) n FROM player_game_pitching")).rows[0]?.n)).toBe(0);
      expect(Number((await client.execute("SELECT count(*) n FROM npb_day_runs")).rows[0]?.n)).toBe(0);
    } finally {client.close();}
  });
  it("a partial-day resume fetches participants only for Games lacking current validated Facts",async()=>{
    const client=openDataClient("file::memory:");await migrateData(client);
    try {
      const page=(code:string)=>{
        const index=npbTeams.findIndex(t=>t.code===code),opponent=npbTeams[index%2===0?index+1:index-1]!;
        const cells=Array.from({length:19},(_,i)=>i===0?"9/20":i===2?opponent.short:i===4?(index%2===0?"H":"V"):i===18?"0-0":"-");
        return `<table class="Base"><caption>試合日程・先発</caption><tr class="Index2"><th>スコア</th></tr><tr onmouseover="x">${cells.map(c=>`<td>${c}</td>`).join("")}</tr></table>`;
      };
      const games=npbTeams.filter((_,i)=>i%2===0).map(t=>parseNf3TeamGames(page(t.code),t.code,2026,"https://nf3.sakura.ne.jp/",now.toISOString())[0]!);
      const repo=new NpbRepository(client);await repo.saveGames(games,"2026-09-20",false);
      for(const game of games.slice(0,5)) {
        const batters=[game.homeTeamId,game.awayTeamId].flatMap(teamId=>Array.from({length:9},(_,i)=>playerGameBattingSchema.parse({
          gameId:game.id,playerId:`${teamId}:${i}`,teamId,opponentTeamId:teamId===game.homeTeamId?game.awayTeamId:game.homeTeamId,
          sourceKey:"nf3",sourceRecordId:`${game.id}:${teamId}:${i}`,collectedAt:now.toISOString(),battingOrder:i+1,starter:true,
          pa:3,ab:3,runs:0,hits:0,doubles:0,triples:0,homeRuns:0,rbi:0,walks:0,hbp:0,sacrificeHits:0,sacrificeFlies:0,strikeouts:0,stolenBases:0,caughtStealing:0})));
        const pitchers=[game.homeTeamId,game.awayTeamId].map(teamId=>playerGamePitchingSchema.parse({
          id:`${game.id}:${teamId}`,gameId:game.id,playerId:`${teamId}:0`,teamId,opponentTeamId:teamId===game.homeTeamId?game.awayTeamId:game.homeTeamId,
          sourceKey:"nf3",sourceRecordId:`${game.id}:${teamId}`,collectedAt:now.toISOString(),role:"starter",starter:true,
          appearanceOrder:null,inningsPitchedOuts:27,battersFaced:27,hits:0,homeRuns:0,walks:null,walksAndHitBatters:0,strikeouts:0,runs:0,earnedRuns:0,pitches:90,catcherId:null,decision:"none"}));
        await repo.saveBatting(batters.map(fact=>({date:game.date,opponentTeamId:fact.opponentTeamId!,scheduledTime:null,fact})),game.date,false,false,"full",game);
        await repo.savePitching(pitchers.map(fact=>({date:game.date,opponentTeamId:fact.opponentTeamId!,scheduledTime:null,fact})),game.date,false,false,"full",game);
        const proof=validateNpbGameFacts(game,18,batters,2,pitchers,18,2);expect(proof.gameStatus).toBe("complete");await repo.saveGameCompleteness(proof);
      }
      const request=vi.fn(async(url:string)=>page(new URL(url).searchParams.get("tm")!));
      const result=await runHistoricalBackfill(client,{from:"2026-09-20",to:"2026-09-20",request,now});
      expect(result.reports[0]?.status).toBe("unknown"); // Missing Game's roster deliberately invalid.
      const participantRequests=request.mock.calls.map(([url])=>new URL(url)).filter(u=>u.searchParams.has("fp"));
      expect(participantRequests).toHaveLength(1);
      expect(participantRequests[0]?.searchParams.get("tm")).toBe(npbTeams.find(t=>t.id===games[5]!.homeTeamId)!.code);
      expect(Number((await client.execute("SELECT count(*) n FROM player_game_batting")).rows[0]?.n)).toBe(90);
    } finally {client.close();}
  });
});
describe("dual-source schedule reconciliation",()=>{
  const game={id:"game",date:"2026-09-20",status:"final",homeTeamId:"h",awayTeamId:"a",homeScore:1,awayScore:0} as NpbGame;
  const pages=(a=game,b=game)=>[[a],[b],...Array.from({length:10},()=>[])];
  it("requires all twelve parsed monthly schedules before confirming no games",()=>{
    expect(reconcileHistoricalSchedules(Array.from({length:12},()=>[]))).toEqual([]);
    expect(()=>reconcileHistoricalSchedules([])).toThrow();
  });
  it("rejects a one-sided game and mismatching scores",()=>{
    expect(()=>reconcileHistoricalSchedules([[game],...Array.from({length:11},()=>[])])).toThrow();
    expect(()=>reconcileHistoricalSchedules(pages(game,{...game,homeScore:2}))).toThrow();
  });
  it("keeps doubleheaders distinct and stable",()=>{
    const second={...game,id:"second",gameNumber:2};
    expect(reconcileHistoricalSchedules([[second,game],[game,second],...Array.from({length:10},()=>[])])
      .map(g=>g.id)).toEqual(["game","second"]);
  });
});
