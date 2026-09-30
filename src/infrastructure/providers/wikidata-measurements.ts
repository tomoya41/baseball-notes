import { z } from "zod";

const claim = z.object({ rank: z.enum(["normal", "preferred", "deprecated"]).optional(),
  mainsnak: z.object({ datavalue: z.object({ value: z.unknown() }).optional() }) });
const entity = z.object({ labels: z.record(z.string(), z.object({ value: z.string() })),
  claims: z.record(z.string(), z.array(claim)) });
export const measurementResponseSchema = z.object({ entities: z.record(z.string(), entity) });
type Entity = z.infer<typeof entity>;
function quantity(e: Entity, property: string, units: Record<string, number>): number | null {
  const claims = (e.claims[property] ?? []).filter(c => c.rank !== "deprecated");
  const preferred = claims.filter(c => c.rank === "preferred");
  const selected = preferred.length ? preferred : claims;
  const values = selected.map(c => {
    const v = z.object({ amount: z.string().regex(/^[+-]?\d+(\.\d+)?$/), unit: z.string() })
      .safeParse(c.mainsnak.datavalue?.value);
    if (!v.success || units[v.data.unit] === undefined) return null;
    const n = Number(v.data.amount) * units[v.data.unit]!;
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  return values.length && values.every(v => v !== null) && new Set(values).size === 1 ? values[0]! : null;
}
// Measurements are claims, not an assertion about a player's present physical condition.
export function readReviewedMeasurements(raw: unknown, mappings: readonly {
  playerId: string; wikidataId: string; name: string; birthDate: string; wikidataTeamId: string;
}[]) {
  const { entities } = measurementResponseSchema.parse(raw);
  return mappings.map(m => {
    const e = entities[m.wikidataId];
    const birthDates = (e?.claims.P569 ?? []).filter(c => c.rank !== "deprecated").map(c => {
      const v = c.mainsnak.datavalue?.value as { time?: string; precision?: number } | undefined;
      return v?.precision === 11 ? /^\+(\d{4}-\d{2}-\d{2})T/.exec(v.time ?? "")?.[1] : null;
    });
    const teams = (e?.claims.P54 ?? []).filter(c => c.rank !== "deprecated").map(c =>
      (c.mainsnak.datavalue?.value as { id?: string } | undefined)?.id);
    if (!e || e.labels.ja?.value !== m.name || new Set(birthDates).size !== 1 || birthDates[0] !== m.birthDate ||
      !teams.includes(m.wikidataTeamId)) throw Error(`Reviewed identity mismatch: ${m.playerId}`);
    return { playerId: m.playerId, heightCm: quantity(e, "P2048", {
      "http://www.wikidata.org/entity/Q174728": 1, "http://www.wikidata.org/entity/Q11573": 100 }),
    weightKg: quantity(e, "P2067", { "http://www.wikidata.org/entity/Q11570": 1 }) };
  });
}
