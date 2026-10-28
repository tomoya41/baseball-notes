import { z } from "zod";
import type { Honor, HonorRecipient } from "./player-honors";

export type HonorLeague = "NPB" | "MLB";
export function isHonorRecipientId(league: HonorLeague, id: string) {
  return league === "NPB" ? /^npb:\d{6,12}$/.test(id) : /^lahman:[a-z0-9]{3,20}$/.test(id);
}

/** A routing bucket, never a new canonical identity or name-based join. */
export function honorRecipientBucket(id: string) {
  let hash = 2166136261;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).slice(-2).padStart(2, "0");
}

const award = z.strictObject({ id: z.string().regex(/^[a-z0-9_-]+$/), name: z.string().min(1) });
export const honorCatalogSchema = z.strictObject({
  schemaVersion: z.literal(1), league: z.enum(["NPB", "MLB"]), coverage: z.literal("partial"),
  awards: z.array(award),
  players: z.array(z.strictObject({
    id: z.string(), name: z.string().min(1), identityStatus: z.enum(["verified", "unresolved"]),
    playerId: z.string().nullable(), years: z.array(z.number().int().min(1871).max(2025)).min(1),
    awardIds: z.array(z.string()).min(1), total: z.number().int().positive(),
  })).max(20_000),
}).superRefine((d, c) => {
  const awards = new Set(d.awards.map(a => a.id));
  if (awards.size !== d.awards.length || new Set(d.players.map(p => p.id)).size !== d.players.length ||
      d.players.some(p => !isHonorRecipientId(d.league, p.id) || new Set(p.years).size !== p.years.length ||
        p.years.some(y => d.league === "NPB" && y < 1936) ||
        new Set(p.awardIds).size !== p.awardIds.length || p.awardIds.some(id => !awards.has(id)) ||
        p.total < p.years.length || p.total < p.awardIds.length ||
        p.playerId !== null && (p.identityStatus !== "verified" ||
          !z.uuid().safeParse(p.playerId.replace(/^mlb:player:/, "")).success ||
          (d.league === "MLB") !== p.playerId.startsWith("mlb:player:"))))
    c.addIssue({ code: "custom", message: "Honor catalog identity/year/reference mismatch" });
});
export type HonorCatalog = z.infer<typeof honorCatalogSchema>;

export function buildHonorCatalog(league: HonorLeague, records: readonly Honor[], recipients: readonly HonorRecipient[]): HonorCatalog {
  const rows = records.filter(r => r.league === league), ids = new Set(rows.map(r => r.recipientId));
  const byId = new Map(recipients.map(p => [p.id, p]));
  if (byId.size !== recipients.length || [...ids].some(id => !byId.has(id))) throw Error("Missing or duplicate honor recipient");
  return honorCatalogSchema.parse({ schemaVersion: 1, league, coverage: "partial",
    awards: [...new Map(rows.map(r => [r.awardId, { id: r.awardId, name: r.name }])).values()],
    players: [...ids].sort().map(id => {
      const p = byId.get(id)!, own = rows.filter(r => r.recipientId === id);
      return { id, name: p.name, identityStatus: p.identityStatus ?? "unresolved",
        playerId: p.links.find(l => l.league === league)?.playerId ?? null,
        years: [...new Set(own.map(r => r.year))].sort((a, b) => b - a),
        awardIds: [...new Set(own.map(r => r.awardId))], total: own.length };
    }),
  });
}

export function honorRecipientPath(league: HonorLeague, id: string) {
  if (!isHonorRecipientId(league, id)) throw Error("Invalid honor recipient");
  return `/${league}/awards?${new URLSearchParams({ recipient: id })}`;
}
