import { expect, it } from "vitest";
import { internationalOfficialTournaments } from "../src/data/international-official-links";
import { japanGameAppearances, japanResultsByTournament, japanSelectionsByTournament } from "../src/data/international-japan-results";
import { apbc2026Batteries, apbc2026BatteryRevision } from "../src/data/apbc-2026-battery-appearances";
import npbProfileIdentities from "../src/data/npb-free-profile-identities.json";
import { savedGameMvpInputs } from "../src/domain/daily-mvp";
import { playerGameBattingSchema, playerGamePitchingSchema } from "../src/domain/game-facts";
import { internationalGameSchema, internationalParticipationSchema, internationalTournamentEvidenceSchema,
  internationalTournamentSchema } from "../src/domain/international-competition";
import { npbCompetitionScopeSchema } from "../src/domain/npb-competition";
import { gameDateIndexSchema } from "../src/domain/npb-game-index";
import { mvpFixture } from "./fixtures/daily-mvp";

const tournamentId = "international:tournament:apbc:2026";
const teamId = "international:team:jpn";
const opponentId = "international:team:test";
const source = { sourceRevisionId: "test-revision", sourceRecordId: "test-record" };
const game = { competition: "international", tournamentId, id: "international:game:test-final", round: "final",
  homeTeamId: null, awayTeamId: null, localDate: "2026-11-15", scheduledAt: null, timeZone: "Asia/Tokyo",
  status: "scheduled", result: null, source };
const selection = { competition: "international", tournamentId, teamId, playerId: "international:player:test-player",
  kind: "selected", date: null, source };
const verifiedAt = "2026-11-01T00:00:00.000Z";
const uncollected = { status: "uncollected" };
const testRevision = { id: source.sourceRevisionId, sourceId: "test-source", publisherId: "test-tournament-authority", version: "test-v1",
  url: "https://example.org/event", termsEvidenceUrl: "https://example.org/terms", verifiedAt,
  permissions: { acquisition: "approved", storage: "approved", transformation: "approved",
    webDisplay: "approved", androidDisplay: "approved", redistribution: "approved" } };
const edition = { tournamentId, editionRevision: 1, sources: [], identities: [], games: [], participation: [], corrections: [],
  coverage: { schedule: uncollected, results: uncollected, selections: uncollected,
    registrations: uncollected, appearances: uncollected, playerStats: uncollected } };
const final = { ...game, homeTeamId: teamId, awayTeamId: opponentId, status: "final", result: { homeRuns: 1, awayRuns: 0 } };
const canonicalPlayerId = "00000000-0000-4000-8000-000000000001";
const identifier = { method: "shared_player_identifier", authorityId: "test-identifier-authority", value: "test-stable-id" };
const canonicalSource = { ...testRevision, id: "test-canonical-revision", sourceId: "test-profile-source",
  publisherId: "test-independent-profile", url: "https://example.net/profile" };
const bridge = {
  league: "NPB", playerId: selection.playerId, canonicalPlayerId,
  evidence: {
    international: { ...source, publication: "original", subjectId: selection.playerId, documentSha256: "a".repeat(64), identifier },
    canonical: { sourceRevisionId: canonicalSource.id, sourceRecordId: "test-profile", publication: "original",
      subjectId: canonicalPlayerId, documentSha256: "b".repeat(64), identifier },
  },
  review: { result: "verified", reviewer: "fixture reviewer", reviewedAt: verifiedAt, rationale: "Independent source records cite the same authority-issued player ID" },
};

it("keeps official links out of tournament data admission", () => {
  expect(internationalOfficialTournaments.map(t => t.id)).toHaveLength(7);
  expect(internationalTournamentSchema.safeParse({ ...internationalOfficialTournaments[0], year: 2027 }).success).toBe(false);
  expect(internationalTournamentEvidenceSchema.safeParse(edition).success).toBe(true);
  const coverage = { ...edition.coverage, schedule: { status: "partial", scope: { kind: "tournament" }, source } };
  const unlicensed = { ...testRevision, permissions: { ...testRevision.permissions, redistribution: "unverified" } };
  expect(internationalTournamentEvidenceSchema.safeParse({ ...edition, coverage, games: [game], sources: [unlicensed] }).success).toBe(false);
  expect(internationalTournamentEvidenceSchema.safeParse({ ...edition, coverage, games: [game], sources: [testRevision] }).success).toBe(true);
});

it("preserves unassigned finalists and date-only games without inventing outcomes", () => {
  expect(internationalGameSchema.parse(game)).toEqual(game);
  expect(internationalGameSchema.safeParse({ ...game, timeZone: "JST?" }).success).toBe(false);
  expect(internationalGameSchema.safeParse({ ...game, scheduledAt: "2026-11-15T19:00:00" }).success).toBe(false);
  expect(internationalGameSchema.safeParse({ ...game, scheduledAt: "unknown" }).success).toBe(false);
  expect(internationalGameSchema.safeParse({ ...game, scheduledAt: "2026-11-14T23:00:00Z" }).success).toBe(true);
  expect(internationalGameSchema.safeParse({ ...game, scheduledAt: "2026-11-15T23:00:00Z" }).success).toBe(false);
  const result = { homeRuns: 1, awayRuns: 0 };
  expect(internationalGameSchema.safeParse({ ...game, status: "final", result }).success).toBe(false);
  expect(internationalGameSchema.safeParse({ ...game, result }).success).toBe(false);
  expect(internationalGameSchema.safeParse({ ...game, homeTeamId: teamId, awayTeamId: teamId }).success).toBe(false);
});

it("requires appearance evidence for a played game and keeps selection and registration separate", () => {
  const registered = { ...selection, kind: "registered" };
  const appeared = { ...selection, kind: "appeared", gameId: game.id };
  expect(internationalParticipationSchema.parse(selection).kind).toBe("selected");
  expect(internationalParticipationSchema.parse(registered).kind).toBe("registered");
  expect(internationalParticipationSchema.safeParse({ ...selection, kind: "appeared" }).success).toBe(false);
  const pending = { ...edition, sources: [testRevision], games: [game], participation: [selection, registered] };
  expect(internationalTournamentEvidenceSchema.safeParse(pending).success).toBe(true);
  expect(internationalTournamentEvidenceSchema.safeParse({ ...pending, participation: [appeared] }).success).toBe(false);
  expect(internationalTournamentEvidenceSchema.safeParse({ ...pending, games: [final], participation: [appeared] }).success).toBe(true);
  expect(internationalTournamentEvidenceSchema.safeParse({ ...pending, participation: [selection, selection] }).success).toBe(false);
});

it("requires an admitted pair of original publishers, matching identifiers and a verified decision", () => {
  const linked = { ...edition, sources: [testRevision, canonicalSource], identities: [bridge] };
  expect(internationalTournamentEvidenceSchema.parse(linked).identities[0]?.canonicalPlayerId).toBe(canonicalPlayerId);
  expect(internationalTournamentEvidenceSchema.safeParse({ ...linked, sources: [testRevision] }).success).toBe(false);
  expect(internationalTournamentEvidenceSchema.safeParse({ ...linked,
    sources: [testRevision, { ...canonicalSource, publisherId: testRevision.publisherId }] }).success).toBe(false);
  expect(internationalTournamentEvidenceSchema.safeParse({ ...linked,
    sources: [testRevision, { ...canonicalSource, url: testRevision.url }] }).success).toBe(false);
  for (const change of [
    { publication: "republication" },
    { documentSha256: bridge.evidence.international.documentSha256 },
    { identifier: { ...identifier, value: "unmatched-id" } },
    { identifier: { method: "name", value: "same-name" } },
    { subjectId: "00000000-0000-4000-8000-000000000002" },
  ]) {
    const evidence = { ...bridge.evidence, canonical: { ...bridge.evidence.canonical, ...change } };
    expect(internationalTournamentEvidenceSchema.safeParse({ ...linked, identities: [{ ...bridge, evidence }] }).success).toBe(false);
  }
  expect(internationalTournamentEvidenceSchema.safeParse({ ...linked,
    identities: [{ ...bridge, review: { ...bridge.review, result: "pending" } }] }).success).toBe(false);
  expect(internationalTournamentEvidenceSchema.safeParse({ ...linked,
    identities: [{ ...bridge, review: { ...bridge.review, reviewedAt: "2026-10-31T00:00:00Z" } }] }).success).toBe(false);
  const biographicalIdentifier = { method: "birth_date_and_affiliation", birthDate: "2000-01-01", affiliationId: "test-affiliation" };
  const evidence = { international: { ...bridge.evidence.international, identifier: biographicalIdentifier },
    canonical: { ...bridge.evidence.canonical, identifier: biographicalIdentifier } };
  expect(internationalTournamentEvidenceSchema.safeParse({ ...linked, identities: [{ ...bridge, evidence }] }).success).toBe(true);
});

it("requires a prior revision and admitted evidence for corrections", () => {
  const correction = { supersedesRevision: 1, recordedAt: verifiedAt, reason: "test correction", source };
  const corrected = { ...edition, editionRevision: 2, sources: [testRevision], corrections: [correction] };
  expect(internationalTournamentEvidenceSchema.safeParse(corrected).success).toBe(true);
  expect(internationalTournamentEvidenceSchema.safeParse({ ...corrected, editionRevision: 1 }).success).toBe(false);
});

const japan = { kind: "team", teamId };
const complete = (unit: string, expectedIds: string[]) => ({ status: "complete", scope: japan, unit, source,
  population: { ...source, sourceRecordId: "test-population", teamIds: [teamId] },
  expectedIds, expectedCount: expectedIds.length, collectedCount: expectedIds.length });

it("matches the exact admitted coverage inventory for one team or the entire tournament", () => {
  const otherFinal = { ...final, id: "international:game:test-other", homeTeamId: "international:team:another" };
  const results = complete("final_game", [final.id]);
  const snapshot = { ...edition, sources: [testRevision], games: [final, otherFinal] };
  const parse = (claim: object) => internationalTournamentEvidenceSchema.safeParse({ ...snapshot,
    coverage: { ...edition.coverage, results: claim } }).success;
  expect(parse(results)).toBe(true);
  expect(parse({ ...results, expectedIds: [otherFinal.id] })).toBe(false);
  expect(parse({ ...results, collectedCount: 2 })).toBe(false);
  expect(parse({ ...results, expectedIds: [final.id, final.id] })).toBe(false);
  expect(parse({ ...results, population: { ...results.population, sourceRevisionId: "missing" } })).toBe(false);
  expect(parse({ ...results, scope: { kind: "tournament" } })).toBe(false);
  const tournamentResults = { ...complete("final_game", [final.id, otherFinal.id]), scope: { kind: "tournament" },
    population: { ...source, teamIds: [teamId, opponentId, otherFinal.homeTeamId] } };
  expect(parse(tournamentResults)).toBe(true);
  expect(parse({ ...tournamentResults, population: { ...source, teamIds: [teamId, opponentId] } })).toBe(false);
});

it("keeps schedule, final results, roster, game appearances and player stats as separate coverage units", () => {
  const fixture = { ...game, homeTeamId: teamId, awayTeamId: opponentId };
  const selected = complete("selected_player", [`${teamId}|${selection.playerId}`]);
  const appeared = { ...selection, kind: "appeared", gameId: final.id };
  const appearances = complete("player_game_appearance", [`${final.id}|${teamId}|${selection.playerId}`]);
  const snapshot = { ...edition, sources: [testRevision], games: [fixture], participation: [selection] };
  const parse = (claim: object, data: object = snapshot) => internationalTournamentEvidenceSchema.safeParse({ ...data,
    coverage: { ...edition.coverage, ...claim } }).success;
  const schedule = complete("scheduled_game", [fixture.id]);
  expect(parse({ schedule, selections: selected })).toBe(true);
  expect(parse({ results: { ...schedule, unit: "final_game" } })).toBe(false);
  expect(parse({ results: schedule }, { ...snapshot, games: [final] })).toBe(false);
  expect(parse({ registrations: { ...selected, unit: "registered_player" } })).toBe(false);
  expect(parse({ appearances }, { ...snapshot, games: [final] })).toBe(false);
  expect(parse({ appearances }, { ...snapshot, games: [{ ...fixture, status: "in_progress" }], participation: [appeared] })).toBe(false);
  expect(parse({ appearances }, { ...snapshot, games: [final], participation: [appeared] })).toBe(true);
  expect(parse({ playerStats: appearances }, { ...snapshot, games: [final], participation: [appeared] })).toBe(false);
});

it("keeps international games out of existing NPB scopes, indexes, domestic Facts and MVP input", () => {
  const { index, game: domesticGame } = mvpFixture();
  expect(gameDateIndexSchema.parse(index)).toEqual(index);
  const foreignRow = { ...index.games[0], gameId: game.id };
  expect(gameDateIndexSchema.safeParse({ ...index, games: [foreignRow] }).success).toBe(false);
  expect(npbCompetitionScopeSchema.safeParse({ league: "NPB", season: 2026, temporalScope: "saved_current", competition: "international", stage: null }).success).toBe(false);
  expect(playerGameBattingSchema.safeParse(selection).success).toBe(false);
  expect(playerGamePitchingSchema.safeParse(selection).success).toBe(false);
  expect(savedGameMvpInputs(index, [domesticGame])).toHaveLength(1);
  expect(savedGameMvpInputs(index, [{ ...domesticGame, gameId: game.id }])).toEqual([]);
});

it("admits separate WBC batting and pitching totals, with exact counts and missing values preserved", () => {
  const wbc = japanResultsByTournament.get("international:tournament:wbc:2023")!;
  const batting = wbc.playerStats.filter(row => row.role === "batting");
  const pitching = wbc.playerStats.filter(row => row.role === "pitching");
  expect(batting).toHaveLength(16);
  expect(pitching).toHaveLength(14);
  expect(batting.reduce((totals, row) => [totals[0]! + row.atBats, totals[1]! + row.hits,
    totals[2]! + row.homeRuns, totals[3]! + row.runsBattedIn], [0, 0, 0, 0])).toEqual([221, 66, 9, 55]);
  expect(pitching.reduce((total, row) => total + row.outs, 0)).toBe(189);
  expect(pitching.find(row => row.name === "髙橋宏斗")?.strikeouts).toBeNull();
  expect(pitching.find(row => row.name === "大谷翔平")?.playerId).toBe(batting.find(row => row.name === "大谷翔平")?.playerId);
  expect(wbc.participation).toEqual([]);
  expect(wbc.identities).toEqual([]);
  expect(wbc.coverage.appearances.status).toBe("uncollected");

  const row = batting[0]!;
  for (const change of [
    { playerStats: [...wbc.playerStats, row] },
    { playerStats: [{ ...row, gamesPlayed: 8 }] },
    { playerStats: [{ ...row, hits: row.atBats + 1 }] },
    { playerStats: [{ ...row, tournamentId }] },
    { playerStats: [{ ...row, teamId: opponentId }] },
    { playerStats: [{ ...row, source: { ...row.source, sourceRevisionId: "unverified" } }] },
    { coverage: { ...wbc.coverage, playerStats: uncollected } },
  ]) expect(internationalTournamentEvidenceSchema.safeParse({ ...wbc, ...change }).success).toBe(false);
});

it("keeps the WBC selection snapshot separate from game appearances and registration", () => {
  const id = "international:tournament:wbc:2026";
  const wbc = japanResultsByTournament.get(id)!;
  const roster = japanSelectionsByTournament.get(id)!;
  expect(roster.players).toHaveLength(30);
  expect(new Set(roster.players.map(player => player.id)).size).toBe(30);
  expect(roster.players).toContainEqual(expect.objectContaining({ name: "金丸夢斗", date: "2026-02-26" }));
  expect(roster.players).toContainEqual(expect.objectContaining({ name: "大谷翔平", position: "指名打者" }));
  expect(roster.players.map(player => player.name)).not.toContain("松井裕樹");
  expect(wbc.games).toHaveLength(5);
  expect(wbc.editionRevision).toBe(4);
  expect(wbc.participation.filter(player => player.kind === "selected")).toHaveLength(30);
  expect(wbc.participation.filter(player => player.kind === "registered")).toEqual([]);
  expect(wbc.coverage.registrations.status).toBe("uncollected");
  expect(wbc.coverage.appearances.status).toBe("partial");
  expect(wbc.playerStats).toEqual([]);
  expect(wbc.identities).toEqual([]);
  expect(japanResultsByTournament.has("international:tournament:exhibition:2027:taipei")).toBe(false);
});

it("admits WBC Japan home runs and only the pitcher decision supported by each final score", () => {
  const wbc = japanResultsByTournament.get("international:tournament:wbc:2026")!;
  const quarterfinal = wbc.gameHighlights[4]!;
  expect(wbc.gameHighlights.map(row => row.homeRuns.reduce((sum, event) => sum + event.count, 0))).toEqual([1, 4, 1, 2, 2]);
  expect(wbc.gameHighlights.slice(0, 4).map(row => row.winningPitcherId))
    .toEqual([3610515, 3692477, 4463322, 4977707].map(id => `international:player:jawiki:${id}`));
  expect(quarterfinal).toMatchObject({ losingPitcherId: "international:player:jawiki:4237529",
    source: { sourceRevisionId: "1378823437" } });
  expect(quarterfinal.winningPitcherId).toBeUndefined();
  expect(wbc.games[4]).toMatchObject({ localDate: "2026-03-14", timeZone: "America/New_York", result: { homeRuns: 5, awayRuns: 8 } });
  expect(wbc.coverage.gameHighlights.status).toBe("partial");
  expect(wbc.coverage.playerStats.status).toBe("uncollected");
  expect(wbc.coverage.appearances.status).toBe("partial");
  for (const invalid of [
    { ...quarterfinal, losingPitcherId: undefined, winningPitcherId: quarterfinal.losingPitcherId },
    { ...quarterfinal, winningPitcherId: quarterfinal.losingPitcherId },
    { ...quarterfinal, losingPitcherId: "international:player:unrecorded" },
    { ...quarterfinal, losingPitcherId: undefined },
    { ...quarterfinal, gameId: wbc.games[0]!.id },
  ]) expect(internationalTournamentEvidenceSchema.safeParse({ ...wbc, gameHighlights: [invalid] }).success).toBe(false);
});

it.each([
  ["international:tournament:apbc:2026", 9],
  ["international:tournament:wbc:2026", 11],
])("preserves game appearances supported by a home run or decision in %s", (id, playerCount) => {
  const snapshot = japanResultsByTournament.get(id)!;
  const appearances = snapshot.participation.filter(record => record.kind === "appeared")
    .filter(record => record.source.sourceRevisionId !== apbc2026BatteryRevision);
  expect(appearances).toHaveLength(14);
  expect(new Set(appearances.map(row => row.playerId)).size).toBe(playerCount);
  for (const row of appearances) {
    const game = snapshot.games.find(game => game.id === row.gameId)!;
    const highlights = snapshot.gameHighlights.find(record => record.gameId === row.gameId)!;
    expect(row.date).toBe(game.localDate);
    expect(row.source).toEqual(highlights.source);
    expect([highlights.winningPitcherId, highlights.losingPitcherId, ...highlights.homeRuns.map(h => h.playerId)]).toContain(row.playerId);
  }
  // An appearance derived from highlights cannot establish roster identity for those same highlights.
  expect(internationalTournamentEvidenceSchema.safeParse({ ...snapshot, participation: appearances }).success).toBe(false);
});

it("admits Premier12 Japan totals with the final included and preserves the evidence scope", () => {
  const premier = japanResultsByTournament.get("international:tournament:premier12:2024")!;
  const batting = premier.playerStats.filter(row => row.role === "batting");
  const pitching = premier.playerStats.filter(row => row.role === "pitching");
  expect(premier.games).toHaveLength(9);
  expect(premier.editionRevision).toBe(2);
  expect(batting).toHaveLength(15);
  expect(pitching).toHaveLength(13);
  expect(batting.reduce((sum, row) => sum + row.atBats, 0)).toBe(302);
  expect(batting.reduce((sum, row) => sum + row.hits, 0)).toBe(90);
  expect(pitching.reduce((sum, row) => sum + row.outs, 0)).toBe(243);
  expect(pitching.reduce((sum, row) => sum + (row.strikeouts ?? 0), 0)).toBe(113);
  expect(batting.find(row => row.name === "森下翔太")).toMatchObject({
    gamesPlayed: 9, atBats: 28, hits: 10, homeRuns: 1, runsBattedIn: 9, playerId: "international:player:jawiki:4037204",
  });
  expect(pitching.find(row => row.name === "藤平尚真")).toMatchObject({
    gamesPlayed: 6, outs: 18, earnedRuns: 0, strikeouts: 12, playerId: "international:player:jawiki:3514754",
  });
  expect(premier.playerStats.every(row => row.source.sourceRevisionId === "111780580")).toBe(true);
  expect(premier.coverage.playerStats).toMatchObject({ status: "partial", scope: { kind: "team", teamId: "international:team:jpn" } });
  expect(premier.coverage.appearances.status).toBe("uncollected");
  expect(premier.participation).toEqual([]);
  expect(premier.identities).toEqual([]);
});

it("admits APBC home runs and winning pitchers independently of full player statistics", () => {
  const apbc = japanResultsByTournament.get(tournamentId)!;
  const highlights = apbc.gameHighlights;
  expect(highlights.map(row => row.homeRuns.reduce((sum, event) => sum + event.count, 0))).toEqual([3, 4, 3, 2]);
  expect(highlights.map(row => row.winningPitcherId)).toEqual([4977707, 4847158, 4847462, 4251765].map(pageId => `international:player:jawiki:${pageId}`));
  expect(apbc.tournamentMvp?.playerId).toBe("international:player:jawiki:4980856");
  expect(apbc.coverage.gameHighlights.status).toBe("partial");
  expect(apbc.coverage.playerStats.status).toBe("uncollected");
  expect(apbc.coverage.appearances.status).toBe("partial");
  const pending = { ...apbc.games[0]!, status: "scheduled", result: null };
  const first = highlights[0]!;
  for (const change of [
    { gameHighlights: [first, first] },
    { coverage: { ...apbc.coverage, gameHighlights: uncollected } },
    { gameHighlights: [{ ...first, source: { ...first.source, sourceRevisionId: "unknown" } }] },
    { gameHighlights: [{ ...first, teamId: opponentId }] },
    { gameHighlights: [{ ...first, winningPitcherId: "international:player:unknown" }] },
    { gameHighlights: [{ ...first, homeRuns: [{ ...first.homeRuns[0]!, count: 6 }] }] },
    { gameHighlights: [{ ...first, homeRuns: [first.homeRuns[0], first.homeRuns[0]] }] },
    { games: [pending, ...apbc.games.slice(1)] },
    { tournamentMvp: { ...apbc.tournamentMvp!, playerId: "international:player:unknown" } },
  ]) expect(internationalTournamentEvidenceSchema.safeParse({ ...apbc, ...change }).success).toBe(false);
});

it("links all twenty APBC confirmed participants to existing NPB IDs with independent evidence", () => {
  const apbc = japanResultsByTournament.get(tournamentId)!;
  const appeared = new Set(apbc.participation.filter(row => row.kind === "appeared").map(row => row.playerId));
  expect(appeared.size).toBe(20);
  expect(new Set(apbc.identities.map(row => row.playerId))).toEqual(appeared);
  for (const row of apbc.identities) {
    expect(row.league).toBe("NPB");
    const existing = npbProfileIdentities.find(player => player.playerId === row.canonicalPlayerId);
    expect(existing?.verificationStatus).toBe("source_verified");
    expect(row.evidence.canonical.identifier).toEqual({
      method: "shared_player_identifier", authorityId: "npb", value: existing?.npbId,
    });
    expect(row.evidence.canonical.sourceRecordId).toBe(existing?.chadwick?.uuid);
    const [first, second] = [row.evidence.international, row.evidence.canonical].map(
      evidence => apbc.sources.find(source => source.id === evidence.sourceRevisionId)?.publisherId);
    expect([first, second]).toEqual(["japanese-wikipedia", "chadwick-bureau"]);
    expect(japanGameAppearances(row.canonicalPlayerId)).toEqual([{ tournamentId, confirmedGames:
      apbc.participation.filter(record => record.kind === "appeared" && record.playerId === row.playerId).length }]);
  }
  expect(japanGameAppearances("6c571e31-d07d-4cb5-9c1c-a9ea83a653e5")).toEqual([{ tournamentId, confirmedGames: 1 }]);
  expect(apbc.participation.map(row => [row.playerId, row.kind])).toContainEqual(["international:player:jawiki:4989618", "selected"]);
  expect(japanGameAppearances("fe036654-2cac-480e-b2ef-80f2cb2fb479")).toEqual([]);
  expect(apbc.playerStats).toEqual([]);
  expect(apbc.coverage.appearances.status).toBe("partial");
});

it("admits APBC pitching and catching appearances from four reviewed batteries without duplicating highlights", () => {
  const apbc = japanResultsByTournament.get(tournamentId)!;
  const appearances = apbc.participation.filter(row => row.kind === "appeared");
  const additions = appearances.filter(row => row.source.sourceRevisionId === apbc2026BatteryRevision);
  expect(appearances).toHaveLength(31);
  expect(new Set(appearances.map(row => row.playerId)).size).toBe(20);
  expect(additions).toHaveLength(17);
  expect(new Set(appearances.map(row => `${row.gameId}|${row.playerId}`)).size).toBe(31);
  expect(apbc2026Batteries.map(row => row.pitchers.length)).toEqual([3, 6, 4, 3]);
  expect(apbc2026Batteries.map(row => row.catchers.length)).toEqual([2, 1, 2, 1]);
  const roster = japanSelectionsByTournament.get(tournamentId)!.players;
  for (const battery of apbc2026Batteries) {
    const playerId = (pageId: number) => `international:player:jawiki:${pageId}`;
    for (const [ids, position] of [[battery.pitchers.map(([id]) => id), "投手"], [battery.catchers, "捕手"]] as const) {
      for (const id of ids) {
        expect(roster.find(row => row.id === playerId(id))?.position).toBe(position);
        expect(appearances.some(row => row.playerId === playerId(id) && row.date === battery.date)).toBe(true);
      }
    }
  }
  // 中森俊介 entered on 11/13 and recorded no outs; that still counts as appearing.
  expect(additions).toContainEqual(expect.objectContaining({
    playerId: "international:player:jawiki:4274936", date: "2026-11-13",
  }));
  expect(apbc.coverage).toMatchObject({
    appearances: { status: "partial" }, registrations: { status: "uncollected" }, playerStats: { status: "uncollected" },
  });
});

it("admits APBC innings for the four completed Japanese games, including a zero-out outing", () => {
  const apbc = japanResultsByTournament.get(tournamentId)!;
  expect(apbc.gamePitching.map(game => game.teamOuts)).toEqual([27, 27, 21, 27]);
  expect(apbc.gamePitching.flatMap(game => game.pitchers)).toHaveLength(16);
  expect(new Set(apbc.gamePitching.flatMap(game => game.pitchers.map(row => row.playerId))).size).toBe(13);
  expect(apbc.gamePitching[1]!.pitchers).toContainEqual({ playerId: "international:player:jawiki:4274936", outs: 0 });
  expect(apbc.gamePitching[2]!.pitchers).toContainEqual({ playerId: "international:player:jawiki:4832529", outs: 12 });
  expect(apbc.coverage.playerStats.status).toBe("uncollected");
  expect(apbc.coverage.appearances.status).toBe("partial");
  for (const [id, edition] of japanResultsByTournament) {
    if (id !== tournamentId) expect(edition.gamePitching).toEqual([]);
  }
  const game = apbc.gamePitching[0]!;
  const pitcher = game.pitchers[0]!;
  for (const gamePitching of [
    [game, game],
    [{ ...game, teamOuts: 26 }],
    [{ ...game, teamOutsSource: game.source }],
    [{ ...game, teamOutsSource: { ...game.teamOutsSource, sourceRevisionId: "unapproved" } }],
    [{ ...game, pitchers: [pitcher, pitcher, ...game.pitchers.slice(1)], teamOuts: game.teamOuts + pitcher.outs }],
    [{ ...game, pitchers: [{ ...pitcher, playerId: "international:player:jawiki:4832529" }, ...game.pitchers.slice(1)] }],
    [{ ...game, pitchers: [{ ...pitcher, outs: null }, ...game.pitchers.slice(1)] }],
    [{ ...game, teamId: "international:team:aus" }],
  ]) expect(internationalTournamentEvidenceSchema.safeParse({ ...apbc, gamePitching }).success).toBe(false);
});
