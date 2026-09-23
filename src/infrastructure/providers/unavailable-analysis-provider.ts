import type { AnalysisProvider } from "../../application/ports";
import type { AnalysisCapabilities, AnalysisQuery } from "../../domain/analysis";
import type { League } from "../../domain/models";

// The catalog sample has no event-level observations. Never turn its season
// totals into invented splits or silently substitute fabricated analysis data.
export class UnavailableAnalysisProvider implements AnalysisProvider {
  readonly id = "sample-v1";
  constructor(private readonly manifest: (league: League) => AnalysisCapabilities) {}
  capabilities(league: League) { return this.manifest(league); }
  async analyze(query: AnalysisQuery) {
    return {
      status: "unavailable" as const,
      query,
      reason: "現在の同梱サンプルに分析用の試合別・投球別データはありません",
    };
  }
}
