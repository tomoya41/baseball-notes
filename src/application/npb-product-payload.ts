import { npbCatalogSchema, npbCapabilitiesSchema, unavailableVisual, ageOnDate, type NpbCatalog } from "../domain/npb-product-contract";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";
import type { NpbSeasonPayload } from "./npb-season-payload";
import type { z } from "zod";

export type ReviewedMeasurements = { observedAt: string; effectiveDate: string | null;
  players: readonly { playerId: string; heightCm: number | null; weightKg: number | null }[] };
// Display metadata is canonical. No provider abbreviation or URL is a UI identity key.
const divisions: Record<string, "Central" | "Pacific"> = Object.fromEntries([
  ...["tigers", "giants", "baystars", "dragons", "carp", "swallows"].map(t => [`npb:team:${t}`, "Central"]),
  ...["hawks", "fighters", "buffaloes", "eagles", "lions", "marines"].map(t => [`npb:team:${t}`, "Pacific"]),
]) as Record<string, "Central" | "Pacific">;
export function buildNpbCatalog(directory: NpbPlayerDirectory, measurements: ReviewedMeasurements,
  additionalMeasurements?: ReviewedMeasurements): NpbCatalog {
  const known = new Map([additionalMeasurements, measurements].flatMap(snapshot => snapshot?.players.map(p =>
    [p.playerId, { ...p, observedAt: snapshot.observedAt, effectiveDate: snapshot.effectiveDate }] as const) ?? []));
  return npbCatalogSchema.parse({ schemaVersion: 1, league: "NPB", effectiveDate: directory.effectiveDate,
    generatedAt: directory.generatedAt, teams: directory.teams.map(t => ({ teamId: t.id, name: t.name,
      shortName: t.shortName, abbreviation: t.shortName, division: divisions[t.id], homeLocation: null, homeStadium: null,
      visual: { logo: unavailableVisual, primaryColor: null, colorRole: "neutral", fallback: "abbreviation" } })),
    players: directory.players.map(p => {
      const measurement = known.get(p.playerId);
      const hasMeasurement = measurement?.heightCm != null || measurement?.weightKg != null;
      return { playerId: p.playerId, displayName: p.displayName,
        profile: { position: p.position, bats: p.bats, throws: p.throws, birthDate: p.birthDate,
          birthPlace: p.birthPlace, nationality: p.nationality, ageYears: ageOnDate(p.birthDate, directory.effectiveDate),
          ageAsOfDate: directory.effectiveDate, heightCm: measurement?.heightCm ?? null,
          weightKg: measurement?.weightKg ?? null, measurementsObservedAt: hasMeasurement ? measurement!.observedAt : null,
          measurementsEffectiveDate: hasMeasurement ? measurement!.effectiveDate : null,
          draftYear: null, draftRound: null, careerHistory: [] },
        membership: { teamId: p.teamId, scope: "latest_stored_affiliation", uniformNumber: null,
          uniformNumberObservedAt: null, uniformNumberEffectiveDate: null },
        visual: { photo: unavailableVisual, fallback: "name" },
        battingAvailable: p.battingAvailable, pitchingAvailable: p.pitchingAvailable };
    }) });
}

type Capability = z.infer<typeof npbCapabilitiesSchema>["data"][string];
export function buildNpbCapabilities(catalog: NpbCatalog, season: NpbSeasonPayload,
  hot: { status: "ready" | "not_ready"; reasons: string[] }) {
  const data: Record<string, Capability> = {};
  const set = (key: string, status: Capability["status"], reasons: string[] = [], known: number | null = null,
    total: number | null = null) => { data[key] = { status, available: status === "available" || status === "partially_available", reasons, known, total }; };
  for (const key of ["teams", "standings", "schedule", "results", "teamSeasonRecord", "game", "score", "gameStatus",
    "battingFacts", "pitchingFacts", "battingOrder", "batterRole", "pitcherRole", "playerMaster", "recent",
    "homeAway", "opponent", "battingOrderAnalysis", "roleAnalysis", "season"])
    set(key, "available", key === "season" || key === "teamSeasonRecord" ? ["stored_scope_coverage_separate"] : []);
  set("completeness", season.coverage.status === "complete" ? "available" : "partially_available", season.readiness.reasons);
  set("playerTeam", "partially_available", ["latest_stored_affiliation_not_verified_current_roster"],
    catalog.players.filter(p => p.membership.teamId !== null).length, catalog.players.length);
  for (const key of ["position", "bats", "throws", "birthDate", "birthPlace", "nationality", "heightCm", "weightKg"] as const) {
    const n = catalog.players.filter(p => p.profile[key] !== null).length;
    set(key, n === catalog.players.length ? "available" : n ? "partially_available" : "blocked_by_rights",
      n < catalog.players.length ? ["reviewed_identity_and_reusable_field_required"] : [], n, catalog.players.length);
  }
  for (const key of ["uniformNumber", "draft", "teamHistory", "transactions", "FA", "posting", "retirement", "prospects", "preseason", "camp"])
    set(key, "blocked_by_rights", ["source_exists_reuse_permission_not_verified"]);
  const partialProfile = (key: string, count: number, reason: string) =>
    set(key, count === catalog.players.length ? "available" : count ? "partially_available" : "blocked_by_rights",
      count < catalog.players.length ? [reason] : [], count, catalog.players.length);
  partialProfile("profile", catalog.players.filter(p => p.profile.birthDate !== null || p.profile.position !== null).length, "profile_fields_partial");
  partialProfile("handedness", catalog.players.filter(p => p.profile.bats !== null && p.profile.throws !== null).length, "baseball_specific_handedness_evidence_required");
  partialProfile("knownPositions", catalog.players.filter(p => !!p.profile.knownPositions?.length || p.profile.position !== null).length, "primary_position_not_inferred_from_multiple_positions");
  partialProfile("schools", catalog.players.filter(p => !!p.profile.schools?.length || !!p.profile.amateurHistory?.length).length, "school_attendance_not_graduation");
  partialProfile("originPlace", catalog.players.filter(p => p.profile.originPlace != null).length, "origin_place_distinct_from_birth_place");
  partialProfile("draft", catalog.players.filter(p => p.profile.draftYear !== null || p.profile.draftRound !== null || p.profile.draftTeamId != null).length, "individual_draft_fields_not_complete_draft_registry");
  partialProfile("teamHistory", catalog.players.filter(p => !!p.profile.affiliations?.length).length, "partial_affiliation_history_not_full_career_or_current_roster");
  data.rosterHistory = { ...data.teamHistory! };
  partialProfile("uniformNumber", catalog.players.filter(p => p.membership.uniformNumber !== null).length, "dated_team_specific_current_number_evidence_required");
  partialProfile("careerIdentity", catalog.players.filter(p => !!p.profile.identityLinked).length, "exact_external_id_bridge_partial_not_career_stats");
  for (const key of ["draftYear", "draftRound", "draftTeamId", "draftType", "joinedYear", "npbDebutYear"] as const)
    partialProfile(key, catalog.players.filter(p => p.profile[key] != null).length, "field_specific_verified_evidence_required");
  partialProfile("rosterStatus", catalog.players.filter(p => p.membership.registrationClass != null).length, "dated_current_registration_evidence_required");
  set("historicalSeason", "blocked_by_rights", ["source_exists_reuse_permission_and_longevity_not_verified"]);
  set("careerStats", "blocked_by_rights", ["full_career_coverage_and_reusable_source_required"]);
  set("milestones", "blocked_by_rights", ["full_career_coverage_required_not_collected_range_total"]);
  set("seasonMilestones", "partially_available", ["stored_season_checkpoints_not_career_or_official_achievement", "coverage_separate_no_achievement_date"]);
  for (const key of ["playerPhoto", "teamLogo", "officialTeamColors"])
    set(key, "blocked_by_rights", ["asset_specific_permission_required"], 0, key === "playerPhoto" ? catalog.players.length : 12);
  for (const key of ["directBvP", "pitchLevel", "inningScore", "substitutionOrder", "reliefOrder"])
    set(key, "source_unavailable", ["canonical_granularity_unavailable_in_adopted_source"]);
  set("hot", hot.status === "ready" ? "available" : "production_gate_pending", hot.reasons);
  set("countingRanking", season.readiness.status === "ready" ? "available" : "production_gate_pending", season.readiness.reasons);
  set("rateRanking", season.readiness.status === "ready" ? "available" : "production_gate_pending", season.readiness.reasons);
  set("records", season.readiness.status === "ready" ? "available" : "production_gate_pending", season.readiness.reasons);
  return npbCapabilitiesSchema.parse({ schemaVersion: 1, league: "NPB", effectiveDate: catalog.effectiveDate,
    generatedAt: catalog.generatedAt, coverage: { status: season.coverage.status, summary: season.coverage.summary }, data });
}
