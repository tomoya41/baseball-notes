import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { openDataClient } from "../src/data/database";
import { classifyPitcherRole } from "../src/domain/player-pitcher-role";

type Row = Record<string, unknown>;
const required = ["ab", "walks", "hbp", "sacrifice_hits", "sacrifice_flies"] as const;
const battingMetrics = ["pa", "ab", "hits", "doubles", "triples", "home_runs", "rbi", "walks", "hbp",
  "sacrifice_hits", "sacrifice_flies", "strikeouts", "sb", "cs"] as const;
const pitchingMetrics = ["ip_outs", "batters_faced", "hits", "home_runs", "strikeouts", "runs", "earned_runs",
  "pitches", "walks_and_hit_batters", "decision"] as const;
const known = (value: unknown) => value !== null && value !== undefined;
const num = (value: unknown) => Number(value);
const text = (value: unknown) => String(value ?? "");

// The collector also verifies the source PA token count and rejects unsupported
// events. Stored counting fields alone cannot reverse that intentional null.
export function assessStoredPa(row: Row, sourceDetailVerified = false) {
  if (known(row.pa)) return { kind: row.pa === 0 ? "known_zero" : "known", safelyDerivable: false } as const;
  const fieldsKnown = required.every((field) => known(row[field]));
  return { kind: fieldsKnown ? "field_complete_unverified" : "missing_fields",
    safelyDerivable: fieldsKnown && sourceDetailVerified } as const;
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url || url.startsWith("file:") || !token) throw new Error("A remote read-only connection is required");
  const client = openDataClient(url, token);
  let queries = 0;
  const started = performance.now();
  const read = async (sql: string): Promise<Row[]> => {
    queries++;
    return (await client.execute(sql)).rows as Row[];
  };
  const countsSql = `SELECT
    (SELECT count(*) FROM npb_games) AS games,
    (SELECT count(*) FROM player_game_batting) AS batting,
    (SELECT count(*) FROM player_game_pitching) AS pitching,
    (SELECT count(*) FROM source_entity_mappings) AS mappings`;
  try {
    const before = (await read(countsSql))[0]!;
    const [games, batting, pitching, mappings, completeness, masters, plateAppearances, pitcherAppearances] = await Promise.all([
      read("SELECT game_id,game_date,home_team_id,away_team_id,home_score,away_score,status FROM npb_games"),
      read(`SELECT game_id,player_id,team_id,batting_order,starter,collected_at,source_record_id,${battingMetrics.join(",")} FROM player_game_batting`),
      read(`SELECT game_id,player_id,team_id,role,starter,appearance_order,${pitchingMetrics.join(",")} FROM player_game_pitching`),
      read("SELECT source_entity_id,internal_entity_id FROM source_entity_mappings WHERE source_key='nf3' AND entity_kind='player'"),
      read("SELECT game_id,game_status,batting_status,pitching_status,expected_batters,mapped_batters,expected_pitchers,mapped_pitchers,checks_json,issues_json,verified_at FROM npb_game_completeness"),
      read("SELECT entity_id,valid_from,payload_json FROM master_history WHERE entity_kind='player' ORDER BY valid_from DESC"),
      read("SELECT count(*) AS count FROM plate_appearances"),
      read("SELECT count(*) AS count FROM pitcher_appearances"),
    ]);
    const after = (await read(countsSql))[0]!;
    const nameById = new Map<string, string>();
    for (const row of masters) {
      const id = text(row.entity_id);
      if (!nameById.has(id)) {
        const payload = JSON.parse(text(row.payload_json)) as { name?: string };
        nameById.set(id, payload.name ?? "");
      }
    }
    const gameById = new Map(games.map((row) => [text(row.game_id), row]));
    const statusById = new Map(completeness.map((row) => [text(row.game_id), row]));
    const unknownPa = batting.filter((row) => !known(row.pa));
    const candidates = unknownPa.filter((row) => assessStoredPa(row).kind === "field_complete_unverified");
    const missingFields = Object.fromEntries(required.map((field) => [field,
      unknownPa.filter((row) => !known(row[field])).length]));
    const byGame = [...new Set(unknownPa.map((row) => text(row.game_id)))].map((id) => ({
      gameId: id, date: gameById.get(id)?.game_date, status: statusById.get(id)?.game_status,
      count: unknownPa.filter((row) => text(row.game_id) === id).length,
    })).sort((a, b) => b.count - a.count || a.gameId.localeCompare(b.gameId));
    const byTeam = [...new Set(unknownPa.map((row) => text(row.team_id)))].map((id) => ({
      teamId: id, count: unknownPa.filter((row) => text(row.team_id) === id).length,
    })).sort((a, b) => b.count - a.count || a.teamId.localeCompare(b.teamId));
    const unknownExamples = unknownPa.map((row) => ({
      gameId: row.game_id, date: gameById.get(text(row.game_id))?.game_date, teamId: row.team_id,
      playerId: row.player_id, name: nameById.get(text(row.player_id)),
      pa: row.pa, ab: row.ab, walks: row.walks, hbp: row.hbp,
      sacrificeHits: row.sacrifice_hits, sacrificeFlies: row.sacrifice_flies,
      starter: row.starter, battingOrder: row.batting_order,
      collectedAt: row.collected_at,
      legacyCuratedSourceRecord: text(row.source_record_id).endsWith(text(row.player_id)),
      missingFields: required.filter((field) => !known(row[field])),
      gameStatus: statusById.get(text(row.game_id))?.game_status,
      gameVerifiedAt: statusById.get(text(row.game_id))?.verified_at,
    }));
    const slots = new Map<string, Row[]>();
    for (const row of batting) {
      if (!Number.isInteger(num(row.batting_order)) || num(row.batting_order) < 1 || num(row.batting_order) > 9) continue;
      const key = `${row.game_id}|${row.team_id}|${row.batting_order}`;
      slots.set(key, [...(slots.get(key) ?? []), row]);
    }
    const sharedSlots = [...slots.entries()].filter(([, rows]) => rows.length > 1).map(([key, rows]) => ({
      gameId: key.split("|")[0], teamId: key.split("|")[1], battingOrder: Number(key.split("|")[2]),
      players: rows.map((row) => ({ playerId: row.player_id, name: nameById.get(text(row.player_id)), starter: row.starter })),
    }));
    const roles = pitching.map((row) => classifyPitcherRole({ role: row.role as "starter" | "reliever" | "unknown",
      starter: row.starter === null ? null : num(row.starter) === 1 }));
    const selected = (gameId: string) => ({
      game: gameById.get(gameId), completeness: statusById.get(gameId) && {
        gameStatus: statusById.get(gameId)?.game_status,
        battingStatus: statusById.get(gameId)?.batting_status,
        pitchingStatus: statusById.get(gameId)?.pitching_status,
        expectedBatters: statusById.get(gameId)?.expected_batters,
        mappedBatters: statusById.get(gameId)?.mapped_batters,
        expectedPitchers: statusById.get(gameId)?.expected_pitchers,
        mappedPitchers: statusById.get(gameId)?.mapped_pitchers,
        checks: JSON.parse(text(statusById.get(gameId)?.checks_json)),
        issues: JSON.parse(text(statusById.get(gameId)?.issues_json)),
      },
      batting: batting.filter((row) => row.game_id === gameId).map((row) => ({
        playerId: row.player_id, name: nameById.get(text(row.player_id)), teamId: row.team_id,
        battingOrder: row.batting_order, starter: row.starter, pa: row.pa, ab: row.ab, walks: row.walks,
        hbp: row.hbp, sacrificeHits: row.sacrifice_hits, sacrificeFlies: row.sacrifice_flies,
      })),
      pitching: pitching.filter((row) => row.game_id === gameId).map((row) => ({
        playerId: row.player_id, name: nameById.get(text(row.player_id)), teamId: row.team_id,
        role: classifyPitcherRole({ role: row.role as "starter" | "reliever" | "unknown",
          starter: row.starter === null ? null : num(row.starter) === 1 }),
        appearanceOrder: row.appearance_order, outs: row.ip_outs, bf: row.batters_faced,
        pitches: row.pitches, decision: row.decision,
      })),
    });
    const multiPitcher = [...new Set(pitching.map((row) => text(row.game_id)))].map((id) => ({
      gameId: id, pitchers: pitching.filter((row) => row.game_id === id).length,
    })).sort((a, b) => b.pitchers - a.pitchers || a.gameId.localeCompare(b.gameId))[0];
    const report = {
      auditedAt: new Date().toISOString(), before, after, unchanged: JSON.stringify(before) === JSON.stringify(after),
      queries, durationMs: Math.round(performance.now() - started),
      rows: { games: games.length, batting: batting.length, pitching: pitching.length, mappings: mappings.length,
        plateAppearances: num(plateAppearances[0]?.count), pitcherAppearances: num(pitcherAppearances[0]?.count) },
      games: {
        status: Object.fromEntries([...new Set(games.map((row) => text(row.status)))].map((status) => [status,
          games.filter((row) => row.status === status).length])),
        scoreKnown: games.filter((row) => known(row.home_score) && known(row.away_score)).length,
        completeness: Object.fromEntries([...new Set(completeness.map((row) => text(row.game_status)))].map((status) => [status,
          completeness.filter((row) => row.game_status === status).length])),
      },
      batting: {
        paKnown: batting.length - unknownPa.length, paZero: batting.filter((row) => row.pa === 0).length,
        paUnknown: unknownPa.length, fieldCompleteButPaNull: candidates.length,
        safelyDerivableWithStoredValidation: candidates.filter((row) => assessStoredPa(row).safelyDerivable).length,
        missingFields, unknownByGame: byGame, unknownByTeam: byTeam, unknownExamples,
        battingOrderValid: batting.filter((row) => Number.isInteger(num(row.batting_order)) &&
          num(row.batting_order) >= 1 && num(row.batting_order) <= 9 && known(row.batting_order)).length,
        battingOrderMissing: batting.filter((row) => !known(row.batting_order)).length,
        battingOrderInvalid: batting.filter((row) => known(row.batting_order) && (!Number.isInteger(num(row.batting_order)) ||
          num(row.batting_order) < 1 || num(row.batting_order) > 9)).length,
        starterTrue: batting.filter((row) => row.starter === 1).length,
        starterFalse: batting.filter((row) => row.starter === 0).length,
        starterUnknown: batting.filter((row) => !known(row.starter)).length,
        sharedSlotGames: new Set(sharedSlots.map((slot) => slot.gameId)).size,
        sharedSlotCount: sharedSlots.length, sharedSlotFacts: sharedSlots.reduce((sum, slot) => sum + slot.players.length, 0),
        sharedSlots, fieldKnown: Object.fromEntries(battingMetrics.map((field) => [field,
          batting.filter((row) => known(row[field])).length])),
      },
      pitching: {
        starter: roles.filter((role) => role === "starter").length,
        reliever: roles.filter((role) => role === "reliever").length,
        unknown: roles.filter((role) => role === "unknown").length,
        appearanceOrderKnown: pitching.filter((row) => known(row.appearance_order)).length,
        decisions: Object.fromEntries([...new Set(pitching.map((row) => text(row.decision)))].map((decision) => [decision,
          pitching.filter((row) => text(row.decision) === decision).length])),
        fieldKnown: Object.fromEntries(pitchingMetrics.map((field) => [field,
          pitching.filter((row) => known(row[field])).length])),
      },
      selected: {
        september25: selected("npb:game:32c76ee9e92f7408892c"),
        september26: selected("npb:game:bc2263e9378878e3fbe9"),
        september23GiantsCarp: (() => {
          const game = games.find((row) => row.game_date === "2026-09-23" &&
            [row.home_team_id, row.away_team_id].includes("npb:team:giants") &&
            [row.home_team_id, row.away_team_id].includes("npb:team:carp"));
          return game ? selected(text(game.game_id)) : null;
        })(),
        multiPitcher: multiPitcher ? selected(multiPitcher.gameId) : null,
      },
      robertoOsuna: {
        playerId: "a4d2116b-07d3-4a7a-8f8e-32f6d28759e4",
        mapped: mappings.some((row) => row.internal_entity_id === "a4d2116b-07d3-4a7a-8f8e-32f6d28759e4"),
        pitchingFacts: pitching.filter((row) => row.player_id === "a4d2116b-07d3-4a7a-8f8e-32f6d28759e4").length,
      },
    };
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } finally {
    client.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`NPB fact quality audit failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
  });
}
