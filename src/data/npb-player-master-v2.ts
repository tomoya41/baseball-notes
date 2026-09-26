import type { InStatement } from "@libsql/client";
import type { DataClient } from "./database";
import { normalizePlayerSearch } from "../domain/npb-player-directory";
import { verifiedPlayerMappings, profileVerificationAt } from "./npb-verified-player-mappings";
import type { WikidataPlayerProfile } from "../infrastructure/providers/wikidata-player-profile-provider";

type Existing = { id: string; validFrom: string; sourceKey: string; payload: Record<string, unknown>;
  sourceRecordId?: string; collectedAt?: string };
type FieldSource = { source: "wikidata" | "nf3"; sourceId: string; verifiedAt: string };
type StoredProfile = { birthDate: string | null; birthPlace: string | null; nationality: string | null;
  position: string | null; bats: null; throws: null; provenance: Record<string, FieldSource> };

export class ProfileIdentityError extends Error {}

export function prepareVerifiedPlayerImport(masters: readonly Existing[], mappings: readonly {
  sourceKey: string; sourceId: string; playerId: string }[], profiles: readonly WikidataPlayerProfile[]) {
  const byId = new Map(masters.map((row) => [row.id, row]));
  const bySource = new Map(mappings.map((row) => [`${row.sourceKey}:${row.sourceId}`, row.playerId]));
  const byProfile = new Map(profiles.map((profile) => [profile.sourceId, profile]));
  if (byProfile.size !== profiles.length) throw new ProfileIdentityError("Duplicate Wikidata profile");
  const statements: InStatement[] = [];
  let newPlayers = 0;
  let updatedPlayers = 0;
  for (const link of verifiedPlayerMappings) {
    const external = byProfile.get(link.wikidataId);
    if (!external || normalizePlayerSearch(external.name) !== normalizePlayerSearch(link.name) ||
      external.birthDate !== link.birthDate || external.teamIds.length !== 1 ||
      external.teamIds[0] !== link.wikidataTeamId ||
      external.birthPlace !== link.expectedBirthPlace || external.nationality !== link.expectedNationality ||
      external.position !== link.expectedPosition)
      throw new ProfileIdentityError(`Unresolved external identity: ${link.wikidataId}`);
    const mappedId = bySource.get(`wikidata:${link.wikidataId}`);
    if (mappedId && mappedId !== link.playerId)
      throw new ProfileIdentityError(`Conflicting source mapping: ${link.wikidataId}`);
    const existing = byId.get(link.playerId);
    if (!existing && !link.newPlayer) throw new ProfileIdentityError(`Missing canonical player: ${link.playerId}`);
    if (!existing && masters.some((row) => normalizePlayerSearch(String(row.payload.name ?? "")) === normalizePlayerSearch(link.name)))
      throw new ProfileIdentityError(`Ambiguous same-name player: ${link.name}`);
    if (existing && (normalizePlayerSearch(String(existing.payload.name ?? "")) !== normalizePlayerSearch(link.name) ||
      existing.payload.teamId !== link.teamId))
      throw new ProfileIdentityError(`Canonical identity conflict: ${link.name}`);
    if (existing?.payload.position && external.position && existing.payload.position !== external.position)
      throw new ProfileIdentityError(`Position conflict: ${link.name}`);
    if (existing?.validFrom === profileVerificationAt.slice(0, 10) && existing.sourceKey !== "wikidata")
      throw new ProfileIdentityError(`Same-day master conflict: ${link.name}`);
    const provenance: Record<string, FieldSource> = {};
    const source: FieldSource = { source: "wikidata", sourceId: link.wikidataId, verifiedAt: profileVerificationAt };
    const oldProvenance = (existing?.payload.profile as { provenance?: Record<string, FieldSource> } | undefined)?.provenance;
    for (const field of ["name", "teamId"] as const) {
      if (oldProvenance?.[field]) provenance[field] = oldProvenance[field];
      else if (existing?.sourceKey === "nf3" && existing.sourceRecordId && existing.collectedAt)
        provenance[field] = { source: "nf3", sourceId: existing.sourceRecordId, verifiedAt: existing.collectedAt };
      else if (!existing) provenance[field] = source;
    }
    for (const field of ["birthDate", "birthPlace", "nationality", "position"] as const)
      if (external[field] !== null) provenance[field] = source;
    const profile: StoredProfile = { birthDate: external.birthDate, birthPlace: external.birthPlace,
      nationality: external.nationality, position: external.position, bats: null, throws: null, provenance };
    const payload = { ...(existing?.payload ?? {}), name: link.name, teamId: link.teamId,
      position: existing?.payload.position ?? external.position, profile };
    if (!mappedId) statements.push({ sql: `INSERT INTO source_entity_mappings
      (source_key,entity_kind,source_entity_id,internal_entity_id,source_url,first_seen,last_seen)
      VALUES ('wikidata','player',?,?,?,?,?)`, args: [link.wikidataId, link.playerId,
        `https://www.wikidata.org/wiki/${link.wikidataId}`, profileVerificationAt, profileVerificationAt] });
    statements.push({ sql: `INSERT INTO master_history
      (entity_kind,entity_id,valid_from,payload_json,source_key,source_record_id,collected_at)
      VALUES ('player',?,?,?,?,?,?)
      ON CONFLICT(entity_kind,entity_id,valid_from) DO UPDATE SET
      payload_json=excluded.payload_json,collected_at=excluded.collected_at
      WHERE master_history.source_key='wikidata'`,
      args: [link.playerId, profileVerificationAt.slice(0, 10), JSON.stringify(payload),
        "wikidata", link.wikidataId, profileVerificationAt] });
    if (existing) updatedPlayers++; else newPlayers++;
  }
  return { statements, newPlayers, updatedPlayers };
}

export class NpbPlayerMasterV2Importer {
  constructor(private readonly client: DataClient) {}

  async import(profiles: readonly WikidataPlayerProfile[], dryRun = true) {
    const [masters, mappings] = await Promise.all([
      this.client.execute(`SELECT entity_id,valid_from,payload_json,source_key,source_record_id,collected_at FROM
        (SELECT entity_id,valid_from,payload_json,source_key,source_record_id,collected_at,ROW_NUMBER() OVER
        (PARTITION BY entity_id ORDER BY valid_from DESC) AS ordinal
        FROM master_history WHERE entity_kind='player') WHERE ordinal=1`),
      this.client.execute("SELECT source_key,source_entity_id,internal_entity_id FROM source_entity_mappings WHERE entity_kind='player' AND source_key='wikidata'"),
    ]);
    const current = masters.rows.map((row) => ({ id: String(row.entity_id), validFrom: String(row.valid_from),
      sourceKey: String(row.source_key), sourceRecordId: String(row.source_record_id),
      collectedAt: String(row.collected_at), payload: JSON.parse(String(row.payload_json)) as Record<string, unknown> }));
    const mapped = mappings.rows.map((row) => ({ sourceKey: String(row.source_key), sourceId: String(row.source_entity_id),
      playerId: String(row.internal_entity_id) }));
    const plan = prepareVerifiedPlayerImport(current, mapped, profiles);
    if (!dryRun) await this.client.batch(plan.statements, "write");
    return { existingPlayers: current.length, ...plan, dryRun };
  }
}
