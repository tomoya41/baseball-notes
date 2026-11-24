import type { z } from "zod";
import { internationalTournamentEvidenceSchema } from "../domain/international-competition";
import { apbc2026BatteryAppearances, apbc2026BatteryRevision, apbc2026GamePitching } from "./apbc-2026-battery-appearances";
import { apbc2026Id, apbcIdentities, apbcIdentitySources } from "./apbc-2026-player-identities";
import { apbcSelections } from "./apbc-2026-selections";
import { apbc2026Highlights, apbc2026Mvp } from "./apbc-2026-highlights";
import { premier122024IdentityEvidence, wbc2023IdentityEvidence } from "./historical-japan-player-identities";
import { premier122024JapanStats, premier122024JapanStatsRevision } from "./premier12-2024-japan-stats";
import { wbc2023JapanStats, wbc2023JapanStatsRevision } from "./wbc-2023-japan-stats";
import { wbc2026JapanHighlights } from "./wbc-2026-japan-highlights";
import { wbc2026IdentityEvidence } from "./wbc-2026-player-identities";
import { wbc2026Selections } from "./wbc-2026-selections";

// Adapted from the English Wikipedia article revisions below, CC BY-SA 4.0.
// Dates are local to the venue. Only final totals and confirmed team sides are admitted.
export const resultLicense = "https://creativecommons.org/licenses/by-sa/4.0/";
const japan = "international:team:jpn";
const premier122024Id = "international:tournament:premier12:2024";
const wbc2023Id = "international:tournament:wbc:2023";
const teams = { CHN: "中国", KOR: "韓国", CZE: "チェコ", AUS: "オーストラリア", ITA: "イタリア",
  MEX: "メキシコ", USA: "アメリカ", TPE: "チャイニーズ・タイペイ", VEN: "ベネズエラ", CUB: "キューバ", DOM: "ドミニカ共和国", JPN: "日本" };
export const internationalTeamNames = new Map(Object.entries(teams).map(([code, name]) => [`international:team:${code.toLowerCase()}`, name]));
export const internationalRoundNames = { pool: "1次ラウンド", qualifier: "予選", super_round: "スーパーラウンド",
  quarterfinal: "準々決勝", semifinal: "準決勝", final: "決勝", third_place: "3位決定戦", exhibition: "強化試合" };
const tokyo = "Asia/Tokyo", taipei = "Asia/Taipei", miami = "America/New_York";
type ResultRow = readonly [localDate: string, zone: string, round: keyof typeof internationalRoundNames,
  away: keyof typeof teams, awayRuns: number, home: keyof typeof teams, homeRuns: number, revision: number];

type JapanSelection = { id: string; name: string; position: string; date: string };
type JapanSelections = { revision: string; verifiedAt: string; announcedAsOf: string; players: readonly JapanSelection[] };
type JapanStat = { pageId: number; name: string; gamesPlayed: number } & (
  | { role: "batting"; atBats: number; hits: number; homeRuns: number; runsBattedIn: number }
  | { role: "pitching"; outs: number; runsAllowed: number; earnedRuns: number; strikeouts: number | null }
);
type JapanStats = { revision: string; verifiedAt: string; players: readonly JapanStat[] };
export const japanSelectionsByTournament = new Map<string, JapanSelections>([
  [apbc2026Id, { revision: "111791999", verifiedAt: "2026-11-19T21:48:00Z",
    announcedAsOf: "2026-10-07", players: apbcSelections.map(player => ({ ...player, date: "2026-10-07" })) }],
  ["international:tournament:wbc:2026", { revision: "110704201", verifiedAt: "2026-11-21T10:25:00Z",
    announcedAsOf: "2026-02-26", players: wbc2026Selections }],
]);

function edition(tournamentId: string, rows: readonly ResultRow[], stats?: JapanStats) {
  const revisions = [...new Set(rows.map(row => row[7]))];
  const sources: z.infer<typeof internationalTournamentEvidenceSchema>["sources"] = revisions.map(revision => ({
    id: String(revision), sourceId: "enwiki", publisherId: "english-wikipedia",
    version: String(revision), url: `https://en.wikipedia.org/w/index.php?oldid=${revision}`, termsEvidenceUrl: resultLicense,
    verifiedAt: "2026-11-19T21:41:00Z", permissions: { acquisition: "approved", storage: "approved", transformation: "approved",
      webDisplay: "approved", androidDisplay: "approved", redistribution: "approved" } }));
  const games = rows.map(([localDate, timeZone, round, away, awayRuns, home, homeRuns, revision]) => ({
    competition: "international", tournamentId, id: `${tournamentId.replace(":tournament:", ":game:")}:${localDate}:${away.toLowerCase()}-${home.toLowerCase()}`,
    round, homeTeamId: `international:team:${home.toLowerCase()}`, awayTeamId: `international:team:${away.toLowerCase()}`,
    localDate, timeZone, scheduledAt: null, status: "final", result: { homeRuns, awayRuns },
    source: { sourceRevisionId: String(revision), sourceRecordId: `${localDate} ${away} at ${home}` },
  }));
  const partial = { status: "partial", scope: { kind: "team", teamId: japan }, source: games[0]!.source };
  const empty = { status: "uncollected" };
  const roster = japanSelectionsByTournament.get(tournamentId);
  if (roster) sources.push({ ...sources[0]!, id: roster.revision, sourceId: "jawiki", publisherId: "japanese-wikipedia",
    version: roster.revision, url: `https://ja.wikipedia.org/w/index.php?oldid=${roster.revision}`, verifiedAt: roster.verifiedAt });
  if (stats) sources.push({ ...sources[0]!, id: stats.revision, sourceId: "jawiki", publisherId: "japanese-wikipedia",
    version: stats.revision, url: `https://ja.wikipedia.org/w/index.php?oldid=${stats.revision}`, verifiedAt: stats.verifiedAt });
  const selections = roster?.players.map(player => ({ kind: "selected", competition: "international", tournamentId, teamId: japan,
    playerId: player.id, date: player.date, source: { sourceRevisionId: roster.revision, sourceRecordId: `代表選手/${player.name}` } })) ?? [];
  const playerStats = stats?.players.map(({ pageId, ...row }) => ({ ...row, tournamentId, teamId: japan,
    competition: "international", playerId: `international:player:jawiki:${pageId}`, source: { sourceRevisionId: stats.revision,
      sourceRecordId: `${row.role === "batting" ? "野手成績" : "投手成績"}/${row.name}` } })) ?? [];
  const apbc = tournamentId === apbc2026Id;
  if (apbc) sources.push(...apbcIdentitySources, {
    ...sources[0]!, id: apbc2026BatteryRevision, sourceId: "jawiki", publisherId: "japanese-wikipedia",
    version: apbc2026BatteryRevision, url: `https://ja.wikipedia.org/w/index.php?oldid=${apbc2026BatteryRevision}`, verifiedAt: "2026-11-24T12:27:00Z",
  });
  const wbc2026 = tournamentId === "international:tournament:wbc:2026";
  const historicalIdentity = tournamentId === premier122024Id ? premier122024IdentityEvidence
    : tournamentId === wbc2023Id ? wbc2023IdentityEvidence : undefined;
  if (wbc2026) sources.push(...wbc2026IdentityEvidence.sources);
  if (historicalIdentity) sources.push(...historicalIdentity.sources);
  const corrections = tournamentId === premier122024Id ? [{
    supersedesRevision: 2, recordedAt: "2026-11-24T23:39:40Z",
    reason: "Corrected Tatsuya Shimizu’s tournament person ID to the pitcher’s article linked in the original results table (3750787 → 3750723). Statistics unchanged.",
    source: { sourceRevisionId: premier122024JapanStatsRevision, sourceRecordId: "投手成績/清水達也 (投手)" },
  }] : [];
  const gameHighlights = apbc ? apbc2026Highlights : wbc2026 ? wbc2026JapanHighlights : [];
  const highlightSource = gameHighlights[0]?.source;
  const gameDates = new Map(games.map(game => [game.id, game.localDate]));
  const appearances = gameHighlights.flatMap(highlight => {
    // A scored home run or an official pitcher decision proves this game appearance.
    const players = new Set(highlight.homeRuns.map(row => row.playerId));
    if ("winningPitcherId" in highlight && highlight.winningPitcherId) players.add(highlight.winningPitcherId);
    if ("losingPitcherId" in highlight && highlight.losingPitcherId) players.add(highlight.losingPitcherId);
    return [...players].map(playerId => ({ kind: "appeared", competition: "international", tournamentId, teamId: japan,
      playerId, gameId: highlight.gameId, date: gameDates.get(highlight.gameId), source: highlight.source }));
  });
  if (apbc) {
    const present = new Set(appearances.map(row => `${row.gameId}|${row.playerId}`));
    appearances.push(...apbc2026BatteryAppearances.filter(row => !present.has(`${row.gameId}|${row.playerId}`)));
  }
  return internationalTournamentEvidenceSchema.parse({ tournamentId,
    editionRevision: apbc ? 6 : wbc2026 ? 5 : historicalIdentity ? 3 : stats ? 2 : 1, sources, games, playerStats,
    gameHighlights, gamePitching: apbc ? apbc2026GamePitching : [], tournamentMvp: apbc ? apbc2026Mvp : undefined,
    identities: apbc ? apbcIdentities : wbc2026 ? wbc2026IdentityEvidence.identities : historicalIdentity?.identities ?? [],
    participation: [...selections, ...appearances], corrections, coverage: { results: partial, schedule: empty,
      selections: roster ? { ...partial, source: { sourceRevisionId: roster.revision, sourceRecordId: "代表選手" } } : empty,
      registrations: empty, appearances: highlightSource ? { ...partial, source: highlightSource } : empty,
      gameHighlights: highlightSource ? { ...partial, source: highlightSource } : empty,
      playerStats: stats
        ? { ...partial, source: { sourceRevisionId: stats.revision, sourceRecordId: "成績" } } : empty } });
}

const editions = [
  edition(apbc2026Id, [
    ["2026-11-12", tokyo, "pool", "JPN", 5, "TPE", 0, 1385998229],
    ["2026-11-13", tokyo, "pool", "KOR", 5, "JPN", 9, 1385998229],
    ["2026-11-14", tokyo, "pool", "JPN", 16, "AUS", 1, 1385998229],
    ["2026-11-15", tokyo, "final", "KOR", 1, "JPN", 5, 1385998229],
  ]),
  edition("international:tournament:wbc:2026", [
    ["2026-03-06", tokyo, "pool", "JPN", 13, "TPE", 0, 1370352167],
    ["2026-03-07", tokyo, "pool", "KOR", 6, "JPN", 8, 1370352167],
    ["2026-03-08", tokyo, "pool", "AUS", 3, "JPN", 4, 1370352167],
    ["2026-03-10", tokyo, "pool", "CZE", 0, "JPN", 9, 1370352167],
    ["2026-03-14", miami, "quarterfinal", "VEN", 8, "JPN", 5, 1378823437],
  ]),
  edition(wbc2023Id, [
    ["2023-03-09", tokyo, "pool", "CHN", 1, "JPN", 8, 1377340894],
    ["2023-03-10", tokyo, "pool", "KOR", 4, "JPN", 13, 1377340894],
    ["2023-03-11", tokyo, "pool", "CZE", 2, "JPN", 10, 1377340894],
    ["2023-03-12", tokyo, "pool", "JPN", 7, "AUS", 1, 1377340894],
    ["2023-03-16", tokyo, "quarterfinal", "ITA", 3, "JPN", 9, 1380479955],
    ["2023-03-20", miami, "semifinal", "MEX", 5, "JPN", 6, 1380479955],
    ["2023-03-21", miami, "final", "USA", 2, "JPN", 3, 1344369931],
  ], { revision: wbc2023JapanStatsRevision, verifiedAt: "2026-11-21T10:12:00Z", players: wbc2023JapanStats }),
  edition(premier122024Id, [
    ["2024-11-13", tokyo, "pool", "AUS", 3, "JPN", 9, 1378187154],
    ["2024-11-15", taipei, "pool", "KOR", 3, "JPN", 6, 1378187154],
    ["2024-11-16", taipei, "pool", "JPN", 3, "TPE", 1, 1378187154],
    ["2024-11-17", taipei, "pool", "CUB", 6, "JPN", 7, 1378187154],
    ["2024-11-18", taipei, "pool", "JPN", 11, "DOM", 3, 1378187154],
    ["2024-11-21", tokyo, "super_round", "USA", 1, "JPN", 9, 1378187154],
    ["2024-11-22", tokyo, "super_round", "VEN", 6, "JPN", 9, 1378187154],
    ["2024-11-23", tokyo, "super_round", "TPE", 6, "JPN", 9, 1378187154],
    ["2024-11-24", tokyo, "final", "TPE", 4, "JPN", 0, 1378187154],
  ], { revision: premier122024JapanStatsRevision, verifiedAt: "2026-11-21T11:09:00Z", players: premier122024JapanStats }),
];
export const japanResultsByTournament = new Map(editions.map(value => [value.tournamentId, value]));

export function japanGameAppearances(canonicalPlayerId: string) {
  return editions.flatMap(edition => {
    const identity = edition.identities.find(row => row.league === "NPB" && row.canonicalPlayerId === canonicalPlayerId);
    if (!identity) return [];
    const gameIds = new Set(edition.participation.flatMap(row =>
      row.kind === "appeared" && row.playerId === identity.playerId ? [row.gameId] : []));
    return gameIds.size ? [{ tournamentId: edition.tournamentId, confirmedGames: gameIds.size }] : [];
  });
}

export function japanPlayerTournamentStats(canonicalPlayerId: string) {
  return editions.flatMap(edition => {
    const identity = edition.identities.find(row => row.league === "NPB" && row.canonicalPlayerId === canonicalPlayerId);
    return identity ? edition.playerStats.filter(row => row.playerId === identity.playerId && row.teamId === japan) : [];
  });
}
