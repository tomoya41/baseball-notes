import { z } from "zod";
import type { PositionCode } from "../../domain/baseball-terms";

const entityId = z.string().regex(/^Q[1-9]\d*$/);
const claimSchema = z.object({ mainsnak: z.object({ datavalue: z.object({ value: z.unknown() }).optional() }).optional() });
const entitySchema = z.object({ labels: z.record(z.string(), z.object({ value: z.string() })).optional(),
  claims: z.record(z.string(), z.array(claimSchema)).optional() });
const responseSchema = z.object({ entities: z.record(z.string(), entitySchema) });
type Entity = z.infer<typeof entitySchema>;
export type WikidataPlayerProfile = { sourceId: string; name: string; teamIds: string[];
  birthDate: string | null; birthPlace: string | null; nationality: string | null;
  position: PositionCode | null };

function itemIds(entity: Entity, property: string): string[] {
  return (entity.claims?.[property] ?? []).map((claim) =>
    (claim.mainsnak?.datavalue?.value as { id?: unknown } | undefined)?.id)
    .filter((id): id is string => typeof id === "string" && entityId.safeParse(id).success);
}
function dateOfBirth(entity: Entity): string | null {
  const dates = (entity.claims?.P569 ?? []).map((claim) =>
    claim.mainsnak?.datavalue?.value as { time?: unknown; precision?: unknown } | undefined)
    .filter((value) => value?.precision === 11 && typeof value.time === "string")
    .map((value) => /^\+(\d{4}-\d{2}-\d{2})T/.exec(String(value?.time))?.[1])
    .filter((value): value is string => !!value);
  return new Set(dates).size === 1 ? dates[0]! : null;
}

export class WikidataPlayerProfileProvider {
  constructor(private readonly request: typeof fetch = fetch) {}

  private async entities(ids: readonly string[]): Promise<Record<string, Entity>> {
    if (!ids.length) return {};
    ids.forEach((id) => entityId.parse(id));
    const url = new URL("https://www.wikidata.org/w/api.php");
    url.search = new URLSearchParams({ action: "wbgetentities", ids: ids.join("|"),
      props: "labels|claims", languages: "ja|en", format: "json" }).toString();
    const response = await this.request(url, { headers: { Accept: "application/json",
      "User-Agent": "BaseballNotes/0.1 (manual verified player profiles)" } });
    if (!response.ok) throw new Error(`Wikidata HTTP ${response.status}`);
    const body = responseSchema.parse(await response.json() as unknown);
    return body.entities;
  }

  async read(ids: readonly string[]): Promise<WikidataPlayerProfile[]> {
    const entities = await this.entities(ids);
    const labels = await this.entities([...new Set(ids.flatMap((id) => {
      const entity = entities[id];
      if (!entity) throw new Error(`Missing Wikidata entity ${id}`);
      return [...itemIds(entity, "P19"), ...itemIds(entity, "P27")];
    }))]);
    const label = (id: string): string | null => labels[id]?.labels?.ja?.value ?? labels[id]?.labels?.en?.value ?? null;
    return ids.map((id) => {
      const entity = entities[id]!;
      const positionIds = [...new Set(itemIds(entity, "P413"))];
      const positions: Record<string, PositionCode> = { Q1048902: "P", Q1050571: "C" };
      const position = positionIds.length === 1 ? positions[positionIds[0]!] ?? null : null;
      const placeIds = [...new Set(itemIds(entity, "P19"))];
      const nationalityIds = [...new Set(itemIds(entity, "P27"))];
      return { sourceId: id, name: entity.labels?.ja?.value ?? "", teamIds: [...new Set(itemIds(entity, "P54"))],
        birthDate: dateOfBirth(entity), birthPlace: placeIds.length === 1 ? label(placeIds[0]!) : null,
        nationality: nationalityIds.length === 1 ? label(nationalityIds[0]!) : null, position };
    });
  }
}
