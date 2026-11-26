import type { z } from "zod";
import { internationalTournamentEvidenceSchema } from "../domain/international-competition";
import { apbc2023GamePitching, apbc2023Id, apbc2023PitcherAppearances, apbc2023Revision } from "./apbc-2023-pitching";
import { apbc2023AdditionalAppearances, apbc2023Highlights, apbc2023Mvp, apbc2023SelectionRevision,
  apbc2023Selections, apbc2023SelectionVerifiedAt } from "./apbc-2023-japan-selections";
import { apbc2026BatteryAppearances, apbc2026BatteryRevision, apbc2026GamePitching } from "./apbc-2026-battery-appearances";
import { apbc2026Id, apbcIdentities, apbcIdentitySources } from "./apbc-2026-player-identities";
import { apbcSelections } from "./apbc-2026-selections";
import { apbc2026Highlights, apbc2026Mvp } from "./apbc-2026-highlights";
import { apbc2023IdentityEvidence, premier122024IdentityEvidence, wbc2023IdentityEvidence } from "./historical-japan-player-identities";
import { premier122024JapanStats, premier122024JapanStatsRevision } from "./premier12-2024-japan-stats";
import { wbc2023JapanStats, wbc2023JapanStatsRevision } from "./wbc-2023-japan-stats";
import { wbc2026JapanHighlights } from "./wbc-2026-japan-highlights";
import { wbc2026Id, wbc2026LineupAppearances, wbc2026LineupRevision } from "./wbc-2026-japan-lineups";
import { wbc2026IdentityEvidence } from "./wbc-2026-player-identities";
import { wbc2026Selections } from "./wbc-2026-selections";
import { japanTournamentHonors } from "./international-japan-honors";
import { samurai2025KoreaId, samurai2025NetherlandsId, samurai2025ResultsRevision, samurai2025ResultsVerifiedAt } from "./samurai-2025-exhibitions";
import { samurai2026ExhibitionIds } from "./international-official-links";
import { samurai2026ClubNames, samurai2026ClubResultsRevision, samurai2026ClubResultsVerifiedAt } from "./samurai-2026-club-exhibitions";

// Adapted from the Wikipedia article revisions below, CC BY-SA 4.0.
// Dates are local to the venue. Only final totals and confirmed team sides are admitted.
export const resultLicense = "https://creativecommons.org/licenses/by-sa/4.0/";
const japan = "international:team:jpn";
const premier122024Id = "international:tournament:premier12:2024";
const wbc2023Id = "international:tournament:wbc:2023";
const teams = { CHN: "中国", KOR: "韓国", CZE: "チェコ", AUS: "オーストラリア", ITA: "イタリア",
  MEX: "メキシコ", USA: "アメリカ", TPE: "チャイニーズ・タイペイ", VEN: "ベネズエラ", CUB: "キューバ", DOM: "ドミニカ共和国",
  NED: "オランダ", JPN: "日本" };
type TeamCode = keyof typeof teams | keyof typeof samurai2026ClubNames;
function resultTeamId(code: TeamCode) {
  const prefix = Object.hasOwn(samurai2026ClubNames, code) ? "international:club:npb:" : "international:team:";
  return prefix + code.toLowerCase();
}
export const internationalTeamNames = new Map(Object.entries({ ...teams, ...samurai2026ClubNames })
  .map(([code, name]) => [resultTeamId(code as TeamCode), name]));
export const internationalRoundNames = { pool: "1次ラウンド", qualifier: "予選", super_round: "スーパーラウンド",
  quarterfinal: "準々決勝", semifinal: "準決勝", final: "決勝", third_place: "3位決定戦", exhibition: "強化試合" };
const tokyo = "Asia/Tokyo", taipei = "Asia/Taipei", miami = "America/New_York";
type ResultRow = readonly [localDate: string, zone: string, round: keyof typeof internationalRoundNames,
  away: TeamCode, awayRuns: number, home: TeamCode, homeRuns: number, revision: number];

type JapanSelection = { id: string; name: string; position: string; date: string };
type JapanSelections = { revision: string; verifiedAt: string; announcedAsOf: string; players: readonly JapanSelection[] };
type JapanStat = { pageId: number; name: string; gamesPlayed: number } & (
  | { role: "batting"; atBats: number; hits: number; homeRuns: number; runsBattedIn: number }
  | { role: "pitching"; outs: number; runsAllowed: number; earnedRuns: number; strikeouts: number | null }
);
type JapanStats = { revision: string; verifiedAt: string; players: readonly JapanStat[] };
export const japanSelectionsByTournament = new Map<string, JapanSelections>([
  [apbc2023Id, { revision: apbc2023SelectionRevision, verifiedAt: apbc2023SelectionVerifiedAt,
    announcedAsOf: "2023-11-06", players: apbc2023Selections }],
  [apbc2026Id, { revision: "111791999", verifiedAt: "2026-11-19T21:48:00Z",
    announcedAsOf: "2026-10-07", players: apbcSelections.map(player => ({ ...player, date: "2026-10-07" })) }],
  [wbc2026Id, { revision: wbc2026LineupRevision, verifiedAt: "2026-11-21T10:25:00Z",
    announcedAsOf: "2026-02-26", players: wbc2026Selections }],
]);

function edition(tournamentId: string, rows: readonly ResultRow[], stats?: JapanStats) {
  const revisions = [...new Set(rows.map(row => row[7]))];
  const apbc2023 = tournamentId === apbc2023Id;
  const samurai2025 = tournamentId === samurai2025KoreaId || tournamentId === samurai2025NetherlandsId;
  const resultSource = apbc2023
    ? { sourceId: "jawiki", publisherId: "japanese-wikipedia", language: "ja", verifiedAt: "2026-11-25T05:31:00Z" }
    : { sourceId: "enwiki", publisherId: "english-wikipedia", language: "en",
      verifiedAt: samurai2025 ? samurai2025ResultsVerifiedAt : "2026-11-19T21:41:00Z" };
  const sources: z.infer<typeof internationalTournamentEvidenceSchema>["sources"] = revisions.map(revision => {
    const { language, ...provenance } = revision === samurai2026ClubResultsRevision
      ? { sourceId: "jawiki", publisherId: "japanese-wikipedia", language: "ja", verifiedAt: samurai2026ClubResultsVerifiedAt }
      : resultSource;
    return { ...provenance, id: String(revision), version: String(revision), termsEvidenceUrl: resultLicense,
      url: `https://${language}.wikipedia.org/w/index.php?oldid=${revision}`,
      permissions: { acquisition: "approved", storage: "approved", transformation: "approved",
        webDisplay: "approved", androidDisplay: "approved", redistribution: "approved" } };
  });
  const games = rows.map(([localDate, timeZone, round, away, awayRuns, home, homeRuns, revision]) => ({
    competition: "international", tournamentId, id: `${tournamentId.replace(":tournament:", ":game:")}:${localDate}:${away.toLowerCase()}-${home.toLowerCase()}`,
    round, homeTeamId: resultTeamId(home), awayTeamId: resultTeamId(away),
    localDate, timeZone, scheduledAt: null, status: "final", result: { homeRuns, awayRuns },
    source: { sourceRevisionId: String(revision), sourceRecordId: `${localDate} ${away} at ${home}` },
  }));
  const partial = { status: "partial", scope: { kind: "team", teamId: japan }, source: games[0]!.source };
  const empty = { status: "uncollected" };
  const roster = japanSelectionsByTournament.get(tournamentId);
  const honors = japanTournamentHonors.get(tournamentId);
  if (roster) sources.push({ ...sources[0]!, id: roster.revision, sourceId: "jawiki", publisherId: "japanese-wikipedia",
    version: roster.revision, url: `https://ja.wikipedia.org/w/index.php?oldid=${roster.revision}`, verifiedAt: roster.verifiedAt });
  if (stats) sources.push({ ...sources[0]!, id: stats.revision, sourceId: "jawiki", publisherId: "japanese-wikipedia",
    version: stats.revision, url: `https://ja.wikipedia.org/w/index.php?oldid=${stats.revision}`, verifiedAt: stats.verifiedAt });
  if (honors && !sources.some(source => source.id === honors.revision)) sources.push({
    ...sources[0]!, id: honors.revision, sourceId: "enwiki", publisherId: "english-wikipedia",
    version: honors.revision, url: `https://en.wikipedia.org/w/index.php?oldid=${honors.revision}`, verifiedAt: "2026-11-25T21:38:00Z",
  });
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
  const wbc2026 = tournamentId === wbc2026Id;
  const historicalIdentity = tournamentId === premier122024Id ? premier122024IdentityEvidence
    : tournamentId === wbc2023Id ? wbc2023IdentityEvidence : apbc2023 ? apbc2023IdentityEvidence : undefined;
  if (wbc2026) sources.push(...wbc2026IdentityEvidence.sources);
  if (historicalIdentity) sources.push(...historicalIdentity.sources);
  const corrections = tournamentId === premier122024Id ? [{
    supersedesRevision: 2, recordedAt: "2026-11-24T23:39:40Z",
    reason: "Corrected Tatsuya Shimizu’s tournament person ID to the pitcher’s article linked in the original results table (3750787 → 3750723). Statistics unchanged.",
    source: { sourceRevisionId: premier122024JapanStatsRevision, sourceRecordId: "投手成績/清水達也 (投手)" },
  }] : [];
  const gameHighlights = apbc ? apbc2026Highlights : wbc2026 ? wbc2026JapanHighlights : apbc2023 ? apbc2023Highlights : [];
  const highlightSource = gameHighlights[0]?.source;
  const gameDates = new Map(games.map(game => [game.id, game.localDate]));
  const appearances = apbc2023 ? [...apbc2023PitcherAppearances, ...apbc2023AdditionalAppearances] : gameHighlights.flatMap(highlight => {
    // A scored home run or an official pitcher decision proves this game appearance.
    const players = new Set(highlight.homeRuns.map(row => row.playerId));
    if ("winningPitcherId" in highlight && highlight.winningPitcherId) players.add(highlight.winningPitcherId);
    if ("losingPitcherId" in highlight && highlight.losingPitcherId) players.add(highlight.losingPitcherId);
    return [...players].map(playerId => ({ kind: "appeared", competition: "international", tournamentId, teamId: japan,
      playerId, gameId: highlight.gameId, date: gameDates.get(highlight.gameId), source: highlight.source }));
  });
  const lineupAppearances = apbc ? apbc2026BatteryAppearances : wbc2026 ? wbc2026LineupAppearances : [];
  const present = new Set(appearances.map(row => `${row.gameId}|${row.playerId}`));
  appearances.push(...lineupAppearances.filter(row => !present.has(`${row.gameId}|${row.playerId}`)));
  const appearanceSource = wbc2026 ? { sourceRevisionId: wbc2026LineupRevision, sourceRecordId: "試合結果/先発・バッテリー" }
    : apbc2023 ? { sourceRevisionId: apbc2023SelectionRevision, sourceRecordId: "試合結果/打順・バッテリー" } : highlightSource;
  const editionRevision = apbc ? 6 : wbc2026 ? 7 : historicalIdentity ? 3 : stats ? 2 : 1;
  return internationalTournamentEvidenceSchema.parse({ tournamentId,
    editionRevision: editionRevision + Number(Boolean(honors)), sources, games, playerStats,
    gameHighlights, gamePitching: apbc ? apbc2026GamePitching : apbc2023 ? apbc2023GamePitching : [],
    tournamentMvp: honors?.mvp ?? (apbc ? apbc2026Mvp : apbc2023 ? apbc2023Mvp : undefined),
    allTournamentTeam: honors?.players ?? [],
    identities: apbc ? apbcIdentities : wbc2026 ? wbc2026IdentityEvidence.identities : historicalIdentity?.identities ?? [],
    participation: [...selections, ...appearances], corrections, coverage: { results: partial, schedule: empty,
      selections: roster ? { ...partial, source: { sourceRevisionId: roster.revision, sourceRecordId: "代表選手" } } : empty,
      registrations: empty, appearances: appearanceSource ? { ...partial, source: appearanceSource } : empty,
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
  edition(apbc2023Id, [
    ["2023-11-16", tokyo, "pool", "JPN", 4, "TPE", 0, apbc2023Revision],
    ["2023-11-17", tokyo, "pool", "KOR", 1, "JPN", 2, apbc2023Revision],
    ["2023-11-18", tokyo, "pool", "JPN", 10, "AUS", 0, apbc2023Revision],
    ["2023-11-19", tokyo, "final", "KOR", 3, "JPN", 4, apbc2023Revision],
  ]),
  edition(wbc2026Id, [
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
  edition(samurai2025NetherlandsId, [
    ["2025-03-05", tokyo, "exhibition", "NED", 0, "JPN", 5, samurai2025ResultsRevision],
    ["2025-03-06", tokyo, "exhibition", "JPN", 9, "NED", 0, samurai2025ResultsRevision],
  ]),
  edition(samurai2025KoreaId, [
    ["2025-11-15", tokyo, "exhibition", "KOR", 4, "JPN", 11, samurai2025ResultsRevision],
    ["2025-11-16", tokyo, "exhibition", "JPN", 7, "KOR", 7, samurai2025ResultsRevision],
  ]),
  edition(samurai2026ExhibitionIds.miyazaki, [
    ["2026-02-22", tokyo, "exhibition", "HAWKS", 3, "JPN", 13, samurai2026ClubResultsRevision],
    ["2026-02-23", tokyo, "exhibition", "JPN", 0, "HAWKS", 4, samurai2026ClubResultsRevision],
  ]),
  edition(samurai2026ExhibitionIds.nagoya, [
    ["2026-02-27", tokyo, "exhibition", "DRAGONS", 3, "JPN", 5, samurai2026ClubResultsRevision],
    ["2026-02-28", tokyo, "exhibition", "JPN", 7, "DRAGONS", 3, samurai2026ClubResultsRevision],
  ]),
  edition(samurai2026ExhibitionIds.osaka, [
    ["2026-03-02", tokyo, "exhibition", "JPN", 3, "BUFFALOES", 4, samurai2026ClubResultsRevision],
    ["2026-03-03", tokyo, "exhibition", "JPN", 5, "TIGERS", 4, samurai2026ClubResultsRevision],
  ]),
];
export const japanResultsByTournament = new Map(editions.map(value => [value.tournamentId, value]));

export function japanPlayerTournamentRecords(canonicalPlayerId: string) {
  return editions.flatMap(edition => {
    const identity = edition.identities.find(row => row.league === "NPB" && row.canonicalPlayerId === canonicalPlayerId);
    if (!identity) return [];
    const participation = edition.participation.filter(row => row.playerId === identity.playerId && row.teamId === japan);
    const selected = participation.some(row => row.kind === "selected");
    const confirmedGames = new Set(participation.flatMap(row => row.kind === "appeared" ? [row.gameId] : [])).size;
    const stats = edition.playerStats.filter(row => row.playerId === identity.playerId && row.teamId === japan);
    const mvp = edition.tournamentMvp?.playerId === identity.playerId && edition.tournamentMvp.teamId === japan;
    const awards = edition.allTournamentTeam.filter(row => row.playerId === identity.playerId && row.teamId === japan);
    if (!selected && !confirmedGames && !stats.length && !mvp && !awards.length) return [];
    return [{ tournamentId: edition.tournamentId, selected, confirmedGames, stats, mvp, awards }];
  });
}
