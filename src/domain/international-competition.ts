import { z } from "zod";

const tournamentId = z.string().regex(/^international:tournament:(?:apbc|wbc|premier12|exhibition):\d{4}(?::[a-z0-9-]+)?$/);
const teamId = z.string().regex(/^international:team:[a-z0-9-]+$/);
const gameId = z.string().regex(/^international:game:[a-z0-9:-]+$/);
const playerId = z.string().regex(/^international:player:[a-z0-9:-]+$/);
const label = z.string().trim().min(1);
const officialUrl = z.url({ protocol: /^https$/ });

export const internationalTournamentSchema = z.strictObject({
  competition: z.literal("international"),
  id: tournamentId,
  kind: z.enum(["apbc", "wbc", "premier12", "exhibition"]),
  year: z.number().int().min(1900).max(9999),
  name: label,
  summary: label.optional(),
  links: z.array(z.strictObject({ label, url: officialUrl })).min(1),
}).refine(t => {
  const [, , kind, year] = t.id.split(":");
  return t.kind === kind && t.year === Number(year);
}, "Tournament ID and edition mismatch");

const sourceReference = z.strictObject({ sourceRevisionId: label, sourceRecordId: label });
const timeZone = z.string().refine(zone => {
  if (!/^[A-Za-z]/.test(zone)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; }
  catch { return false; }
}, "Expected an IANA time zone");
const runs = z.number().int().nonnegative();

export const internationalGameSchema = z.strictObject({
  competition: z.literal("international"), tournamentId, id: gameId,
  round: z.enum(["qualifier", "pool", "super_round", "quarterfinal", "semifinal", "third_place", "final", "exhibition"]),
  homeTeamId: teamId.nullable(), awayTeamId: teamId.nullable(),
  localDate: z.iso.date().nullable(), scheduledAt: z.iso.datetime({ offset: true }).nullable(), timeZone,
  status: z.enum(["scheduled", "in_progress", "suspended", "postponed", "canceled", "final", "unknown"]),
  result: z.strictObject({ homeRuns: runs, awayRuns: runs }).nullable(),
  source: sourceReference,
}).refine(game => {
  const teamsKnown = game.homeTeamId !== null && game.awayTeamId !== null;
  if (teamsKnown && game.homeTeamId === game.awayTeamId) return false;
  if (game.status === "final") return teamsKnown && game.result !== null;
  return game.result === null;
}, "Final results require both confirmed teams; other statuses have no final result")
  .refine(game => {
    if (!game.localDate || !game.scheduledAt || !timeZone.safeParse(game.timeZone).success) return true;
    const instant = Date.parse(game.scheduledAt);
    return Number.isFinite(instant) && new Intl.DateTimeFormat("sv-SE", { timeZone: game.timeZone }).format(instant) === game.localDate;
  },
  { path: ["localDate"], message: "Local date must agree with the scheduled instant and time zone" });

const participation = z.strictObject({
  competition: z.literal("international"), tournamentId, teamId, playerId,
  date: z.iso.date().nullable(), source: sourceReference,
});
export const internationalParticipationSchema = z.discriminatedUnion("kind", [
  participation.extend({ kind: z.literal("selected") }),
  participation.extend({ kind: z.literal("registered") }),
  participation.extend({ kind: z.literal("appeared"), gameId }),
]);

const permission = z.enum(["approved", "unverified", "prohibited"]);
const organizationId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sourceRevision = z.strictObject({
  id: label, sourceId: label, publisherId: organizationId, version: label, url: officialUrl, termsEvidenceUrl: officialUrl,
  verifiedAt: z.iso.datetime(),
  permissions: z.strictObject({
    acquisition: permission, storage: permission, transformation: permission,
    webDisplay: permission, androidDisplay: permission, redistribution: permission,
  }),
});
const coverageScope = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("tournament") }),
  z.strictObject({ kind: z.literal("team"), teamId }),
]);
const coverageUnit = z.enum(["scheduled_game", "final_game", "selected_player", "registered_player", "player_game_appearance"]);
const uncollected = z.strictObject({ status: z.literal("uncollected") });
const partialCoverage = z.strictObject({ status: z.literal("partial"), scope: coverageScope, source: sourceReference });
const coverage = z.discriminatedUnion("status", [
  uncollected,
  partialCoverage,
  z.strictObject({ status: z.literal("complete"), scope: coverageScope, source: sourceReference,
    population: sourceReference.extend({ teamIds: z.array(teamId).min(1) }),
    unit: coverageUnit, expectedIds: z.array(label).min(1),
    expectedCount: z.number().int().positive(), collectedCount: z.number().int().positive() }),
]);
const playerStat = z.strictObject({
  competition: z.literal("international"), tournamentId, teamId, playerId, name: label,
  gamesPlayed: z.number().int().positive(), source: sourceReference,
});
const tournamentPlayerStat = z.discriminatedUnion("role", [
  playerStat.extend({ role: z.literal("batting"), atBats: runs, hits: runs, homeRuns: runs, runsBattedIn: runs }),
  playerStat.extend({ role: z.literal("pitching"), outs: runs, runsAllowed: runs, earnedRuns: runs, strikeouts: runs.nullable() }),
]);
const gameHighlights = z.strictObject({
  gameId, teamId, source: sourceReference, winningPitcherId: playerId.optional(), losingPitcherId: playerId.optional(),
  homeRuns: z.array(z.strictObject({ playerId, count: z.number().int().positive() })),
  noHomeRuns: z.literal(true).optional(),
});
const gamePitching = z.strictObject({
  gameId, teamId, source: sourceReference,
  teamOuts: runs, teamOutsSource: sourceReference,
  pitchers: z.array(z.strictObject({ playerId, outs: runs })).min(1),
});
const tournamentMvp = z.strictObject({ teamId, playerId, source: sourceReference });
const allTournamentSelection = tournamentMvp.extend({
  position: z.enum(["pitcher", "catcher", "first_base", "second_base", "third_base", "shortstop", "outfield", "designated_hitter"]),
});
const personIdentifier = z.discriminatedUnion("method", [
  z.strictObject({ method: z.literal("shared_player_identifier"), authorityId: organizationId, value: label }),
  z.strictObject({ method: z.literal("birth_date_and_affiliation"), birthDate: z.iso.date(), affiliationId: label }),
]);
const identitySource = sourceReference.extend({
  publication: z.literal("original"),
  documentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  identifier: personIdentifier,
});
const identityBridge = z.strictObject({
  playerId,
  evidence: z.strictObject({
    international: identitySource.extend({ subjectId: playerId }),
    canonical: identitySource.extend({ subjectId: label }),
  }),
  review: z.strictObject({ result: z.literal("verified"), reviewer: label, reviewedAt: z.iso.datetime(), rationale: label }),
});
const identity = z.discriminatedUnion("league", [
  identityBridge.extend({ league: z.literal("NPB"), canonicalPlayerId: z.uuid() }),
  identityBridge.extend({ league: z.literal("MLB"), canonicalPlayerId: z.templateLiteral(["mlb:player:", z.uuid()]) }),
]);

function inScope(scope: z.infer<typeof coverageScope>, ...teams: (string | null)[]): boolean {
  return scope.kind === "tournament" || teams.includes(scope.teamId);
}

/** A tournament's release evidence is separate from its public, link-only introduction. */
export const internationalTournamentEvidenceSchema = z.strictObject({
  tournamentId, editionRevision: z.number().int().positive(),
  sources: z.array(sourceRevision), identities: z.array(identity),
  games: z.array(internationalGameSchema), participation: z.array(internationalParticipationSchema),
  playerStats: z.array(tournamentPlayerStat).default([]),
  gameHighlights: z.array(gameHighlights).default([]),
  gamePitching: z.array(gamePitching).default([]),
  tournamentMvp: tournamentMvp.optional(),
  allTournamentTeam: z.array(allTournamentSelection).default([]),
  coverage: z.strictObject({ schedule: coverage, results: coverage, selections: coverage,
    registrations: coverage, appearances: coverage, playerStats: z.discriminatedUnion("status", [uncollected, partialCoverage]),
    gameHighlights: z.discriminatedUnion("status", [uncollected, partialCoverage]).default({ status: "uncollected" }) }),
  corrections: z.array(z.strictObject({
    supersedesRevision: z.number().int().positive(), recordedAt: z.iso.datetime(), reason: label, source: sourceReference,
  })),
}).superRefine((edition, context) => {
  const approved = new Map(edition.sources.filter(s => Object.values(s.permissions).every(p => p === "approved")).map(s => [s.id, s]));
  if (new Set(edition.sources.map(s => s.id)).size !== edition.sources.length)
    context.addIssue({ code: "custom", path: ["sources"], message: "Duplicate source revision" });
  if (new Set(edition.identities.map(i => i.playerId)).size !== edition.identities.length ||
    new Set(edition.identities.map(i => `${i.league}|${i.canonicalPlayerId}`)).size !== edition.identities.length)
    context.addIssue({ code: "custom", path: ["identities"], message: "Conflicting player identity bridge" });
  for (const [index, bridge] of edition.identities.entries()) {
    const { international, canonical } = bridge.evidence;
    const first = approved.get(international.sourceRevisionId), second = approved.get(canonical.sourceRevisionId);
    if (!first || !second || first.publisherId === second.publisherId || first.sourceId === second.sourceId || first.url === second.url ||
      international.documentSha256 === canonical.documentSha256 || international.subjectId !== bridge.playerId ||
      canonical.subjectId !== bridge.canonicalPlayerId ||
      JSON.stringify(international.identifier) !== JSON.stringify(canonical.identifier) ||
      Date.parse(bridge.review.reviewedAt) < Math.max(Date.parse(first.verifiedAt), Date.parse(second.verifiedAt)))
      context.addIssue({ code: "custom", path: ["identities", index], message: "Identity requires reviewed matching identifiers from two independent original sources" });
  }
  const games = new Map(edition.games.map(g => [g.id, g]));
  if (games.size !== edition.games.length || edition.games.some(g =>
    g.tournamentId !== edition.tournamentId || !approved.has(g.source.sourceRevisionId)))
    context.addIssue({ code: "custom", path: ["games"], message: "Games require unique IDs and admitted evidence for this tournament" });
  const statsCoverage = edition.coverage.playerStats;
  if (statsCoverage.status === "uncollected" ? edition.playerStats.length !== 0 :
    !edition.playerStats.length || !approved.has(statsCoverage.source.sourceRevisionId))
    context.addIssue({ code: "custom", path: ["coverage", "playerStats"], message: "Collected player stats require an admitted coverage source" });
  const finalCounts = new Map<string, number>();
  for (const game of edition.games) {
    if (game.status !== "final") continue;
    for (const team of [game.awayTeamId, game.homeTeamId]) {
      if (team) finalCounts.set(team, (finalCounts.get(team) ?? 0) + 1);
    }
  }
  const statKeys = new Set<string>();
  for (const [index, row] of edition.playerStats.entries()) {
    const key = `${row.teamId}|${row.playerId}|${row.role}`;
    const invalid = row.role === "batting" ? row.homeRuns > row.hits || row.hits > row.atBats : row.earnedRuns > row.runsAllowed;
    if (statKeys.has(key) || invalid || row.tournamentId !== edition.tournamentId || !approved.has(row.source.sourceRevisionId) ||
      statsCoverage.status !== "partial" || !inScope(statsCoverage.scope, row.teamId) ||
      row.gamesPlayed > (finalCounts.get(row.teamId) ?? 0))
      context.addIssue({ code: "custom", path: ["playerStats", index], message: "Stats require valid counts, a unique role and admitted evidence in this tournament and scope" });
    statKeys.add(key);
  }
  const participationIds = new Set<string>();
  for (const [index, record] of edition.participation.entries()) {
    const game = record.kind === "appeared" ? games.get(record.gameId) : undefined;
    const invalidAppearance = record.kind === "appeared" && (!game ||
      !["in_progress", "suspended", "final"].includes(game.status) ||
      (game.homeTeamId !== record.teamId && game.awayTeamId !== record.teamId));
    const key = record.kind === "appeared" ? `${record.gameId}|${record.teamId}|${record.playerId}` : `${record.teamId}|${record.playerId}`;
    const uniqueKey = `${record.kind}|${key}`;
    if (participationIds.has(uniqueKey) || invalidAppearance || record.tournamentId !== edition.tournamentId || !approved.has(record.source.sourceRevisionId))
      context.addIssue({ code: "custom", path: ["participation", index], message: "Participation requires a unique record, admitted evidence and, for an appearance, a played game" });
    participationIds.add(uniqueKey);
  }
  const affiliatedPlayers = new Set(edition.participation.filter(record => record.kind !== "appeared")
    .map(record => `${record.teamId}|${record.playerId}`));
  const pitchedGames = new Set<string>();
  for (const [index, row] of edition.gamePitching.entries()) {
    const game = games.get(row.gameId);
    const key = `${row.gameId}|${row.teamId}`;
    const pitcherIds = new Set(row.pitchers.map(pitcher => pitcher.playerId));
    if (game?.status !== "final" || !game.localDate || (game.homeTeamId !== row.teamId && game.awayTeamId !== row.teamId) ||
      pitchedGames.has(key) || !approved.has(row.source.sourceRevisionId) || !approved.has(row.teamOutsSource.sourceRevisionId) ||
      (row.source.sourceRevisionId === row.teamOutsSource.sourceRevisionId && row.source.sourceRecordId === row.teamOutsSource.sourceRecordId) ||
      pitcherIds.size !== row.pitchers.length || row.pitchers.reduce((sum, pitcher) => sum + pitcher.outs, 0) !== row.teamOuts ||
      row.pitchers.some(pitcher => !participationIds.has(`appeared|${key}|${pitcher.playerId}`))) {
      context.addIssue({ code: "custom", path: ["gamePitching", index],
        message: "Game pitching requires verified appearances and pitching outs that match the separately sourced team total" });
    }
    pitchedGames.add(key);
  }
  const highlightedGames = new Set<string>();
  const highlightsCoverage = edition.coverage.gameHighlights;
  if (highlightsCoverage.status === "uncollected" ? edition.gameHighlights.length !== 0 :
    !edition.gameHighlights.length || !approved.has(highlightsCoverage.source.sourceRevisionId)) {
    context.addIssue({ code: "custom", path: ["coverage", "gameHighlights"], message: "Collected highlights require an admitted coverage source" });
  }
  for (const [index, row] of edition.gameHighlights.entries()) {
    const game = games.get(row.gameId);
    const sides = game?.status === "final" && game.result && (game.homeTeamId === row.teamId
      ? [game.result.homeRuns, game.result.awayRuns] as const
      : game.awayTeamId === row.teamId ? [game.result.awayRuns, game.result.homeRuns] as const : null);
    const decision = sides && (sides[0] > sides[1] && !row.losingPitcherId ? row.winningPitcherId :
      sides[0] < sides[1] && !row.winningPitcherId ? row.losingPitcherId : undefined);
    const hitters = new Set(row.homeRuns.map(record => record.playerId));
    if (!sides || !decision || highlightedGames.has(row.gameId) || (row.homeRuns.length === 0) !== (row.noHomeRuns === true) ||
      highlightsCoverage.status !== "partial" || !inScope(highlightsCoverage.scope, row.teamId) ||
      !approved.has(row.source.sourceRevisionId) || !affiliatedPlayers.has(`${row.teamId}|${decision}`) ||
      hitters.size !== row.homeRuns.length || row.homeRuns.reduce((count, record) => count + record.count, 0) > sides[0] ||
      row.homeRuns.some(record => !affiliatedPlayers.has(`${row.teamId}|${record.playerId}`))) {
      context.addIssue({ code: "custom", path: ["gameHighlights", index], message: "Highlights require a final score, the matching pitcher decision and admitted evidence for the team's players" });
    }
    highlightedGames.add(row.gameId);
  }
  const mvp = edition.tournamentMvp;
  const honorParticipants = new Set([
    ...edition.participation.filter(row => row.kind === "appeared").map(row => `${row.teamId}|${row.playerId}`),
    ...edition.playerStats.filter(row => row.gamesPlayed > 0).map(row => `${row.teamId}|${row.playerId}`),
  ]);
  if (mvp && (!approved.has(mvp.source.sourceRevisionId) ||
    !honorParticipants.has(`${mvp.teamId}|${mvp.playerId}`) || !edition.games.some(game =>
      game.round === "final" && game.status === "final" && (game.homeTeamId === mvp.teamId || game.awayTeamId === mvp.teamId)))) {
    context.addIssue({ code: "custom", path: ["tournamentMvp"], message: "Tournament MVP requires admitted evidence for a player on a finalist team" });
  }
  const awardKeys = new Set<string>();
  for (const [index, row] of edition.allTournamentTeam.entries()) {
    const participant = `${row.teamId}|${row.playerId}`;
    const key = `${participant}|${row.position}`;
    if (awardKeys.has(key) || !approved.has(row.source.sourceRevisionId) || !honorParticipants.has(participant) || !finalCounts.has(row.teamId)) {
      context.addIssue({ code: "custom", path: ["allTournamentTeam", index],
        message: "All-tournament selections require unique player positions, admitted evidence and a played tournament" });
    }
    awardKeys.add(key);
  }
  const coverageUnits = { schedule: "scheduled_game", results: "final_game", selections: "selected_player",
    registrations: "registered_player", appearances: "player_game_appearance" } as const;
  for (const field of Object.keys(coverageUnits) as (keyof typeof coverageUnits)[]) {
    const value = edition.coverage[field];
    if (value.status === "uncollected") continue;
    if (!approved.has(value.source.sourceRevisionId))
      context.addIssue({ code: "custom", path: ["coverage", field], message: "Coverage requires an admitted source revision" });
    if (value.status !== "complete") continue;

    const actualIds: string[] = [], actualTeams = new Set<string>();
    for (const game of edition.games) {
      if (!inScope(value.scope, game.homeTeamId, game.awayTeamId)) continue;
      if ((field === "schedule" && (game.localDate || game.scheduledAt)) || (field === "results" && game.status === "final")) {
        actualIds.push(game.id);
        for (const team of [game.homeTeamId, game.awayTeamId]) if (team && inScope(value.scope, team)) actualTeams.add(team);
      }
    }
    for (const record of edition.participation) {
      if (!inScope(value.scope, record.teamId)) continue;
      if ((field === "selections" && record.kind === "selected") || (field === "registrations" && record.kind === "registered")) {
        actualIds.push(`${record.teamId}|${record.playerId}`);
        actualTeams.add(record.teamId);
      }
      if (field === "appearances" && record.kind === "appeared") {
        const game = games.get(record.gameId);
        if (game?.status === "final") {
          actualIds.push(`${record.gameId}|${record.teamId}|${record.playerId}`);
          actualTeams.add(record.teamId);
        }
      }
    }
    const expected = new Set(value.expectedIds);
    const population = new Set(value.population.teamIds);
    const validPopulation = approved.has(value.population.sourceRevisionId) && population.size === value.population.teamIds.length &&
      (value.scope.kind === "tournament" ? population.size >= 2 : population.size === 1 && population.has(value.scope.teamId)) &&
      actualTeams.size === population.size && [...actualTeams].every(team => population.has(team));
    if (!validPopulation || value.unit !== coverageUnits[field] || value.expectedCount !== expected.size || value.expectedIds.length !== expected.size ||
      value.collectedCount !== actualIds.length || actualIds.length !== expected.size || actualIds.some(id => !expected.has(id)))
      context.addIssue({ code: "custom", path: ["coverage", field], message: "Complete coverage requires an exact admitted inventory of this scope and unit" });
  }
  for (const correction of edition.corrections) {
    if (correction.supersedesRevision >= edition.editionRevision || !approved.has(correction.source.sourceRevisionId))
      context.addIssue({ code: "custom", path: ["corrections"], message: "Correction requires an earlier revision and admitted evidence" });
  }
});
