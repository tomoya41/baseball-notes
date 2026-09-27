import { openDataClient } from "../src/data/database";
const url=process.env.TURSO_DATABASE_URL,token=process.env.TURSO_AUTH_TOKEN;
if(!url||url.startsWith("file:")||!token)throw Error("Remote read-only connection required");
const client=openDataClient(url,token),started=performance.now();
try {
  const result=await client.execute(`SELECT g.game_id,g.game_date,g.home_team_id,g.away_team_id,
    g.home_score,g.away_score,g.status,c.game_status,c.expected_batters,c.collected_batters,
    c.expected_pitchers,c.collected_pitchers,c.checks_json,c.issues_json,
    (SELECT COUNT(*) FROM player_game_batting b WHERE b.game_id=g.game_id) AS saved_batting,
    (SELECT COUNT(*) FROM player_game_pitching p WHERE p.game_id=g.game_id) AS saved_pitching
    FROM npb_games g JOIN npb_game_completeness c ON g.game_id=c.game_id
    WHERE c.game_status<>'complete' ORDER BY g.game_date,g.game_id`);
  // Batch SQL, not a round trip per Player/Game. No production mutation.
  console.log(JSON.stringify({queryCount:1,rows:result.rows.map(r=>({...r,
    checks:JSON.parse(String(r.checks_json)),issues:JSON.parse(String(r.issues_json)),
    checks_json:undefined,issues_json:undefined,
    requiredEvidence:"Independent explicit final status, final inning/end outs, score and complete participants"})),
    elapsedMs:performance.now()-started}));
} finally {client.close();}
