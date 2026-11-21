import { internationalTournamentEvidenceSchema } from "../domain/international-competition";
import { apbcSelections } from "./apbc-2026-selections";
import { wbc2023JapanStats, wbc2023JapanStatsRevision } from "./wbc-2023-japan-stats";

// Adapted from the English Wikipedia article revisions below, CC BY-SA 4.0.
// Dates are local to the venue. Only final totals and confirmed team sides are admitted.
export const resultLicense = "https://creativecommons.org/licenses/by-sa/4.0/";
const japan = "international:team:jpn";
const teams = { CHN: "中国", KOR: "韓国", CZE: "チェコ", AUS: "オーストラリア", ITA: "イタリア",
  MEX: "メキシコ", USA: "アメリカ", TPE: "チャイニーズ・タイペイ", VEN: "ベネズエラ", CUB: "キューバ", DOM: "ドミニカ共和国", JPN: "日本" };
export const internationalTeamNames = new Map(Object.entries(teams).map(([code, name]) => [`international:team:${code.toLowerCase()}`, name]));
export const internationalRoundNames = { pool: "1次ラウンド", qualifier: "予選", super_round: "スーパーラウンド",
  quarterfinal: "準々決勝", semifinal: "準決勝", final: "決勝", third_place: "3位決定戦", exhibition: "強化試合" };
const tokyo = "Asia/Tokyo", taipei = "Asia/Taipei", miami = "America/New_York";
type ResultRow = readonly [localDate: string, zone: string, round: keyof typeof internationalRoundNames,
  away: keyof typeof teams, awayRuns: number, home: keyof typeof teams, homeRuns: number, revision: number];

function edition(tournamentId: string, rows: readonly ResultRow[], selected: readonly { id: string; name: string }[] = [],
  stats: readonly (typeof wbc2023JapanStats)[number][] = []) {
  const revisions = [...new Set(rows.map(row => row[7]))];
  const sources = revisions.map(revision => ({ id: String(revision), sourceId: "enwiki", publisherId: "english-wikipedia",
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
  const rosterRevision = "111791999";
  if (selected.length) sources.push({ ...sources[0]!, id: rosterRevision, sourceId: "jawiki", publisherId: "japanese-wikipedia",
    version: rosterRevision, url: `https://ja.wikipedia.org/w/index.php?oldid=${rosterRevision}`, verifiedAt: "2026-11-19T21:48:00Z" });
  if (stats.length) sources.push({ ...sources[0]!, id: wbc2023JapanStatsRevision, sourceId: "jawiki", publisherId: "japanese-wikipedia",
    version: wbc2023JapanStatsRevision, url: `https://ja.wikipedia.org/w/index.php?oldid=${wbc2023JapanStatsRevision}`, verifiedAt: "2026-11-21T10:12:00Z" });
  const participation = selected.map(player => ({ kind: "selected", competition: "international", tournamentId, teamId: japan,
    playerId: player.id, date: "2026-10-07", source: { sourceRevisionId: rosterRevision, sourceRecordId: `代表選手/${player.name}` } }));
  const playerStats = stats.map(({ pageId, ...row }) => ({ ...row, tournamentId, teamId: japan, competition: "international",
    playerId: `international:player:jawiki:${pageId}`, source: { sourceRevisionId: wbc2023JapanStatsRevision,
      sourceRecordId: `${row.role === "batting" ? "野手成績" : "投手成績"}/${row.name}` } }));
  return internationalTournamentEvidenceSchema.parse({ tournamentId, editionRevision: stats.length ? 2 : 1, sources, games, playerStats,
    identities: [], participation, corrections: [], coverage: { results: partial, schedule: empty,
      selections: selected.length ? { ...partial, source: { sourceRevisionId: rosterRevision, sourceRecordId: "代表選手" } } : empty,
      registrations: empty, appearances: empty, playerStats: stats.length
        ? { ...partial, source: { sourceRevisionId: wbc2023JapanStatsRevision, sourceRecordId: "成績" } } : empty } });
}

const editions = [
  edition("international:tournament:apbc:2026", [
    ["2026-11-12", tokyo, "pool", "JPN", 5, "TPE", 0, 1385998229],
    ["2026-11-13", tokyo, "pool", "KOR", 5, "JPN", 9, 1385998229],
    ["2026-11-14", tokyo, "pool", "JPN", 16, "AUS", 1, 1385998229],
    ["2026-11-15", tokyo, "final", "KOR", 1, "JPN", 5, 1385998229],
  ], apbcSelections),
  edition("international:tournament:wbc:2026", [
    ["2026-03-06", tokyo, "pool", "JPN", 13, "TPE", 0, 1370352167],
    ["2026-03-07", tokyo, "pool", "KOR", 6, "JPN", 8, 1370352167],
    ["2026-03-08", tokyo, "pool", "AUS", 3, "JPN", 4, 1370352167],
    ["2026-03-10", tokyo, "pool", "CZE", 0, "JPN", 9, 1370352167],
    ["2026-03-14", miami, "quarterfinal", "VEN", 8, "JPN", 5, 1378823437],
  ]),
  edition("international:tournament:wbc:2023", [
    ["2023-03-09", tokyo, "pool", "CHN", 1, "JPN", 8, 1377340894],
    ["2023-03-10", tokyo, "pool", "KOR", 4, "JPN", 13, 1377340894],
    ["2023-03-11", tokyo, "pool", "CZE", 2, "JPN", 10, 1377340894],
    ["2023-03-12", tokyo, "pool", "JPN", 7, "AUS", 1, 1377340894],
    ["2023-03-16", tokyo, "quarterfinal", "ITA", 3, "JPN", 9, 1380479955],
    ["2023-03-20", miami, "semifinal", "MEX", 5, "JPN", 6, 1380479955],
    ["2023-03-21", miami, "final", "USA", 2, "JPN", 3, 1344369931],
  ], [], wbc2023JapanStats),
  edition("international:tournament:premier12:2024", [
    ["2024-11-13", tokyo, "pool", "AUS", 3, "JPN", 9, 1378187154],
    ["2024-11-15", taipei, "pool", "KOR", 3, "JPN", 6, 1378187154],
    ["2024-11-16", taipei, "pool", "JPN", 3, "TPE", 1, 1378187154],
    ["2024-11-17", taipei, "pool", "CUB", 6, "JPN", 7, 1378187154],
    ["2024-11-18", taipei, "pool", "JPN", 11, "DOM", 3, 1378187154],
    ["2024-11-21", tokyo, "super_round", "USA", 1, "JPN", 9, 1378187154],
    ["2024-11-22", tokyo, "super_round", "VEN", 6, "JPN", 9, 1378187154],
    ["2024-11-23", tokyo, "super_round", "TPE", 6, "JPN", 9, 1378187154],
    ["2024-11-24", tokyo, "final", "TPE", 4, "JPN", 0, 1378187154],
  ]),
];
export const japanResultsByTournament = new Map(editions.map(value => [value.tournamentId, value]));
