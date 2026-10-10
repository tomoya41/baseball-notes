import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { unzipSync } from "fflate";
import { openDataClient } from "../src/data/database";
import { chadwickBridge, HISTORICAL_SEASONS, historicalId, historicalTeamId, importHistoricalSeason, verifyHistoricalIdentityBridge } from "../src/data/mlb-historical";
import { mlb2025Teams } from "../src/data/retrosheet";
import type { HistoricalGame, HistoricalPlayer } from "../src/data/mlb-historical";
import { battingAggregate, pitchingAggregate } from "../src/domain/mlb-historical-aggregate";
import { mlbBattingQualification, mlbPitchingQualification } from "../src/domain/mlb-ranking-qualification";
import type { DatedBatter, DatedPitcher } from "../src/domain/mlb-historical-aggregate";
import { competitionTypeSchema } from "../src/domain/competition";
import { buildPostseasonHub } from "../src/data/mlb-postseason";

const args = process.argv.slice(2);
const value = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
};
const cache = value("--cache", ".data");
const output = value("--output", ".data/mlb-public");
const competition = competitionTypeSchema.parse(value("--competition", "regular"));
const database = value("--db", competition === "postseason" ? ".data/mlb-postseason.sqlite" : ".data/mlb-historical.sqlite");
const download = args.includes("--download");
const selectedSeasons = value("--seasons", HISTORICAL_SEASONS.join(",")).split(",").map(Number);
if (!selectedSeasons.length || new Set(selectedSeasons).size !== selectedSeasons.length ||
  selectedSeasons.some(year => !(HISTORICAL_SEASONS as readonly number[]).includes(year))) throw new Error("Unsupported/duplicate season selection");
selectedSeasons.sort((a, b) => a - b);
const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const source = "https://www.retrosheet.org/downloads";
const root = join(output, "data", "mlb", "historical", ...(competition === "postseason" ? ["postseason"] : []));
const started = performance.now();
let requests = 0;
let downloadBytes = 0;
let extractedBytes = 0;
let parsingMs = 0;
let dbWrites = 0;

async function archive(path: string, url: string): Promise<Uint8Array> {
  try { return await readFile(path); } catch {
    if (!download) throw new Error(`Archive missing: ${path}; rerun with --download`);
    const response = await fetch(url);
    requests++;
    if (!response.ok) throw new Error(`Archive HTTP ${response.status}: ${url}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    downloadBytes += bytes.byteLength;
    await mkdir(cache, { recursive: true });
    await writeFile(path, bytes);
    return bytes;
  }
}
async function json(relative: string, payload: unknown) {
  const path = join(root, `${relative}.gz`);
  await mkdir(dirname(path), { recursive: true });
  const scoped = competition === "postseason" ? { ...(payload as object), competitionType: "postseason" } : payload;
  await writeFile(path, gzipSync(Buffer.from(JSON.stringify(scoped)), { level: 9 }));
}
const register = await archive(join(cache, "chadwick-register.zip"),
  "https://codeload.github.com/chadwickbureau/register/zip/refs/heads/master");
extractedBytes += Object.values(unzipSync(register)).reduce((n, content) => n + content.byteLength, 0);
const bridge = chadwickBridge(register);
const client = openDataClient(`file:${database}`);
await client.executeMultiple(`
  CREATE TABLE IF NOT EXISTS mlb_historical_games (
    game_id TEXT PRIMARY KEY, season INTEGER NOT NULL, game_date TEXT NOT NULL,
    payload_json TEXT NOT NULL, content_sha256 TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS mlb_historical_games_date ON mlb_historical_games(season,game_date);
  CREATE TABLE IF NOT EXISTS mlb_historical_players (
    player_id TEXT PRIMARY KEY, payload_json TEXT NOT NULL, content_sha256 TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS mlb_historical_mappings (
    namespace TEXT NOT NULL, source_id TEXT NOT NULL, canonical_id TEXT NOT NULL,
    PRIMARY KEY(namespace,source_id)
  );
  CREATE TABLE IF NOT EXISTS mlb_historical_releases (
    season INTEGER PRIMARY KEY, archive_sha256 TEXT NOT NULL, games INTEGER NOT NULL,
    batting_facts INTEGER NOT NULL, pitching_facts INTEGER NOT NULL,
    validation_issues INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS mlb_historical_identity_release (
    provider TEXT PRIMARY KEY, archive_sha256 TEXT NOT NULL
  );
`);
const registerHash = sha(register);
const scopes = await client.execute("SELECT DISTINCT COALESCE(json_extract(payload_json,'$.competitionType'),'regular') AS scope FROM mlb_historical_games");
if (scopes.rows.some(row => row.scope !== competition))
  throw new Error("Competition database isolation required; select a different --db");
const gameHashes = new Map((await client.execute("SELECT game_id,content_sha256 FROM mlb_historical_games")).rows
  .map(row => [String(row.game_id), String(row.content_sha256)]));
const playerHashes = new Map((await client.execute("SELECT player_id,content_sha256 FROM mlb_historical_players")).rows
  .map(row => [String(row.player_id), String(row.content_sha256)]));
const mappingKeys = new Map((await client.execute("SELECT namespace,source_id,canonical_id FROM mlb_historical_mappings")).rows
  .map(row => [`${row.namespace}:${row.source_id}`, String(row.canonical_id)]));
verifyHistoricalIdentityBridge(bridge, mappingKeys);
const storedRegister = await client.execute("SELECT archive_sha256 FROM mlb_historical_identity_release WHERE provider='chadwick'");
if (String(storedRegister.rows[0]?.archive_sha256 ?? "") !== registerHash) {
  await client.execute({ sql: "INSERT INTO mlb_historical_identity_release VALUES ('chadwick',?) ON CONFLICT(provider) DO UPDATE SET archive_sha256=excluded.archive_sha256", args: [registerHash] });
  dbWrites++;
}
const games: HistoricalGame[] = [];
const players = new Map<string, HistoricalPlayer>();
const releases = [];
for (const season of selectedSeasons) {
  const bytes = await archive(join(cache, `${season}csvs.zip`), `${source}/${season}/${season}csvs.zip`);
  extractedBytes += Object.values(unzipSync(bytes)).reduce((n, content) => n + content.byteLength, 0);
  const parsedAt = performance.now();
  const result = importHistoricalSeason(bytes, season, bridge, competition);
  parsingMs += performance.now() - parsedAt;
  if (result.unresolvedRetrosheetIds.length || result.validationIssueCount) {
    throw new Error(`${season} blocked: ${result.unresolvedRetrosheetIds.length} identity, ${result.validationIssueCount} validation`);
  }
  if (competition === "regular" && (result.games.length < (season === 2020 ? 850 : 2400) || result.games.length > 2500))
    throw new Error(`${season} implausible Game count: ${result.games.length}`);
  if (competition === "postseason") await json(`hub/${season}.json`, buildPostseasonHub(result.games, sha(bytes), new Date().toISOString()));
  games.push(...result.games);
  for (const player of result.players) {
    const current = players.get(player.id);
    if (!current) players.set(player.id, player);
    else {
      current.seasons.push(season);
      for (const team of player.teamIds) if (!current.teamIds.includes(team)) current.teamIds.push(team);
      for (const position of player.positions) if (!current.positions.includes(position)) current.positions.push(position);
      if (player.name) current.name = player.name;
      if (player.bats) current.bats = player.bats;
      if (player.throws) current.throws = player.throws;
    }
  }
  // Game IDs and facts are written atomically per season in bounded SQLite batches.
  const gameWrites = result.games.flatMap(game => {
    const payload = JSON.stringify(game), hash = sha(payload);
    if (gameHashes.get(game.id) === hash) return [];
    gameHashes.set(game.id, hash);
    return [{ sql: `INSERT INTO mlb_historical_games VALUES (?,?,?,?,?) ON CONFLICT(game_id)
      DO UPDATE SET season=excluded.season,game_date=excluded.game_date,payload_json=excluded.payload_json,
      content_sha256=excluded.content_sha256`, args: [game.id, season, game.date, payload, hash] }];
  });
  for (let i = 0; i < gameWrites.length; i += 100) {
    await client.batch(gameWrites.slice(i, i + 100), "write"); dbWrites += Math.min(100, gameWrites.length - i);
  }
  const batting = result.games.reduce((n, game) => n + game.batting.length, 0);
  const pitching = result.games.reduce((n, game) => n + game.pitching.length, 0);
  const release = { season, archiveSha256: sha(bytes), games: result.games.length, batting,
    pitching, validationIssues: result.validationIssueCount, compressedBytes: bytes.byteLength };
  releases.push(release);
  const old = await client.execute({ sql: "SELECT archive_sha256 FROM mlb_historical_releases WHERE season=?", args: [season] });
  if (String(old.rows[0]?.archive_sha256 ?? "") !== release.archiveSha256) {
    await client.execute({ sql: `INSERT INTO mlb_historical_releases VALUES (?,?,?,?,?,?) ON CONFLICT(season)
      DO UPDATE SET archive_sha256=excluded.archive_sha256,games=excluded.games,
      batting_facts=excluded.batting_facts,pitching_facts=excluded.pitching_facts,
      validation_issues=excluded.validation_issues`,
    args: [season, release.archiveSha256, release.games, batting, pitching, release.validationIssues] });
    dbWrites++;
  }
}

const playerRows = [...players.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
const playerWrites = playerRows.flatMap(player => {
  const payload = JSON.stringify(player), hash = sha(payload);
  if (playerHashes.get(player.id) === hash) return [];
  return [{ sql: `INSERT INTO mlb_historical_players VALUES (?,?,?) ON CONFLICT(player_id)
    DO UPDATE SET payload_json=excluded.payload_json,content_sha256=excluded.content_sha256`,
  args: [player.id, payload, hash] }];
});
for (let i = 0; i < playerWrites.length; i += 100) {
  await client.batch(playerWrites.slice(i, i + 100), "write"); dbWrites += Math.min(100, playerWrites.length - i);
}
for (const [retro, chadwick] of bridge) {
  const candidate = historicalId("player", `chadwick:${chadwick}`);
  const id = players.has(candidate) ? candidate : null;
  if (!id) continue;
  for (const [namespace, sourceId] of [["retrosheet", retro], ["chadwick", chadwick]] as const) {
    const key = `${namespace}:${sourceId}`;
    const existing = mappingKeys.get(key);
    if (existing && existing !== id) throw new Error(`Canonical mapping changed for ${namespace} identity`);
    if (existing) continue;
    await client.execute({ sql: "INSERT INTO mlb_historical_mappings VALUES (?,?,?)",
      args: [namespace, sourceId, id] });
    mappingKeys.set(key, id); dbWrites++;
  }
}
const readback = await client.execute("SELECT COUNT(*) AS n FROM mlb_historical_games");
if (Number(readback.rows[0]?.n) !== games.length) throw new Error("Game repository readback mismatch");

// Static Pages output contains canonical references and aggregates only. Source keys remain local.
const gameMap = new Map(games.map(game => [game.id, game]));
const batterFacts = new Map<string, DatedBatter[]>();
const pitcherFacts = new Map<string, DatedPitcher[]>();
const byDate = new Map<string, HistoricalGame[]>();
for (const game of games) {
  const dateKey = `${game.season}/${game.date}`;
  byDate.set(dateKey, [...(byDate.get(dateKey) ?? []), game]);
  const decorate = (teamId: string) => ({ gameId: game.id, date: game.date, season: game.season,
    home: teamId === game.homeTeamId,
    opponentTeamId: teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId });
  for (const row of game.batting) batterFacts.set(row.playerId,
    [...(batterFacts.get(row.playerId) ?? []), { ...row, ...decorate(row.teamId) }]);
  for (const row of game.pitching) pitcherFacts.set(row.playerId,
    [...(pitcherFacts.get(row.playerId) ?? []), { ...row, ...decorate(row.teamId) }]);
}
for (const game of games) await json(`games/${game.id.replaceAll(":", "_")}.json`, {
  schemaVersion: 1, league: "MLB", source: "Retrosheet", game: {
    ...game, batting: game.batting.map(row => ({ ...row, name: players.get(row.playerId)?.name ?? null })),
    pitching: game.pitching.map(row => ({ ...row, name: players.get(row.playerId)?.name ?? null })),
  },
});
for (const [dateKey, rows] of byDate) await json(`schedule/${dateKey}.json`, {
  schemaVersion: 1, league: "MLB", season: rows[0]!.season, date: rows[0]!.date,
  games: rows.map(game => ({ id: game.id, date: game.date, homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId, homeRuns: game.homeRuns, awayRuns: game.awayRuns,
    status: "final", complete: game.validationIssues.length === 0, number: game.number })),
});
const seasons = [];
const seasonRanges = new Map<number, { from: string; to: string }>();
for (const season of selectedSeasons) {
  const seasonGames = games.filter(game => game.season === season);
  const seasonPlayers = playerRows.filter(player => player.seasons.includes(season));
  const from = seasonGames.reduce((min, game) => game.date < min ? game.date : min, "9999-12-31");
  const to = seasonGames.reduce((max, game) => game.date > max ? game.date : max, "0000-01-01");
  seasonRanges.set(season, { from, to });
  const aggregates = seasonPlayers.map(player => {
    const batting = batterFacts.get(player.id)?.filter(row => row.season === season) ?? [];
    const pitching = pitcherFacts.get(player.id)?.filter(row => row.season === season) ?? [];
    const b = batting.length ? battingAggregate(player.id, batting, from, to).metrics : null;
    const p = pitching.length ? pitchingAggregate(player.id, pitching, from, to).metrics : null;
    return { playerId: player.id, batting: b, pitching: p,
      battingQualification: competition === "regular" ? mlbBattingQualification(season, b?.PA.value ?? null) : { status: "unknown", reason: "Postseason leaders; no regular-season qualification" },
      pitchingQualification: competition === "regular" ? mlbPitchingQualification(season, p?.outsRecorded.value ?? null) : { status: "unknown", reason: "Postseason leaders; no regular-season qualification" } };
  });
  await json(`seasons/${season}.json`, { schemaVersion: 1, league: "MLB", season,
    coverage: "complete", firstDate: from, lastDate: to,
    gameCount: seasonGames.length, players: aggregates,
    ranking: { counting: "ready", rate: "not_ready", qualifier: "unknown" } });
  const byPlayer = new Map(aggregates.map(row => [row.playerId, row]));
  const records = ([
    ["H", "batting"], ["HR", "batting"], ["RBI", "batting"], ["SB", "batting"],
    ["SO", "pitching"], ["W", "pitching"], ["SV", "pitching"],
  ] as const).map(([metric, role]) => {
    const ranked = seasonPlayers.map(player => ({ playerId: player.id, name: player.name,
      value: byPlayer.get(player.id)?.[role]?.[metric]?.value ?? null }))
      .filter((row): row is { playerId: string; name: string; value: number } => row.value !== null)
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "en") || a.playerId.localeCompare(b.playerId));
    return { metric, role, rows: ranked.slice(0, 20).map((row, index) => ({ ...row,
      rank: index && ranked[index - 1]?.value === row.value ?
        ranked.findIndex(other => other.value === row.value) + 1 : index + 1 })) };
  });
  await json(`records/${season}.json`, { schemaVersion: 1, league: "MLB", season,
    coverage: "complete", counting: "ready", rate: "not_ready", records });
  seasons.push({ season, firstDate: from, lastDate: to, games: seasonGames.length,
    coverage: "complete", playerCount: seasonPlayers.length });
}
for (const player of playerRows) {
  const batting = batterFacts.get(player.id) ?? [];
  const pitching = pitcherFacts.get(player.id) ?? [];
  const totals = Object.fromEntries(player.seasons.map(season => {
    const { from, to } = seasonRanges.get(season)!;
    const b = batting.filter(row => row.season === season);
    const p = pitching.filter(row => row.season === season);
    return [season, { batting: b.length ? battingAggregate(player.id, b, from, to).metrics : null,
      pitching: p.length ? pitchingAggregate(player.id, p, from, to).metrics : null }];
  }));
  const allDates = [...batting, ...pitching].map(row => row.date);
  const first = allDates.reduce((min, date) => date < min ? date : min, "9999-12-31");
  const last = allDates.reduce((max, date) => date > max ? date : max, "0000-01-01");
  const collectedRangeTotals = {
    batting: batting.length ? battingAggregate(player.id, batting, first, last).metrics : null,
    pitching: pitching.length ? pitchingAggregate(player.id, pitching, first, last).metrics : null,
  };
  await json(`players/${player.id.replaceAll(":", "_")}.json`, { schemaVersion: 1, league: "MLB", player,
    seasonTotals: totals, collectedRangeTotals, batting, pitching, collectedRange: `${selectedSeasons[0]}–${selectedSeasons.at(-1)}` });
}
await json("players/index.json", { schemaVersion: 1, league: "MLB", players: playerRows.map(player => ({
  id: player.id, name: player.name, positions: player.positions, seasons: player.seasons,
  teamIds: player.teamIds,
})) });
await json("manifest.json", { schemaVersion: 1, league: "MLB", scope: "historical",
  seasons, current2026: "unavailable", source: "Retrosheet", identitySource: "Chadwick Register",
  teams: mlb2025Teams.map(team => ({ id: historicalTeamId(team.sourceId),
    name: team.id.slice("mlb:team:".length).split("-").map(word => word[0]!.toUpperCase() + word.slice(1)).join(" ") })),
  features: { historicalGames: "available", playerGameLogs: "available", seasonStats: "available",
    collectedRangeTotals: "available", directBvp: "evaluate", pitchLevelStatcast: "unavailable" },
});
const dbBytes = (await stat(database)).size;
console.log(JSON.stringify({ seasons: releases, players: playerRows.length, games: games.length,
  competition,
  battingFacts: [...batterFacts.values()].reduce((n, rows) => n + rows.length, 0),
  pitchingFacts: [...pitcherFacts.values()].reduce((n, rows) => n + rows.length, 0),
  mappings: mappingKeys.size, requests, downloadBytes, extractedBytes,
  parsingMs: Math.round(parsingMs), runtimeMs: Math.round(performance.now() - started),
  dbWrites, dbBytes, publicRoot: root, representativeGame: gameMap.values().next().value?.id }));
client.close();
