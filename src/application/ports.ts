import type { League, PlayerCatalog } from "../domain/models";
import type {
  AnalysisCapabilities,
  AnalysisQuery,
  AnalysisResult,
} from "../domain/analysis";

// Added without expanding the player-directory provider. Implement only after
// the adoption gate; every response must pass analysisResultSchema validation.
export interface AnalysisProvider {
  readonly id: string;
  capabilities(league: League): AnalysisCapabilities;
  analyze(query: AnalysisQuery, signal: AbortSignal): Promise<AnalysisResult>;
}

export interface PlayerProvider {
  readonly id: string;
  readonly policy: {
    cacheTtlMs: number;
    maxSourceAgeMs: number;
    allowPersistence: boolean;
  };
  loadCatalog(league: League, signal: AbortSignal): Promise<PlayerCatalog>;
}
export interface CacheStore {
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
}
export interface SettingsStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}
