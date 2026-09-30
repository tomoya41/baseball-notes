import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openDataClient } from "../src/data/database";
import { HISTORICAL_SEASONS, historicalId, type HistoricalGame } from "../src/data/mlb-historical";
import { historicalPlays, RetrosheetPaParser, validatePaGame } from "../src/data/mlb-retrosheet-pa";
import { createHistoricalPaTables, replaceHistoricalPaGame } from "../src/data/mlb-pa-repository";
import type { HistoricalPlateAppearance } from "../src/domain/mlb-plate-appearance";

const args = process.argv.slice(2);
const value = (key: string, fallback: string) => args.includes(key) ? args[args.indexOf(key) + 1] ?? fallback : fallback;
const database = value("--db", ".data/mlb-historical.sqlite"), cache = value("--cache", ".data");
const seasonFilter = Number(value("--season", "0"));
const started = performance.now(), beforeBytes = (await stat(database)).size;
const client = openDataClient(`file:${database}`);
await createHistoricalPaTables(client);
const identities = new Map((await client.execute("SELECT source_id,canonical_id FROM mlb_historical_mappings WHERE namespace='retrosheet'")).rows
  .map(row => [String(row.source_id), String(row.canonical_id)]));
const seasons = [];
let dbWrites = 0, dbReads = 1;
for (const season of HISTORICAL_SEASONS.filter(year => !seasonFilter || year === seasonFilter)) {
  const gameRows = (await client.execute({ sql: `SELECT game_id,payload_json,r.games AS expected_games
    FROM mlb_historical_games g JOIN mlb_historical_releases r ON g.season=r.season
    WHERE g.season=? AND r.validation_issues=0`, args: [season] })).rows;
  const games = new Map(gameRows
    .map(row => [String(row.game_id), JSON.parse(String(row.payload_json)) as HistoricalGame]));
  dbReads++;
  const seen = new Set<string>();
  const report = { season, expectedGames: Number(gameRows[0]?.expected_games ?? 0), games: games.size, gamesWithPbp: 0, reconstructedGames: 0, paRows: 0, skippedGames: 0,
    parserFailures: 0, identityUnresolved: 0, mismatches: [] as ReturnType<typeof validatePaGame>,
    stateIssues: {} as Record<string, number>, failed: [] as { gameId: string; reason: string }[],
    stateDetails: [] as { gameId: string; code: string; sequence: string; previousSequence: string | null }[],
    unknownStartContexts: 0, substitutionDuringPa: 0, countKnownPa: 0 };
  let currentId = "", rows: HistoricalPlateAppearance[] = [], parser: RetrosheetPaParser | null = null, failed: string | null = null;
  const flush = async () => {
    if (!currentId) return;
    seen.add(currentId); report.gamesWithPbp++;
    const game = games.get(currentId);
    if (!game || failed || !parser) {
      report.parserFailures++; report.failed.push({ gameId: currentId, reason: failed ?? "Game missing" });
      if (failed?.includes("identity")) report.identityUnresolved++;
      return;
    }
    const mismatches = validatePaGame(game, rows);
    report.mismatches.push(...mismatches);
    for (const issue of parser.issues) report.stateIssues[issue] = (report.stateIssues[issue] ?? 0) + 1;
    report.stateDetails.push(...parser.stateDetails.map(detail => ({ gameId: currentId, ...detail })));
    const totalIssues = parser.finish();
    for (const issue of totalIssues) report.stateIssues[issue] = (report.stateIssues[issue] ?? 0) + 1;
    report.reconstructedGames++; report.paRows += rows.length;
    report.substitutionDuringPa += rows.filter(row => row.substitutionDuringPa).length;
    report.unknownStartContexts += rows.filter(row => row.outsBefore === null || row.baseStateBefore === null || row.battingScoreBefore === null).length;
    const gameReport = { mismatches, stateIssues: parser.issues, stateDetails: parser.stateDetails, totalIssues };
    const hash = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    dbWrites += await replaceHistoricalPaGame(client, currentId, season, rows, hash, gameReport); dbReads++;
  };
  const bytes = await readFile(join(cache, `${season}csvs.zip`));
  for await (const row of historicalPlays(bytes, season)) {
    const gameId = historicalId("game", row.gid!);
    // Retrosheet game identity uses the same adapter namespace as the Core.
    if (gameId !== currentId) {
      await flush();
      if (seen.has(gameId)) throw new Error("Non-contiguous or duplicate source Game");
      currentId = gameId; rows = []; failed = null;
      const game = games.get(gameId); parser = game ? new RetrosheetPaParser(game, identities) : null;
    }
    if (!parser || failed) continue;
    try { const pa = parser.consume(row); if (pa) { rows.push(pa); if (/^[0-3][0-2]$/.test(row.count ?? "")) report.countKnownPa++; } }
    catch (error) { failed = error instanceof Error ? error.message : "Parser error"; }
  }
  await flush();
  report.skippedGames = [...games.keys()].filter(id => !seen.has(id)).length;
  seasons.push(report);
  console.log(JSON.stringify({ season, games: report.games, reconstructed: report.reconstructedGames, paRows: report.paRows,
    mismatches: report.mismatches.length, stateIssues: report.stateIssues, failed: report.failed.slice(0, 3) }));
}
await client.execute("PRAGMA wal_checkpoint(TRUNCATE)");
const total = { seasons, dbReads, dbWrites, beforeBytes, afterBytes: (await stat(database)).size,
  httpRequests: 0, retries: 0, runtimeMs: Math.round(performance.now() - started) };
await writeFile(value("--report", ".data/mlb-pa-validation.json"), JSON.stringify(total, null, 2));
console.log(JSON.stringify({ dbWrites, dbReads, beforeBytes, afterBytes: total.afterBytes, runtimeMs: total.runtimeMs }));
client.close();
