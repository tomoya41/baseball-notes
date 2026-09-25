import { playerRecentResponseSchema, type PlayerRecentResponse, type RecentPeriod } from "../../domain/player-recent";

export interface PlayerRecentReader {
  find(playerId: string, period: RecentPeriod): Promise<PlayerRecentResponse | null>;
}

export class HttpPlayerRecentRepository implements PlayerRecentReader {
  constructor(private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init)) {}

  async find(playerId: string, period: RecentPeriod): Promise<PlayerRecentResponse | null> {
    const url = new URL("api/npb/recent", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    url.searchParams.set("playerId", playerId);
    url.searchParams.set("period", period);
    const response = await this.fetcher(url, { headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Recent Form HTTP ${response.status}`);
    return playerRecentResponseSchema.parse(await response.json());
  }
}
