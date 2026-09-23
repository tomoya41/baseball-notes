import type { WatchProvider } from "../../application/ports";
import type { League } from "../../domain/models";
import { watchCapabilitiesSchema } from "../../domain/watch";
import type { WatchCapabilities, WatchScheduleResult, WatchLineupResult, WatchBullpenResult } from "../../domain/watch";

const reason = "現在の提供元には試合日程・打順・登板履歴の許諾済みデータがありません";
export class UnavailableWatchProvider implements WatchProvider {
  readonly id = "sample-watch-unavailable";
  capabilities(league: League): WatchCapabilities {
    const feature = { status: "unavailable", implementation: "not-implemented", reason,
      evidence: ["docs/analysis-capabilities.md"] };
    return watchCapabilitiesSchema.parse({ providerId: this.id, league,
      schedule: feature, lineup: feature, bullpenUsage: feature });
  }
  async schedule(): Promise<WatchScheduleResult> {
    return { status: "unavailable", reason };
  }
  async lineup(): Promise<WatchLineupResult> {
    return { status: "unavailable", reason };
  }
  async bullpen(): Promise<WatchBullpenResult> {
    return { status: "unavailable", reason };
  }
}
