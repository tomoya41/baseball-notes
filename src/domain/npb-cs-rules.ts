import { z } from "zod";

/** Reviewed 2026 rules, not evidence of an actual match, standings or advancement. */
export const npbCs2026EvidenceSchema = z.strictObject({
  season: z.literal(2026), leaderTeamId: z.string().min(1), challengerTeamId: z.string().min(1),
  leader: z.strictObject({ wins: z.number().int().nonnegative(), losses: z.number().int().nonnegative() }),
  challenger: z.strictObject({ wins: z.number().int().nonnegative(), losses: z.number().int().nonnegative() }),
  standingsEvidenceUrl: z.url(), observedAt: z.iso.datetime(),
}).refine(e=>e.leaderTeamId!==e.challengerTeamId && e.challenger.wins+e.challenger.losses>0 && e.leader.wins+e.leader.losses>0 && e.leader.wins-e.challenger.wins+e.challenger.losses-e.leader.losses>=0,"Independent final standings required");
export type NpbCs2026Evidence=z.infer<typeof npbCs2026EvidenceSchema>;
export function npbCs2026FinalRule(input:unknown) {
  const e=npbCs2026EvidenceSchema.parse(input);
  const gapTwice=e.leader.wins-e.challenger.wins+e.challenger.losses-e.leader.losses;
  const reasons=[...(gapTwice>=20?["gap_at_least_10" as const]:[]),...(e.challenger.wins<e.challenger.losses?["challenger_below_500" as const]:[])];
  return {advantageWins:reasons.length?2:1,maxPlayedGames:reasons.length?7:6,winsRequired:reasons.length?5:4,reasons,
    rulesUrl:"https://npb.jp/games/2026/info_cs.html"};
}
