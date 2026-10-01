import { z } from "zod";
import { positionCodeSchema } from "../../domain/baseball-terms";
import { reviewedProfileSupplementSchema } from "../../domain/npb-reviewed-profile";

const claimSchema = z.object({ rank: z.enum(["normal", "preferred", "deprecated"]).optional(),
  mainsnak: z.object({ datavalue: z.object({ value: z.unknown() }).optional() }) });
const responseSchema = z.object({ entities: z.record(z.string(), z.object({
  claims: z.record(z.string(), z.array(claimSchema)) })) });
const labelsSchema = z.object({ entities: z.record(z.string(), z.object({
  labels: z.record(z.string(), z.object({ value: z.string() })) })) });
export type NpbProfileBridge = { playerId: string; wikidataId: string; npbId: string };
type Claim = z.infer<typeof claimSchema>;
function values(claims: Claim[] = []) {
  const usable = claims.filter(c => c.rank !== "deprecated");
  const preferred = usable.filter(c => c.rank === "preferred");
  return (preferred.length ? preferred : usable).map(c => c.mainsnak.datavalue?.value);
}
function unique<T>(items: (T | null)[]): T | null {
  return items.length && items.every(v => v !== null) && new Set(items).size === 1 ? items[0]! : null;
}
// A reviewed canonical -> NPB ID bridge is required. Labels/names never establish identity.
// This reads structured CC0 claims only; it does not fetch NPB pages, images or article text.
export function readNpbProfileSupplements(raw: unknown, rawLabels: unknown, bridges: readonly NpbProfileBridge[], observedAt: string) {
  const { entities } = responseSchema.parse(raw), labels = labelsSchema.parse(rawLabels).entities;
  if (new Set(bridges.map(b => b.playerId)).size !== bridges.length ||
      new Set(bridges.map(b => b.npbId)).size !== bridges.length ||
      new Set(bridges.map(b => b.wikidataId)).size !== bridges.length) throw Error("Ambiguous reviewed identity bridge");
  const label = (v: unknown) => {
    const item = z.object({ id: z.string() }).safeParse(v);
    return item.success ? labels[item.data.id]?.labels.ja?.value ?? null : null;
  };
  const quantity = (claims: Claim[] | undefined, units: Record<string, number>) => unique(values(claims).map(v => {
    const q = z.object({ amount: z.string().regex(/^[+-]?\d+(\.\d+)?$/), unit: z.string() }).safeParse(v);
    if (!q.success || units[q.data.unit] === undefined) return null;
    const number = Number(q.data.amount) * units[q.data.unit]!;
    return Number.isFinite(number) && number > 0 ? number : null;
  }));
  return reviewedProfileSupplementSchema.parse({ observedAt, players: bridges.map(b => {
    z.uuid().parse(b.playerId);
    z.string().regex(/^\d{8}$/).parse(b.npbId); z.string().regex(/^Q\d+$/).parse(b.wikidataId);
    const e = entities[b.wikidataId];
    const matches = Object.entries(entities).filter(([, item]) => values(item.claims.P4260).includes(b.npbId));
    if (!e || unique(values(e.claims.P4260).map(v => typeof v === "string" ? v : null)) !== b.npbId ||
        matches.length !== 1 || matches[0]?.[0] !== b.wikidataId) throw Error(`NPB external-ID identity mismatch: ${b.playerId}`);
    const positions: Record<string, z.infer<typeof positionCodeSchema>> = { Q1048902: "P", Q1050571: "C", Q1142885: "OF" };
    return { playerId: b.playerId,
      position: unique(values(e.claims.P413).map(v => {
        const p = z.object({ id: z.string() }).safeParse(v); return p.success ? positions[p.data.id] ?? null : null;
      })),
      birthDate: unique(values(e.claims.P569).map(v => {
        const t = z.object({ precision: z.number(), time: z.string() }).safeParse(v);
        const date = t.success && t.data.precision === 11 ? /^\+(\d{4}-\d{2}-\d{2})T/.exec(t.data.time)?.[1] : null;
        const checked = z.iso.date().safeParse(date); return checked.success ? checked.data : null;
      })),
      birthPlace: unique(values(e.claims.P19).map(label)), nationality: unique(values(e.claims.P27).map(label)),
      heightCm: quantity(e.claims.P2048, { "http://www.wikidata.org/entity/Q174728": 1, "http://www.wikidata.org/entity/Q11573": 100 }),
      weightKg: quantity(e.claims.P2067, { "http://www.wikidata.org/entity/Q11570": 1 }) };
  }) });
}
