import { npbPlayerDirectorySchema } from "../domain/npb-player-directory";
import { positionCodeSchema } from "../domain/baseball-terms";
import { z } from "zod";
import { writeNpbPlayerDirectoryAtomically } from "./npb-player-directory-payload";

const legacySchema = z.strictObject({ schemaVersion: z.literal(1), league: z.literal("NPB"),
  effectiveDate: z.iso.date(), generatedAt: z.iso.datetime(),
  teams: z.array(z.strictObject({ id: z.string(), name: z.string(), shortName: z.string() })).length(12),
  players: z.array(z.strictObject({ playerId: z.string().uuid(), displayName: z.string().min(1),
    teamId: z.string().nullable(), position: z.string().nullable(),
    battingAvailable: z.boolean(), pitchingAvailable: z.boolean() })) });

function parsePublishedDirectory(input: unknown) {
  const modern = npbPlayerDirectorySchema.safeParse(input);
  if (modern.success) return modern.data;
  const old = legacySchema.parse(input);
  return npbPlayerDirectorySchema.parse({ ...old, schemaVersion: 2,
    players: old.players.map((player) => {
      const position = positionCodeSchema.safeParse(player.position).success
        ? positionCodeSchema.parse(player.position) : null;
      return { ...player, position, playerType: position === "P" ? "pitcher" : position ? "fielder" : null,
        birthDate: null, birthPlace: null, nationality: null, bats: null, throws: null,
        recentAvailable: player.battingAvailable || player.pitchingAvailable };
    }) });
}

// Whole-site Pages deployments carry forward a validated directory until the next manual refresh.
export async function preservePublishedNpbPlayerDirectory(path: string, url: string,
  request: typeof fetch = fetch): Promise<"preserved" | "skipped"> {
  try {
    const response = await request(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return "skipped";
    const directory = parsePublishedDirectory(await response.json() as unknown);
    await writeNpbPlayerDirectoryAtomically(path, directory);
    return "preserved";
  } catch { return "skipped"; }
}
