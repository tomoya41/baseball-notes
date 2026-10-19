/** Read each Fact table once, not once per Game. No writes or evidence shortcuts.
 * COUNT's absent group stays zero; SUM's absent/all-null input stays null.
 * MATERIALIZED prevents a correlated rescan in the surrounding diagnostic.
 */
export const npbGameFactCountsCte = `WITH batting_counts AS MATERIALIZED (
  SELECT game_id,COUNT(*) AS saved_batting,
    SUM(CASE WHEN pa IS NULL THEN 1 ELSE 0 END) AS unknown_pa
  FROM player_game_batting GROUP BY game_id
), pitching_counts AS MATERIALIZED (
  SELECT p.game_id,COUNT(*) AS saved_pitching,
    SUM(CASE WHEN p.team_id=g.home_team_id THEN p.ip_outs END) AS home_outs,
    SUM(CASE WHEN p.team_id=g.away_team_id THEN p.ip_outs END) AS away_outs
  FROM player_game_pitching p JOIN npb_games g ON g.game_id=p.game_id GROUP BY p.game_id
)`;
export const npbGameFactCountsJoins = `LEFT JOIN batting_counts bc ON bc.game_id=g.game_id
  LEFT JOIN pitching_counts pc ON pc.game_id=g.game_id`;
