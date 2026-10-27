import { z } from "zod";

const bridgeSchema = z.object({ playerId: z.uuid(), npbId: z.string().regex(/^\d{8}$/), wikidataId: z.string().regex(/^Q\d+$/) });
export const coverageArchiveSchema = z.object({
  titles: z.array(bridgeSchema.extend({ title: z.string().min(1), identityScope: z.literal("historical_only").optional() })),
});
export const regularGapIssuesSchema = z.array(z.object({ playerId: z.uuid(), reason: z.string().min(1) }));
export const csGapIssuesSchema = z.array(z.object({ reason: z.string().min(1), article: z.string().min(1).optional() }));

export function regularIssueCategory(reason: string) {
  if (reason === "unsupported_table_definition") return "unsupported_source_table";
  if (reason === "Unsupported numeric cell") return "unparseable_numeric";
  if (reason.includes("Rate without denominator")) return "insufficient_components";
  if (/Rate discrepancy:|Invalid total bases|PA components exceed PA/.test(reason)) return "inconsistent_statistics";
  return "unclassified_quarantine";
}

/** Operational diagnostics only. No name joins, missing-season estimates or admission decisions. */
export function classifyNpbCoverageGaps(
  players: readonly { id: string; years: readonly number[]; bridge: boolean }[],
  bridges: readonly z.infer<typeof bridgeSchema>[],
  archive: z.infer<typeof coverageArchiveSchema>,
  regularIssues: z.infer<typeof regularGapIssuesSchema>,
  csIssues: z.infer<typeof csGapIssuesSchema>,
) {
  z.array(bridgeSchema).parse(bridges);
  for (const key of ["playerId", "npbId", "wikidataId"] as const) {
    if (new Set(bridges.map(b => b[key])).size !== bridges.length) throw Error(`Conflicting canonical bridge ${key}`);
    if (new Set(archive.titles.map(b => b[key])).size !== archive.titles.length) throw Error(`Conflicting archived identity ${key}`);
  }
  if (new Set(archive.titles.map(b => b.title)).size !== archive.titles.length) throw Error("Conflicting archived article title");
  if (archive.titles.some(link => link.identityScope && bridges.some(b => b.playerId === link.playerId || b.npbId === link.npbId || b.wikidataId === link.wikidataId))) {
    throw Error("Historical-only archive conflicts with the Current canonical namespace");
  }
  for (const link of archive.titles.filter(p => !p.identityScope)) {
    if (!bridges.some(b => b.playerId === link.playerId && b.npbId === link.npbId && b.wikidataId === link.wikidataId)) {
      throw Error("Archived identity does not match an independently admitted canonical bridge");
    }
  }
  const archived = new Set(archive.titles.filter(p => !p.identityScope).map(p => p.playerId));
  const byPlayer = new Map<string, Set<string>>();
  for (const issue of regularIssues) {
    if (!byPlayer.has(issue.playerId)) byPlayer.set(issue.playerId, new Set());
    byPlayer.get(issue.playerId)!.add(regularIssueCategory(issue.reason));
  }
  const details = players.map(p => {
    if (p.bridge !== bridges.some(b => b.playerId === p.id)) throw Error("Current bridge status mismatch");
    const categories = [...(byPlayer.get(p.id) ?? [])].sort();
    const status = !p.bridge ? "independent_identity_required" : p.years.length ? "partial_history_collected"
      : !archived.has(p.id) ? "article_archive_required" : categories.length ? "source_rows_quarantined" : "no_admitted_season_rows";
    const requiredEvidence = status === "independent_identity_required" ? "canonical_source_mapping_and_independent_npb_id_qid"
      : status === "article_archive_required" ? "licensed_revision_linked_by_exact_independent_ids"
      : status === "source_rows_quarantined" ? "source_correction_or_independently_tested_exact_parser_rule"
      : status === "no_admitted_season_rows" ? "verified_season_rows_in_admitted_years"
      : "independent_career_span_and_missing_season_evidence";
    return { playerId: p.id, status, requiredEvidence, quarantineCategories: categories,
      careerCompleteness: "unverified" as const, registrationStatus: "unknown" as const };
  });
  const count = (values: readonly string[]) => Object.fromEntries([...new Set(values)].sort().map(key => [key, values.filter(v => v === key).length]));
  return {
    statusCounts: count(details.map(p => p.status)),
    regularQuarantine: { diagnostics: regularIssues.length, categoryCounts: count(regularIssues.map(p => regularIssueCategory(p.reason))) },
    csQuarantine: { diagnostics: csIssues.length, reasonCounts: count(csIssues.map(p => p.reason)),
      explicitArticleTargets: [...new Set(csIssues.flatMap(p => p.article ? [p.article] : []))].sort(),
      requiredEvidence: "exact_game_team_role_article_reference_and_independent_canonical_bridge" },
    interpretation: "Uncollected is not zero appearances, an NPB debut year, inactive registration or a complete career. Diagnostics are not distinct players or verified Facts.",
    details,
  };
}
