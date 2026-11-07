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
const source = { sourceRevisionId: "test-revision", sourceRecordId: "test-record" };
const game = { competition: "international", tournamentId, id: "international:game:test-final", round: "final",
  homeTeamId: null, awayTeamId: null, localDate: "2026-11-15", scheduledAt: null, timeZone: "Asia/Tokyo",
  status: "scheduled", result: null, source };
const selection = { competition: "international", tournamentId, teamId, playerId: "international:player:test-player",
  kind: "selected", date: null, source };
const verifiedAt = "2026-11-01T00:00:00.000Z";
const uncollected = { status: "uncollected" };
const testRevision = { id: source.sourceRevisionId, sourceId: "test-source", version: "test-v1",
  url: "https://example.org/event", termsEvidenceUrl: "https://example.org/terms", verifiedAt,
  permissions: { acquisition: "approved", storage: "approved", transformation: "approved",
    webDisplay: "approved", androidDisplay: "approved", redistribution: "approved" } };
const edition = { tournamentId, editionRevision: 1, sources: [], identities: [], games: [], participation: [], corrections: [],
  coverage: { schedule: uncollected, results: uncollected, selections: uncollected,
    registrations: uncollected, appearances: uncollected, playerStats: uncollected } };

it("keeps official links out of tournament data admission", () => {
  expect(internationalOfficialTournaments.map(t => t.id)).toHaveLength(6);
  expect(internationalTournamentSchema.safeParse({ ...internationalOfficialTournaments[0], year: 2027 }).success).toBe(false);
  expect(internationalTournamentEvidenceSchema.safeParse(edition).success).toBe(true);
  const coverage = { ...edition.coverage, schedule: { status: "partial", scope: "test group", source } };
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
  const final = { ...game, homeTeamId: teamId, awayTeamId: "international:team:test", status: "final", result: { homeRuns: 1, awayRuns: 0 } };
  expect(internationalTournamentEvidenceSchema.safeParse({ ...pending, games: [final], participation: [appeared] }).success).toBe(true);
});

it("requires independent identity evidence and a prior revision for corrections", () => {
  const bridge = { league: "NPB", playerId: selection.playerId, canonicalPlayerId: "00000000-0000-4000-8000-000000000001",
    independentEvidence: ["https://example.org/player", "https://example.net/player"],
    verificationMethod: "test independent player identifiers", reviewedAt: verifiedAt };
  const correction = { supersedesRevision: 1, recordedAt: verifiedAt, reason: "test correction", source };
  const corrected = { ...edition, editionRevision: 2, identities: [bridge], sources: [testRevision], corrections: [correction] };
  expect(internationalTournamentEvidenceSchema.safeParse(corrected).success).toBe(true);
  expect(internationalTournamentEvidenceSchema.safeParse({ ...corrected, identities: [{ ...bridge, independentEvidence: [bridge.independentEvidence[0]] }] }).success).toBe(false);
  expect(internationalTournamentEvidenceSchema.safeParse({ ...corrected, editionRevision: 1 }).success).toBe(false);
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
