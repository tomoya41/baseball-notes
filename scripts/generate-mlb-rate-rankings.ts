import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { openDataClient } from "../src/data/database";
import { HISTORICAL_SEASONS, historicalTeamId, type HistoricalGame, type HistoricalPlayer } from "../src/data/mlb-historical";
import { mlb2025Teams } from "../src/data/retrosheet";
import { battingAggregate, pitchingAggregate, type DatedBatter, type DatedPitcher } from "../src/domain/mlb-historical-aggregate";
import { battingRateQualification, mlbBattingQualification, pitchingRateQualification, scheduledMlbGames } from "../src/domain/mlb-ranking-qualification";

const args = process.argv.slice(2), get = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] ?? fallback : fallback;
const root = join(get("--output", ".data/mlb-public"), "data/mlb/historical");
const client = openDataClient(`file:${get("--db", ".data/mlb-historical.sqlite")}`);
const started = performance.now();
const players = new Map((await client.execute("SELECT player_id,payload_json FROM mlb_historical_players")).rows.map(row =>
  [String(row.player_id), JSON.parse(String(row.payload_json)) as HistoricalPlayer]));
const groups = new Map(mlb2025Teams.map(team => [historicalTeamId(team.sourceId), team.group.slice(0, 2)]));
const report = [];
const releases = new Map((await client.execute("SELECT season,games,validation_issues FROM mlb_historical_releases")).rows
  .map(row => [Number(row.season), { games: Number(row.games), issues: Number(row.validation_issues) }]));
async function json(path: string, payload: unknown) {
  const file = join(root, `${path}.gz`); await mkdir(dirname(file), { recursive: true });
  await writeFile(file, gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 }));
}
for (const season of HISTORICAL_SEASONS) {
  const games = (await client.execute({ sql: "SELECT payload_json FROM mlb_historical_games WHERE season=?", args: [season] })).rows
    .map(row => JSON.parse(String(row.payload_json)) as HistoricalGame);
  const release = releases.get(season);
  const coverageComplete = games.length > 0 && games.length === release?.games && release.issues === 0 &&
    games.every(game => game.validationIssues.length === 0);
  const from = games.reduce((value, game) => game.date < value ? game.date : value, "9999-12-31");
  const to = games.reduce((value, game) => game.date > value ? game.date : value, "0000-01-01");
  const b = new Map<string, DatedBatter[]>(), p = new Map<string, DatedPitcher[]>();
  for (const game of games) {
    const context = (teamId: string) => ({ gameId: game.id, date: game.date, season,
      home: teamId === game.homeTeamId, opponentTeamId: teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId });
    for (const row of game.batting) { const key = `${groups.get(row.teamId)}:${row.playerId}`;
      const rows = b.get(key) ?? []; rows.push({ ...row, ...context(row.teamId) }); b.set(key, rows); }
    for (const row of game.pitching) { const key = `${groups.get(row.teamId)}:${row.playerId}`;
      const rows = p.get(key) ?? []; rows.push({ ...row, ...context(row.teamId) }); p.set(key, rows); }
  }
  const bTotals = [...b].map(([key, rows]) => ({ group: key.slice(0, 2), playerId: rows[0]!.playerId,
    metrics: battingAggregate(rows[0]!.playerId, rows, from, to).metrics }));
  const pTotals = [...p].map(([key, rows]) => ({ group: key.slice(0, 2), playerId: rows[0]!.playerId,
    metrics: pitchingAggregate(rows[0]!.playerId, rows, from, to).metrics }));
  const records = [];
  const diagnostics = [];
  for (const group of ["AL", "NL"] as const) for (const metric of ["AVG", "OBP", "SLG", "OPS", "ERA", "K9"] as const) {
    const role = metric === "ERA" || metric === "K9" ? "pitching" : "batting";
    const totals = role === "batting" ? bTotals.filter(row => row.group === group) : pTotals.filter(row => row.group === group);
    const qualifiedValues = role === "batting" ? bTotals.filter(row => row.group === group && mlbBattingQualification(season, row.metrics.PA.value) === "qualified")
      .map(row => row.metrics[metric as "AVG"].value).filter((value): value is number => value !== null) : [];
    const ordinaryLeader = qualifiedValues.length ? Math.max(...qualifiedValues) : null;
    // Several short-PA candidates could beat the ordinary leader. Only those
    // whose adjusted rate is the highest among all candidates get the exception.
    const leader = role === "batting" && metric !== "OPS" && ordinaryLeader !== null ? Math.max(ordinaryLeader,
      ...bTotals.filter(row => row.group === group).map(row =>
        battingRateQualification(season, row.metrics, metric as "AVG", coverageComplete, ordinaryLeader).adjustedValue ?? -Infinity)) : ordinaryLeader;
    const entries = totals.map(row => {
      const metrics = row.metrics as unknown as Record<string, import("../src/domain/player-period").AggregateMetric>;
      const qualification = role === "batting" ? battingRateQualification(season, metrics, metric as "AVG", coverageComplete, leader) :
        { state: pitchingRateQualification(season, metrics, metric as "ERA", coverageComplete),
          adjustedValue: metrics[metric]?.value ?? null, requiredPa: null, missingPa: null, reason: "ordinary_scheduled_league_ip_threshold" };
      diagnostics.push({ group, metric, playerId: row.playerId, ...qualification });
      return { playerId: row.playerId, name: players.get(row.playerId)!.name, value: metrics[metric]?.value ?? null,
        rankingValue: qualification.adjustedValue, qualification: qualification.state, missingPa: qualification.missingPa,
        sample: role === "batting" ? metrics.PA!.value : metrics.outsRecorded!.value };
    }).filter((row): row is typeof row & { value: number; rankingValue: number } =>
      row.value !== null && row.rankingValue !== null && ["qualified", "qualified_by_exception"].includes(row.qualification));
    entries.sort((a, b) => (metric === "ERA" ? a.rankingValue - b.rankingValue : b.rankingValue - a.rankingValue) ||
      a.name.localeCompare(b.name, "en") || a.playerId.localeCompare(b.playerId));
    records.push({ metric, role, group, classification: "rate", rows: (coverageComplete ? entries : []).slice(0, 20).map((row, index) =>
      ({ ...row, rank: entries.findIndex(other => other.rankingValue === row.rankingValue) + 1 || index + 1 })) });
  }
  const path = `records/${season}.json`;
  const old = JSON.parse(gunzipSync(await readFile(join(root, `${path}.gz`))).toString("utf8"));
  await json(path, { ...old, rate: coverageComplete ? "ready" : "not_ready", qualifier: "verified", requiredPa: Math.round(scheduledMlbGames(season)! * 3.1),
    requiredOuts: scheduledMlbGames(season)! * 3, records: [...old.records.filter((row: { classification?: string }) => row.classification !== "rate"), ...records] });
  const seasonPath = `seasons/${season}.json`;
  const seasonPayload = JSON.parse(gunzipSync(await readFile(join(root, `${seasonPath}.gz`))).toString("utf8"));
  await json(seasonPath, { ...seasonPayload, ranking: { counting: "ready", rate: coverageComplete ? "ready" : "not_ready", qualifier: "verified" } });
  report.push({ season, diagnostics, qualificationCounts: diagnostics.reduce((counts, row) => {
    counts[row.state] = (counts[row.state] ?? 0) + 1; return counts;
  }, {} as Record<string, number>) });
}
client.close();
await writeFile(get("--report", ".data/mlb-ranking-validation.json"), JSON.stringify({ report, selects: 8, runtimeMs: Math.round(performance.now() - started) }, null, 2));
console.log(JSON.stringify(report.map(row => ({ season: row.season, counts: row.qualificationCounts }))));
