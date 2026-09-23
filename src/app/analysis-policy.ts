import {
  capabilityIds,
  capabilityManifestSchema,
  samplePolicySchema,
} from "../domain/analysis";
import type { AnalysisCapabilities } from "../domain/analysis";
import type { League } from "../domain/models";

export const samplePolicy = samplePolicySchema.parse({
  revision: "sample-warning-v1",
  rules: {
    battingSplit: { unit: "PA", warnBelow: 20 },
    pitchLevel: { unit: "pitches", warnBelow: 50 },
    battedBall: { unit: "BBE", warnBelow: 20 },
    battery: { unit: "pitches", warnBelow: 100 },
  },
});
export function foundationAnalysisCapabilities(
  league: League,
): AnalysisCapabilities {
  return capabilityManifestSchema.parse({
    providerId: "sample-v1",
    league,
    revision: "analysis-a-1",
    subjects: [],
    seasonTypes: [],
    coverage: null,
    features: Object.fromEntries(
      capabilityIds.map((feature) => [
        feature,
        {
          status: "unavailable",
          implementation: "not-implemented",
          reason:
            "現在の同梱サンプルは分析用の試合別・投球別データを提供していません",
          evidence: ["docs/analysis-capabilities.md"],
        },
      ]),
    ),
    metricRequirements: {},
    periods: [],
    populations: [],
    supportedCombinations: [],
  });
}
