import { z } from "zod";
import { readNpbProfileSupplements, type NpbProfileBridge } from "./wikidata-npb-profile-supplement";
import { profileRegistrySchema, type ProfileRegistryEntry, type ProfileField } from "../../domain/npb-profile-registry";

const snak = z.object({ datavalue: z.object({ value: z.unknown() }).optional() });
const claim = z.object({ rank: z.enum(["normal", "preferred", "deprecated"]).optional(), mainsnak: snak,
  qualifiers: z.record(z.string(), z.array(snak)).optional() });
const response = z.object({ entities: z.record(z.string(), z.object({ claims: z.record(z.string(), z.array(claim)) })) });
const labelResponse = z.object({ entities: z.record(z.string(), z.object({ labels: z.record(z.string(), z.object({ value: z.string() })) })) });
type Claim = z.infer<typeof claim>;
const entityId = (value: unknown) => z.object({ id: z.string().regex(/^Q\d+$/) }).safeParse(value).data?.id;
function usable(cs: Claim[] = [], all = false) {
  const rows = cs.filter(c => c.rank !== "deprecated"), preferred = rows.filter(c => c.rank === "preferred");
  return !all && preferred.length ? preferred : rows;
}
function period(value: unknown) {
  const r = z.object({ time: z.string(), precision: z.number().int() }).safeParse(value);
  if (!r.success || ![9, 10, 11].includes(r.data.precision)) return null;
  const date = /^\+(\d{4}-\d{2}-\d{2})T/.exec(r.data.time)?.[1];
  return date ? date.slice(0, r.data.precision === 9 ? 4 : r.data.precision === 10 ? 7 : 10) : null;
}
// CC0 structured values only. Exact P4260 identity is mandatory; P18/photos and article content are excluded.
export function readNpbProfileRegistry(raw: unknown, rawLabels: unknown, bridges: readonly NpbProfileBridge[], observedAt: string,
  canonicalTeams: Readonly<Record<string, string>>) {
  const basic = readNpbProfileSupplements(raw, rawLabels, bridges, observedAt);
  const entities = response.parse(raw).entities, labels = labelResponse.parse(rawLabels).entities;
  const entries: ProfileRegistryEntry[] = [], rejected: { playerId: string; field: string; reason: string; values: unknown[] }[] = [];
  const label = (id: string | undefined) => id ? labels[id]?.labels.ja?.value ?? null : null;
  for (const b of bridges) {
    const e = entities[b.wikidataId]!, p = basic.players.find(p => p.playerId === b.playerId)!;
    const add = (field: ProfileField, value: unknown, notes = "Structured CC0 claim; source-verified by Codex, not human-reviewed") => {
      if (value == null || (Array.isArray(value) && !value.length)) return;
      entries.push({ playerId: b.playerId, field, value, sourceName: "Wikidata", sourceUrl: `https://www.wikidata.org/wiki/${b.wikidataId}`,
        license: "CC0", rightsEvidenceUrl: "https://www.wikidata.org/wiki/Wikidata:Licensing", publicReuseAllowed: true,
        verifiedAt: observedAt, effectiveFrom: null, effectiveTo: null, verificationStatus: "source_verified", reviewer: "Codex",
        notes, additionalSourceUrls: [] });
    };
    for (const field of ["position", "birthDate", "birthPlace", "nationality", "heightCm", "weightKg"] as const) add(field, p[field]);
    for (const [field, property] of [["heightCm", "P2048"], ["weightKg", "P2067"], ["birthDate", "P569"], ["nationality", "P27"]] as const)
      if (p[field] === null && usable(e.claims[property]).length) {
        rejected.push({ playerId: b.playerId, field, reason: "conflicting_or_insufficient_claim", values: usable(e.claims[property]).map(c => c.mainsnak.datavalue?.value ?? null) });
        // Preserve every valid competing value. A second source cannot silently resolve source conflicts.
        for (const c of usable(e.claims[property])) {
          const value = c.mainsnak.datavalue?.value;
          if (field === "heightCm" || field === "weightKg") {
            const q = z.object({ amount: z.string(), unit: z.string() }).safeParse(value);
            const units: Record<string, number> = field === "heightCm" ? { "http://www.wikidata.org/entity/Q174728": 1, "http://www.wikidata.org/entity/Q11573": 100 } : { "http://www.wikidata.org/entity/Q11570": 1 };
            if (q.success && units[q.data.unit] !== undefined && Number(q.data.amount) > 0) add(field, Number(q.data.amount) * units[q.data.unit]!);
          } else if (field === "birthDate") { const date = period(value); if (date?.length === 10) add(field, date); }
          else add(field, label(entityId(value)));
        }
      }
    const positions = [...new Set(usable(e.claims.P413, true).map(c => label(entityId(c.mainsnak.datavalue?.value))).filter((v): v is string => v !== null))];
    add("knownPositions", positions, "Source-listed positions; multiple positions do not imply a primary position");
    add("schools", [...new Set(usable(e.claims.P69, true).map(c => label(entityId(c.mainsnak.datavalue?.value))).filter((v): v is string => v !== null))],
      "Educated-at facts; graduation/date/order are not inferred");
    const affiliations = usable(e.claims.P54, true).flatMap(c => {
      const id = entityId(c.mainsnak.datavalue?.value), name = label(id); if (!name) return [];
      const qualifier = (key: string) => c.qualifiers?.[key];
      const time = (key: string) => {
        const values = (qualifier(key) ?? []).map(q => period(q.datavalue?.value));
        return values.length === 1 ? values[0]! : null;
      };
      const jerseys = (qualifier("P1618") ?? []).map(q => q.datavalue?.value);
      return [{ name, teamId: id ? canonicalTeams[id] ?? null : null, from: time("P580"), to: time("P582"),
        uniformNumber: jerseys.length === 1 && typeof jerseys[0] === "string" && /^\d{1,3}$/.test(jerseys[0]) ? jerseys[0] : null }];
    });
    add("affiliations", [...new Map(affiliations.map(a => [JSON.stringify(a), a])).values()],
      "Partial affiliated-team history. Missing end does not establish current membership; no chronology is inferred");
    const drafts = usable(e.claims.P647);
    if (drafts.length === 1) {
      const d = drafts[0]!, team = entityId(d.mainsnak.datavalue?.value);
      if (team && canonicalTeams[team]) add("draftTeamId", canonicalTeams[team]);
      const rounds = d.qualifiers?.P1836?.map(q => q.datavalue?.value) ?? [];
      if (rounds.length === 1 && typeof rounds[0] === "string" && /^\d+$/.test(rounds[0])) add("draftRound", `${rounds[0]}位`);
      const events = d.qualifiers?.P793?.map(q => entityId(q.datavalue?.value)).filter((v): v is string => !!v) ?? [];
      if (events.length === 1) {
        const dates = usable(entities[events[0]!] ?.claims.P585).map(c => period(c.mainsnak.datavalue?.value));
        if (dates.length === 1 && dates[0]) add("draftYear", Number(dates[0].slice(0, 4)));
      }
    }
  }
  return { registry: profileRegistrySchema.parse({ schemaVersion: 1, observedAt, entries }), rejected };
}
