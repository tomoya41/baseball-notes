import { supplementNpbDirectory, supplementNpbMeasurements } from "./npb-profile-supplement";
import { buildNpbCatalog } from "./npb-product-payload";
import { applyNpbProfileRegistry } from "./npb-free-profile";
import supplement from "../data/npb-reviewed-profile-supplement.json";
import registry from "../data/npb-free-profile-registry.json";
import wikipedia from "../data/npb-wikipedia-profile-registry.json";
import curated from "../data/npb-curated-profile-registry.json";
import assisted from "../data/npb-codex-assisted-profile-registry.json";
import identities from "../data/npb-free-profile-identities.json";
import { reviewedMeasurements } from "../data/npb-reviewed-measurements";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";
import type { NpbCatalog } from "../domain/npb-product-contract";

// Shared by every publication path. Legacy known values take precedence; no DB/source access.
export function projectNpbFreeProfiles(directory: NpbPlayerDirectory, savedCatalog?: NpbCatalog) {
  const preserved = structuredClone(directory);
  const saved = new Map(savedCatalog?.players.map(p => [p.playerId, p]) ?? []);
  for (const p of preserved.players) {
    const prior = saved.get(p.playerId); if (!prior) continue;
    for (const key of ["position", "bats", "throws", "birthDate", "birthPlace", "nationality"] as const)
      if (p[key] === null) Object.assign(p, { [key]: prior.profile[key] });
    if (p.playerType === null) p.playerType = p.position === "P" ? "pitcher" : p.position ? "fielder" : null;
  }
  const legacy = supplementNpbDirectory(preserved, supplement);
  const catalog = buildNpbCatalog(legacy.directory, reviewedMeasurements, supplementNpbMeasurements(reviewedMeasurements, supplement));
  for (const p of catalog.players) {
    const prior = saved.get(p.playerId); if (!prior) continue;
    for (const [key, value] of Object.entries(prior.profile))
      if (value != null && !(Array.isArray(value) && !value.length) && Reflect.get(p.profile, key) == null)
        Reflect.set(p.profile, key, structuredClone(value));
  }
  const result = applyNpbProfileRegistry(legacy.directory, catalog, { ...registry,
    observedAt: curated.observedAt, entries: [...registry.entries, ...wikipedia.entries, ...curated.entries, ...assisted.entries] });
  // A verified bridge is useful even when every profile value remains unavailable/conflicted.
  const linked = new Set(identities.map(b => b.playerId));
  for (const p of result.catalog.players) if (linked.has(p.playerId)) p.profile.identityLinked = true;
  return { ...result, conflicts: [...legacy.conflicts, ...result.conflicts] };
}
