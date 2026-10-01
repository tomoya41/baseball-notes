import { isDeepStrictEqual } from "node:util";
import { npbPlayerDirectorySchema } from "../domain/npb-player-directory";
import { npbCatalogSchema, npbCapabilitiesSchema, npbTeamSeasonSchema } from "../domain/npb-product-contract";
import { npbSeasonMilestonesSchema } from "../domain/npb-season-milestones";
import { npbSeasonPayloadSchema } from "./npb-season-payload";
import { npbHotPayloadSchema } from "./npb-hot-payload";
import { buildNpbCapabilities } from "./npb-product-payload";
import { buildNpbSeasonMilestones } from "./npb-season-milestones";

export type NpbPublicationInputs = {
  directory: unknown; catalog: unknown; capabilities: unknown; season: unknown;
  hot: unknown; teamSeason: unknown; milestones?: unknown;
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
  return { directory, catalog, capabilities, season, hot, teamSeason, milestones };
}
