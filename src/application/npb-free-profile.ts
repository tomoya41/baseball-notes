import { isDeepStrictEqual } from "node:util";
import { eligibleProfileEntries, profileRegistrySchema, type ProfileRegistry, type ProfileField } from "../domain/npb-profile-registry";
import { npbPlayerDirectorySchema, type NpbPlayerDirectory } from "../domain/npb-player-directory";
import { npbCatalogSchema, type NpbCatalog } from "../domain/npb-product-contract";
import { positionDefinitions, type PositionCode } from "../domain/baseball-terms";

export type ProfileConflict = { playerId: string; field: ProfileField; existing: unknown; incoming: unknown; reason: string };
// These fields describe sets; their source order does not imply chronology or priority.
const comparableValue = (field: ProfileField, value: unknown) => field === "knownPositions" || field === "schools"
  ? [...new Set(value as string[])].sort() : value;
const sameValue = (field: ProfileField, left: unknown, right: unknown) =>
  isDeepStrictEqual(comparableValue(field, left), comparableValue(field, right));
// Generic infield/outfield labels support their explicit positions without choosing one.
const positionSupported = (position: PositionCode, listed: string[]) => listed.some(label =>
  label === positionDefinitions[position] ||
  (["1B", "2B", "3B", "SS"].includes(position) && label === "内野手") ||
  (["LF", "CF", "RF"].includes(position) && label === "外野手") ||
  (position === "OF" && ["左翼手", "中堅手", "右翼手"].includes(label)));
export function applyNpbProfileRegistry(directory: NpbPlayerDirectory, catalog: NpbCatalog, raw: unknown) {
  const registry: ProfileRegistry = profileRegistrySchema.parse(raw), conflicts: ProfileConflict[] = [];
  const nextDirectory = structuredClone(directory), nextCatalog = structuredClone(catalog);
  const players = new Map(nextDirectory.players.map(p => [p.playerId, p]));
  const catalogPlayers = new Map(nextCatalog.players.map(p => [p.playerId, p]));
  const groups = new Map<string, ReturnType<typeof eligibleProfileEntries>>();
  for (const entry of eligibleProfileEntries(registry, directory.effectiveDate)) {
    const key = `${entry.playerId}:${entry.field}`; groups.set(key, [...groups.get(key) ?? [], entry]);
  }
  for (const entries of groups.values()) {
    const e = entries[0]!, p = players.get(e.playerId), c = catalogPlayers.get(e.playerId); if (!p || !c) continue;
    if (entries.some(v => !sameValue(e.field, v.value, e.value))) {
      conflicts.push({ playerId: e.playerId, field: e.field, existing: null, incoming: entries.map(v => v.value), reason: "competing_source_values" }); continue;
    }
    const field = e.field;
    if (field === "position" && p.playerType !== null && p.playerType !== (e.value === "P" ? "pitcher" : "fielder")) {
      conflicts.push({ playerId: e.playerId, field, existing: { position: p.position, playerType: p.playerType },
        incoming: e.value, reason: "known_player_type_conflict" }); continue;
    }
    // Check ALL eligible evidence, including lists that disagree with each other. A
    // conflict in knownPositions must not let a contradictory primary position through.
    const primary = groups.get(`${e.playerId}:position`) ?? [];
    const listed = groups.get(`${e.playerId}:knownPositions`) ?? [];
    const knownPosition = c.profile.position;
    const knownList = c.profile.knownPositions;
    if ((field === "position" && [...listed.map(v => v.value as string[]), ...(knownList?.length ? [knownList] : [])]
      .some(v => !positionSupported(e.value as PositionCode, v))) ||
      (field === "knownPositions" && [...primary.map(v => v.value as PositionCode), ...(knownPosition ? [knownPosition] : [])]
        .some(v => !positionSupported(v, e.value as string[])))) {
      conflicts.push({ playerId: e.playerId, field, existing: Reflect.get(c.profile, field) ?? null,
        incoming: [...primary, ...listed].map(v => ({ field: v.field, value: v.value })), reason: "cross_field_position_conflict" }); continue;
    }
    const target = field === "uniformNumber" || field === "registrationClass" ? c.membership : c.profile;
    const existing = Reflect.get(target, field === "affiliations" ? "affiliations" : field);
    c.profile.identityLinked = true;
    const recordCredits = () => {
      for (const source of entries) if (["CC-BY-SA-4.0", "CC-BY-4.0", "ODC-BY-1.0"].includes(source.license)) {
        const credits = c.profile.credits ??= [], existingCredit = credits.find(v => v.url === source.sourceUrl);
        if (existingCredit) { if (!existingCredit.fields.includes(field)) existingCredit.fields.push(field); }
        else credits.push({ name: source.sourceName, url: source.sourceUrl, licenseUrl: source.license === "ODC-BY-1.0" ?
          "https://opendatacommons.org/licenses/by/1-0/" : source.license === "CC-BY-SA-4.0" ?
          "https://creativecommons.org/licenses/by-sa/4.0/" : "https://creativecommons.org/licenses/by/4.0/", fields: [field], modified: true });
      }
    };
    if (existing != null && !(Array.isArray(existing) && existing.length === 0)) {
      if (!sameValue(field, existing, e.value)) conflicts.push({ playerId: e.playerId, field, existing, incoming: e.value, reason: "known_value_preserved" });
      else recordCredits();
      continue;
    }
    if ((field === "draftTeamId" || field === "affiliations") &&
      (field === "draftTeamId" ? !directory.teams.some(t => t.id === e.value) :
        (e.value as { teamId: string | null }[]).some(a => a.teamId && !directory.teams.some(t => t.id === a.teamId))))
      throw Error("Unknown canonical profile Team");
    Reflect.set(target, field, structuredClone(comparableValue(field, e.value)));
    if (field === "draftTeamId") c.profile.draftTeamName = directory.teams.find(t => t.id === e.value)!.name;
    if (["position", "bats", "throws", "birthDate", "birthPlace", "nationality"].includes(field)) Reflect.set(p, field, e.value);
    if (field === "position" && p.playerType === null) p.playerType = e.value === "P" ? "pitcher" : "fielder";
    if (field === "heightCm" || field === "weightKg") {
      c.profile.measurementsObservedAt ??= e.verifiedAt; c.profile.measurementsEffectiveDate = null;
    }
    if (field === "birthDate") {
      const birth = String(e.value); c.profile.ageYears = Number(directory.effectiveDate.slice(0, 4)) - Number(birth.slice(0, 4)) - Number(directory.effectiveDate.slice(5) < birth.slice(5));
    }
    if (field === "uniformNumber" || field === "registrationClass") {
      // Jersey alone is insufficient: the entry must be paired with a reviewed same-day canonical Team.
      const evidence = groups.get(`${e.playerId}:affiliations`);
      const affiliation = evidence && evidence.every(a => isDeepStrictEqual(a.value, evidence[0]!.value)) &&
        (evidence[0]!.value as { teamId: string | null; from: string | null; to: string | null; uniformNumber: string | null }[])
          .some(a => a.teamId === c.membership.teamId && (field !== "uniformNumber" || a.uniformNumber === e.value) && a.from?.length === 10 && a.to?.length === 10 && a.from <= directory.effectiveDate && a.to >= directory.effectiveDate);
      if (!affiliation) { Reflect.set(c.membership, field, null); continue; }
      if (field === "uniformNumber") { c.membership.uniformNumberObservedAt = e.verifiedAt; c.membership.uniformNumberEffectiveDate = directory.effectiveDate; }
    }
    recordCredits();
  }
  return { directory: npbPlayerDirectorySchema.parse(nextDirectory), catalog: npbCatalogSchema.parse(nextCatalog), conflicts };
}
