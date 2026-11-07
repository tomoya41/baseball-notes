import { expect, it } from "vitest";
import { internationalOfficialTournaments } from "../src/data/international-official-links";
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
  expect(internationalOfficialTournaments.map(t => t.id)).toHaveLength(6);
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
