import { expect, it } from "vitest";
import { migrateData, openDataClient } from "../src/data/database";
import { npbGameFactCountsJoins } from "../src/data/npb-game-fact-counts";
import { selectOnlyClient } from "../src/data/npb-shortened-readiness";
import { readNpbGameIndex } from "../src/data/npb-game-index-repository";
import { inspectNpbCalendar } from "../src/data/npb-season-lifecycle";
import { auditNpbIntegrity, hashNpbIntegrity } from "../src/data/npb-integrity-audit";

it("batch counts exactly match correlated evidence, including empty/unknown outs and foreign-team Facts, without per-Game Fact scans", async () => {
  const client = openDataClient("file::memory:");
  try {
    await migrateData(client);
    for (let i=0;i<40;i++) {
      const id=`fixture-${i}`;
      await client.execute({sql:"INSERT INTO npb_games VALUES (?,2026,'2026-10-07','home','away',?,NULL,NULL,'final',0,0,'nf3',?,'https://nf3.sakura.ne.jp/','2026-10-08','hash')",args:[id,i+1,id]});
      if(i===0)continue; // absent COUNT=0, SUM=null
      await client.execute({sql:"INSERT INTO player_game_batting (game_id,player_id,team_id,pa,source_key,source_record_id,collected_at) VALUES (?,'batter','home',?,'nf3',?,'2026-10-08')",args:[id,i%2?null:0,id]});
      for(const [n,team,outs] of [[0,"home",i%2?null:0],[1,"away",1],[2,"unknown",27]] as const)
        await client.execute({sql:"INSERT INTO player_game_pitching (fact_id,game_id,player_id,team_id,ip_outs,source_key,source_record_id,collected_at) VALUES (?,?,'pitcher',?,?,'nf3',?,'2026-10-08')",args:[id+n,id,team,outs,id+n]});
    }
    const old=`SELECT g.game_id,
      (SELECT COUNT(*) FROM player_game_batting b WHERE b.game_id=g.game_id) AS saved_batting,
      (SELECT COUNT(*) FROM player_game_batting b WHERE b.game_id=g.game_id AND b.pa IS NULL) AS unknown_pa,
      (SELECT COUNT(*) FROM player_game_pitching p WHERE p.game_id=g.game_id) AS saved_pitching,
      (SELECT SUM(ip_outs) FROM player_game_pitching p WHERE p.game_id=g.game_id AND p.team_id=g.home_team_id) AS home_outs,
      (SELECT SUM(ip_outs) FROM player_game_pitching p WHERE p.game_id=g.game_id AND p.team_id=g.away_team_id) AS away_outs
      FROM npb_games g ORDER BY g.game_id`;
    const batched=`SELECT g.game_id,COALESCE(bc.saved_batting,0) AS saved_batting,
      COALESCE(bc.unknown_pa,0) AS unknown_pa,COALESCE(pc.saved_pitching,0) AS saved_pitching,pc.home_outs,pc.away_outs
      FROM npb_games g ${npbGameFactCountsJoins} ORDER BY g.game_id`;
    expect((await client.execute(batched)).rows).toEqual((await client.execute(old)).rows);
    const oldPlan=JSON.stringify((await client.execute("EXPLAIN QUERY PLAN "+old)).rows),newPlan=JSON.stringify((await client.execute("EXPLAIN QUERY PLAN "+batched)).rows);
    expect(oldPlan).toContain("CORRELATED SCALAR SUBQUERY");expect(newPlan).not.toContain("CORRELATED SCALAR SUBQUERY");
    expect(newPlan).toContain("MATERIALIZE pc");expect(newPlan).toContain("MATERIALIZE bc");
    expect(batched).toMatch(/^SELECT\b/); expect(batched).not.toContain(";");
    expect((await client.execute("SELECT COUNT(*) AS n FROM player_game_pitching")).rows[0]?.n).toBe(117);
  } finally { client.close(); }
});
it("runs projection, lifecycle and integrity through the existing unchanged SELECT-only safety boundary", async () => {
  const client=openDataClient("file::memory:");
  try {
    await migrateData(client);
    await client.execute("INSERT INTO npb_games VALUES ('npb:game:11111111111111111111',2026,'2026-10-08','npb:team:hawks','npb:team:fighters',1,NULL,NULL,'final',1,0,'nf3','synthetic','https://nf3.sakura.ne.jp/','2026-10-08','hash')");
    const before=await hashNpbIntegrity(client),strict=selectOnlyClient(client);
    expect((await readNpbGameIndex(strict,"2026-10-08")).rows).toBe(1);
    expect((await inspectNpbCalendar(strict,"2026-10-19")).pendingSavedGames).toBe(1);
    expect((await auditNpbIntegrity(strict,{from:"2026-10-08",to:"2026-10-08",timeZone:"Asia/Tokyo"},"2026-10-08")).pendingGames).toHaveLength(1);
    expect(await hashNpbIntegrity(client)).toEqual(before);
    await expect(strict.execute("WITH example AS (SELECT 1) SELECT * FROM example")).rejects.toThrow("one SELECT only");
    await expect(strict.execute("UPDATE npb_games SET status='final'")).rejects.toThrow("one SELECT only");
  } finally { client.close(); }
});
