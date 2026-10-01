import { z } from "zod";
import { coverageSchema } from "./npb-product-contract";

// App-defined season checkpoints, not official titles or career achievements.
export const seasonCheckpointSteps = { H: 50, HR: 10, RBI: 50, SB: 10, SO: 50, W: 5, SV: 10, HLD: 10 } as const;
export const seasonCheckpointLabels: Record<keyof typeof seasonCheckpointSteps, string> = {
  H: "安打", HR: "本塁打", RBI: "打点", SB: "盗塁", SO: "奪三振", W: "勝利", SV: "セーブ", HLD: "ホールド",
};
const checkpointSchema = z.strictObject({ role: z.enum(["batting", "pitching"]),
  metric: z.enum(["H", "HR", "RBI", "SB", "SO", "W", "SV", "HLD"]),
  count: z.number().int().nonnegative(), previousCheckpoint: z.number().int().nonnegative(),
  nextCheckpoint: z.number().int().positive() }).superRefine((v, ctx) => {
    const batting = ["H", "HR", "RBI", "SB"].includes(v.metric), step = seasonCheckpointSteps[v.metric];
    if ((v.role === "batting") !== batting || v.previousCheckpoint !== Math.floor(v.count / step) * step ||
        v.nextCheckpoint !== v.previousCheckpoint + step)
      ctx.addIssue({ code: "custom", message: "Invalid season checkpoint" });
  });
export const npbSeasonMilestonesSchema = z.strictObject({ schemaVersion: z.literal(1), league: z.literal("NPB"),
  season: z.number().int().min(1936), effectiveDate: z.iso.date(), generatedAt: z.iso.datetime(),
  period: z.strictObject({ from: z.iso.date(), to: z.iso.date() }),
  scope: z.literal("stored_regular_season_facts"), careerAvailable: z.literal(false),
  coverage: coverageSchema,
  players: z.array(z.strictObject({ playerId: z.uuid(), displayName: z.string().min(1), teamId: z.string().nullable(), teamName: z.string().nullable(),
    checkpoints: z.array(checkpointSchema).min(1) }))
}).superRefine((v, ctx) => {
  if (v.period.to !== v.effectiveDate || v.period.from > v.period.to ||
      Number(v.period.from.slice(0, 4)) !== v.season || Number(v.period.to.slice(0, 4)) !== v.season ||
      new Set(v.players.map(p => p.playerId)).size !== v.players.length)
    ctx.addIssue({ code: "custom", message: "Invalid milestone identity/window" });
  const s = v.coverage.summary;
  if (s.dates !== s.complete + s.noGames + s.partial + s.unknown + s.failed ||
      (v.coverage.status === "complete" && s.partial + s.unknown + s.failed !== 0))
    ctx.addIssue({ code: "custom", message: "Invalid milestone coverage" });
  for (const p of v.players) if (new Set(p.checkpoints.map(c => c.metric)).size !== p.checkpoints.length)
    ctx.addIssue({ code: "custom", message: "Duplicate metric checkpoint" });
});
export type NpbSeasonMilestones = z.infer<typeof npbSeasonMilestonesSchema>;
