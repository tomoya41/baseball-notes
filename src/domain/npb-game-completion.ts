import { z } from "zod";

// Independent source evidence, never reverse engineered from pitcher Fact totals.
export const shortenedFinalEvidenceSchema = z.object({
  gameId: z.string().min(1), provider: z.literal("nf3"),
  observedStatus: z.literal("officially_shortened_final"),
  observedFinalInning: z.number().int().min(5).max(99),
  // Optional explicit source ending, supplied together. A half can begin without
  // another recorded out; never infer these from pitcher totals or decrement inning.
  endingHalf: z.enum(["top","bottom"]).optional(),
  endingOuts: z.number().int().min(0).max(3).optional(),
  homeTeamId: z.string().min(1), awayTeamId: z.string().min(1),
  homeScore: z.number().int().nonnegative(), awayScore: z.number().int().nonnegative(),
  // These must be supplied by the source's explicit ending/line score, not Facts.
  homePitchingOuts: z.number().int().nonnegative(), awayPitchingOuts: z.number().int().nonnegative(),
  sourceUrl: z.url().refine(u=>new URL(u).hostname==="nf3.sakura.ne.jp"),
  verifiedAt: z.iso.datetime(),
}).refine(e=>e.homeTeamId!==e.awayTeamId,{message:"Distinct canonical teams required"})
  .refine(e=>(e.endingHalf===undefined)===(e.endingOuts===undefined),{message:"Explicit ending half and outs must be supplied together"});
export type ShortenedFinalEvidence = z.infer<typeof shortenedFinalEvidenceSchema>;
