import { playerPeriodComparisonSchema, type PlayerPeriodComparison } from "../../domain/player-period-comparison";

export interface PlayerPeriodComparisonReader {
  find(playerId: string): Promise<PlayerPeriodComparison | null>;
}

export class HttpPlayerPeriodComparisonRepository implements PlayerPeriodComparisonReader {
  constructor(private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init)) {}

  async find(playerId: string): Promise<PlayerPeriodComparison | null> {
    const url = new URL("api/npb/analysis", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    url.searchParams.set("playerId", playerId);
    const response = await this.fetcher(url, { headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Player Analysis HTTP ${response.status}`);
    const value = playerPeriodComparisonSchema.parse(await response.json());
    if (value.player.id !== playerId) throw new Error("Player Analysis identity mismatch");
    return value;
  }
}
