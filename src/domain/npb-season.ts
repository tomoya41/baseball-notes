import { z } from "zod";

export const npbSeasonMetadataSchema = z.strictObject({
  league: z.literal("NPB"),
  season: z.number().int().min(1936),
  competitionType: z.enum(["regular", "preseason", "postseason", "farm"]),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  endDateStatus: z.enum(["scheduled", "final"]),
  status: z.enum(["scheduled", "in_progress", "completed"]),
  source: z.array(z.url()).min(1),
  verificationMethod: z.string().min(1),
  verifiedAt: z.iso.datetime(),
  notes: z.string(),
}).refine((value) => value.startDate <= value.endDate, "Season end precedes start");

export type NpbSeasonMetadata = z.infer<typeof npbSeasonMetadataSchema>;

export type FactAvailability = { firstFactDate: string | null; lastFactDate: string | null };
