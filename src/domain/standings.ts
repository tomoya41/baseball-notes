import { z } from "zod";
import { leagueSchema, timestampSchema } from "./models";

const date = z.iso.date();
const count = z.number().int().nonnegative();

export const gameFactSchema = z.object({
  id: z.string().min(1),
  league: leagueSchema,
  season: z.number().int().min(1871),
  playedOn: date,
  completedOn: date,
  homeTeamId: z.string().min(1),
  awayTeamId: z.string().min(1),
  homeRuns: count,
  awayRuns: count,
  sourceKey: z.string().min(1),
  sourceRecordId: z.string().min(1),
  sourceUrl: z.url(),
  collectedAt: timestampSchema,
}).refine((game) => game.homeTeamId !== game.awayTeamId, "Same home and away team");
export type GameFact = z.infer<typeof gameFactSchema>;

export const standingSchema = z.object({
  date,
  season: z.number().int().min(1871),
  league: leagueSchema,
  competitionGroup: z.string().min(1),
  teamId: z.string().min(1),
  rank: z.number().int().positive(),
  wins: count,
  losses: count,
  ties: count,
  gamesPlayed: count,
  pct: z.number().min(0).max(1),
  gamesBehindLeader: z.number().nonnegative(),
  streak: z.number().int(),
  sourceKey: z.string().min(1),
  collectedAt: timestampSchema,
  calculatedAt: timestampSchema,
}).refine((row) => row.wins + row.losses + row.ties === row.gamesPlayed, "Invalid games played");
export type Standing = z.infer<typeof standingSchema>;

export const standingsPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  league: leagueSchema,
  season: z.number().int(),
  throughDate: date,
  calculatedAt: timestampSchema,
  sourceKey: z.string().min(1),
  attribution: z.string().min(1),
  status: z.literal("historical"),
  standings: z.array(standingSchema),
}).superRefine((payload, context) => {
  const keys = new Set<string>();
  for (const row of payload.standings) {
    if (row.date !== payload.throughDate || row.season !== payload.season || row.league !== payload.league || row.sourceKey !== payload.sourceKey)
      context.addIssue({ code: "custom", message: "Snapshot identity mismatch" });
    const key = `${row.competitionGroup}:${row.teamId}`;
    if (keys.has(key)) context.addIssue({ code: "custom", message: "Duplicate standing" });
    keys.add(key);
  }
});
export type StandingsPayload = z.infer<typeof standingsPayloadSchema>;

export interface StandingsRepository {
  findByDate(league: "MLB" | "NPB", date: string): Promise<Standing[]>;
}

export const npbLatestStandingsSchema = z.object({
  schemaVersion: z.literal(1), league: z.literal("NPB"), throughDate: date,
  effectiveDate: date, generatedAt: timestampSchema, collectedAt: timestampSchema,
  sourceUpdatedAt: timestampSchema.nullable(), sourceKey: z.literal("nf3"),
  attribution: z.string().min(1),
  teams: z.record(z.string(), z.object({ name: z.string(), short: z.string() })),
  standings: z.array(standingSchema).length(12),
}).superRefine((payload, context) => {
  if (payload.effectiveDate !== payload.throughDate)
    context.addIssue({ code: "custom", message: "Effective date mismatch" });
  const seen = new Set<string>();
  for (const group of ["Central", "Pacific"]) {
    const rows = payload.standings.filter((row) => row.competitionGroup === group);
    if (rows.length !== 6 || new Set(rows.map((row) => row.rank)).size !== 6)
      context.addIssue({ code: "custom", message: `Invalid ${group} standings` });
    for (const row of rows) {
      if (row.date !== payload.throughDate || row.league !== "NPB" || row.sourceKey !== "nf3" || !payload.teams[row.teamId] || seen.has(row.teamId))
        context.addIssue({ code: "custom", message: "Standings identity mismatch" });
      seen.add(row.teamId);
    }
  }
});
export type NpbLatestStandings = z.infer<typeof npbLatestStandingsSchema>;
