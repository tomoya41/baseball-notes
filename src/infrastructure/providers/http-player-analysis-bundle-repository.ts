import { playerAnalysisBundleSchema, type PlayerAnalysisBundle } from "../../domain/player-analysis-bundle";

export class HttpPlayerAnalysisBundleRepository {
  constructor(private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init)) {}

  async find(playerId: string): Promise<PlayerAnalysisBundle | null> {
    const url = new URL("api/npb/analysis-bundle", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    url.searchParams.set("playerId", playerId);
    const response = await this.fetcher(url, { headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Player Analysis HTTP ${response.status}`);
    const value = playerAnalysisBundleSchema.parse(await response.json());
    if (value.playerId !== playerId) throw new Error("Player Analysis identity mismatch");
    return value;
  }
}
