import { z } from "zod";
import { positionCodeSchema } from "./baseball-terms";

export const npbStoredProfileSchema = z.object({
  birthDate: z.iso.date().nullable(), birthPlace: z.string().nullable(), nationality: z.string().nullable(),
  position: positionCodeSchema.nullable(), bats: z.enum(["right", "left", "switch"]).nullable(),
  throws: z.enum(["right", "left"]).nullable(),
  provenance: z.record(z.string(), z.object({ source: z.enum(["wikidata", "nf3"]),
    sourceId: z.string().min(1), verifiedAt: z.iso.datetime() })),
});

export const npbPlayerDirectorySchema = z.strictObject({
  schemaVersion: z.literal(2),
  league: z.literal("NPB"),
  effectiveDate: z.iso.date(),
  generatedAt: z.iso.datetime(),
  teams: z.array(z.strictObject({ id: z.string().min(1), name: z.string().min(1), shortName: z.string().min(1) })),
  players: z.array(z.strictObject({
    playerId: z.string().uuid(),
    displayName: z.string().min(1),
    teamId: z.string().nullable(),
    position: positionCodeSchema.nullable(),
    playerType: z.enum(["pitcher", "fielder"]).nullable(),
    birthDate: z.iso.date().nullable(),
    birthPlace: z.string().nullable(),
    nationality: z.string().nullable(),
    bats: z.enum(["right", "left", "switch"]).nullable(),
    throws: z.enum(["right", "left"]).nullable(),
    battingAvailable: z.boolean(),
    pitchingAvailable: z.boolean(),
    recentAvailable: z.boolean(),
  })),
}).superRefine((value, context) => {
  const teams = new Set(value.teams.map((team) => team.id));
  if (teams.size !== 12) context.addIssue({ code: "custom", message: "Expected 12 NPB teams" });
  const players = new Set<string>();
  for (const player of value.players) {
    if (players.has(player.playerId)) context.addIssue({ code: "custom", message: "Duplicate player" });
    players.add(player.playerId);
    if (player.teamId && !teams.has(player.teamId))
      context.addIssue({ code: "custom", message: "Unknown team" });
    if (player.recentAvailable !== (player.battingAvailable || player.pitchingAvailable))
      context.addIssue({ code: "custom", message: "Inconsistent recent availability" });
  }
});

export type NpbPlayerDirectory = z.infer<typeof npbPlayerDirectorySchema>;
export type NpbDirectoryPlayer = NpbPlayerDirectory["players"][number];

export function normalizePlayerSearch(value: string): string {
  return value.normalize("NFKC").replace(/[\s\u3000]+/g, "").toLocaleLowerCase("ja-JP");
}

export function searchNpbPlayers(players: readonly NpbDirectoryPlayer[], query: string,
  filters: { teamId?: string | null; role?: "all" | "batter" | "pitcher" } = {}): NpbDirectoryPlayer[] {
  const needle = normalizePlayerSearch(query);
  const rank = (name: string) => {
    const normalized = normalizePlayerSearch(name);
    return !needle || normalized === needle ? 0 : normalized.startsWith(needle) ? 1 : normalized.includes(needle) ? 2 : 3;
  };
  return players.filter((player) => (!filters.teamId || player.teamId === filters.teamId) &&
    (filters.role !== "batter" || player.battingAvailable) &&
    (filters.role !== "pitcher" || player.pitchingAvailable) && rank(player.displayName) < 3)
    .sort((a, b) => rank(a.displayName) - rank(b.displayName) ||
      a.displayName.localeCompare(b.displayName, "ja") || a.playerId.localeCompare(b.playerId));
}
