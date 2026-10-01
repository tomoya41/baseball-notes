import { z } from "zod";
import { positionCodeSchema } from "./baseball-terms";
// Internal review registry. It is projected into the existing source-neutral public contracts.
export const reviewedProfileSupplementSchema = z.strictObject({ observedAt: z.iso.datetime(),
  players: z.array(z.strictObject({ playerId: z.uuid(), position: positionCodeSchema.nullable(),
    birthDate: z.iso.date().nullable(), birthPlace: z.string().nullable(), nationality: z.string().nullable(),
    heightCm: z.number().positive().nullable(), weightKg: z.number().positive().nullable() }))
}).refine(v => new Set(v.players.map(p => p.playerId)).size === v.players.length, "Duplicate reviewed identity");
export type ReviewedProfileSupplement = z.infer<typeof reviewedProfileSupplementSchema>;
