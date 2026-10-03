import { z } from "zod";
export const historicalChronologySchema = z.object({ schemaVersion: z.literal(1), league: z.literal("MLB"),
  season: z.number().int().min(2020).max(2025), competitionType: z.enum(["regular", "postseason"]),
  games: z.array(z.object({ gameId: z.string().regex(/^mlb:game:[0-9a-f-]{36}$/), date: z.iso.date(), number: z.number().int().nonnegative() })),
}).superRefine((p, c) => { if (new Set(p.games.map(g => g.gameId)).size !== p.games.length || p.games.some(g => Number(g.date.slice(0, 4)) !== p.season)) c.addIssue({ code: "custom", message: "Invalid chronology" }); });
export type HistoricalChronology = z.infer<typeof historicalChronologySchema>;
