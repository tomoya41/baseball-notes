import { isDeepStrictEqual } from "node:util";
import { npbPlayerDirectorySchema } from "../domain/npb-player-directory";
import { npbCatalogSchema, npbCapabilitiesSchema, npbTeamSeasonSchema } from "../domain/npb-product-contract";
import { npbSeasonMilestonesSchema } from "../domain/npb-season-milestones";
import { npbSeasonPayloadSchema } from "./npb-season-payload";
import { npbHotPayloadSchema } from "./npb-hot-payload";
import { buildNpbCapabilities } from "./npb-product-payload";
import { buildNpbSeasonMilestones } from "./npb-season-milestones";
import { gameManifestSchema, recentGamesSchema, gameDateIndexSchema } from "../domain/npb-game-index";
import { recordsSchema } from "../domain/npb-records";
import { buildNpbRecords } from "./npb-records-payload";

export type NpbPublicationInputs = {
  directory: unknown; catalog: unknown; capabilities: unknown; season: unknown;
  hot: unknown; teamSeason: unknown; milestones?: unknown;
  gameManifest?: unknown; gameRecent?: unknown; records?: unknown;
};
const requireEqual = (actual: unknown, expected: unknown, label: string) => {
  if (!isDeepStrictEqual(actual, expected)) throw Error(`NPB publication mismatch: ${label}`);
};

// Publication boundary only: never repairs canonical facts, coverage or a production gate.
export function validateNpbPublication(input: NpbPublicationInputs) {
  const directory = npbPlayerDirectorySchema.parse(input.directory);
  const catalog = npbCatalogSchema.parse(input.catalog);
  const capabilities = npbCapabilitiesSchema.parse(input.capabilities);
  const season = npbSeasonPayloadSchema.parse(input.season);
  const hot = npbHotPayloadSchema.parse(input.hot);
  const teamSeason = npbTeamSeasonSchema.parse(input.teamSeason);
  for (const payload of [catalog, capabilities, season, hot, teamSeason])
    requireEqual(payload.effectiveDate, directory.effectiveDate, "effectiveDate; use a coordinated Season publication to advance the date");
  for (const payload of [catalog, capabilities])
    requireEqual(payload.generatedAt, directory.generatedAt, "profile projection generation");
  requireEqual(teamSeason.season, season.season, "season identity");
  requireEqual(capabilities.coverage, season.coverage, "Capabilities Coverage");
  requireEqual(teamSeason.coverage, season.coverage, "Team Season Coverage");
  const teams = new Map(catalog.teams.map(t => [t.teamId, t]));
  requireEqual([...teams.keys()].sort(), directory.teams.map(t => t.id).sort(), "Team IDs");
  for (const t of directory.teams)
    requireEqual([teams.get(t.id)?.name, teams.get(t.id)?.shortName], [t.name, t.shortName], "Team names");
  const players = new Map(catalog.players.map(p => [p.playerId, p]));
  requireEqual([...players.keys()].sort(), directory.players.map(p => p.playerId).sort(), "Player IDs");
  for (const p of directory.players) {
    const c = players.get(p.playerId)!;
    requireEqual(p.playerType, p.position === "P" ? "pitcher" : p.position ? "fielder" : null, `Player type ${p.playerId}`);
    requireEqual([c.displayName, c.membership.teamId, c.battingAvailable, c.pitchingAvailable],
      [p.displayName, p.teamId, p.battingAvailable, p.pitchingAvailable], `Player context ${p.playerId}`);
    for (const key of ["position", "birthDate", "birthPlace", "nationality", "bats", "throws"] as const)
      requireEqual(c.profile[key], p[key], `Player ${key} ${p.playerId}`);
  }
  for (const p of season.players) requireEqual(players.get(p.playerId)?.displayName, p.displayName, "Season Player identity");
  const expectedCapabilities = buildNpbCapabilities(catalog, season, hot.readiness);
  for (const key of ["playerTeam", "position", "bats", "throws", "birthDate", "birthPlace", "nationality", "heightCm", "weightKg",
    "hot", "countingRanking", "rateRanking", "records"])
    requireEqual(capabilities.data[key], expectedCapabilities.data[key], `Capability ${key}`);
  // Older releases did not advertise Season checkpoints. Once advertised, it is mandatory.
  const milestones = input.milestones === undefined ? undefined : npbSeasonMilestonesSchema.parse(input.milestones);
  if (capabilities.data.seasonMilestones?.available && !milestones)
    throw Error("NPB publication mismatch: advertised Milestones missing");
  if (milestones) {
    const expected = buildNpbSeasonMilestones(season, catalog);
    requireEqual(milestones, expected, "Milestones generation/date/identity/counts");
  }
  const gameManifest = input.gameManifest === undefined ? undefined : gameManifestSchema.parse(input.gameManifest);
  const gameRecent = input.gameRecent === undefined ? undefined : recentGamesSchema.parse(input.gameRecent);
  const records = input.records === undefined ? undefined : recordsSchema.parse(input.records);
  if (gameManifest || gameRecent || records) {
    if (!gameManifest || !gameRecent || !records) throw Error("NPB publication mismatch: incomplete Game surface");
    for (const payload of [gameManifest, gameRecent, records])
      requireEqual(payload.effectiveDate, directory.effectiveDate, "Game surface effectiveDate");
    requireEqual(gameRecent.generatedAt, gameManifest.generatedAt, "Game surface generation");
    requireEqual(records, buildNpbRecords(season), "Records projection/Gate");
    if (new Set(gameRecent.games.map(g => g.gameId)).size !== gameRecent.games.length ||
      gameRecent.games.some(g => g.date > directory.effectiveDate || g.status !== "final" || !teams.has(g.home.id) || !teams.has(g.away.id)))
      throw Error("NPB publication mismatch: Recent Games");
  }
  return { directory, catalog, capabilities, season, hot, teamSeason, milestones, gameManifest, gameRecent, records };
}

// A dated schedule has no effectiveDate of its own; bind it to the manifest generation.
export function validateNpbPublishedGameDates(publication: ReturnType<typeof validateNpbPublication>, input: unknown[]) {
  if (!publication.gameManifest || !publication.gameRecent) throw Error("Game surface required");
  const days = input.map(value => gameDateIndexSchema.parse(value));
  const expectedDates = new Set([publication.directory.effectiveDate, ...publication.gameRecent.games.map(g => g.date)]);
  requireEqual(days.map(d => d.date).sort(), [...expectedDates].sort(), "published Game dates");
  for (const day of days) requireEqual(day.generatedAt, publication.gameManifest.generatedAt, "dated Game generation");
  for (const game of publication.gameRecent.games)
    requireEqual(days.find(d => d.date === game.date)?.games.find(g => g.gameId === game.gameId), game, "dated Recent Game");
}
