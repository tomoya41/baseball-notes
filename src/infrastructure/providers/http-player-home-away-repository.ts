import { playerHomeAwaySchema, type PlayerHomeAway } from "../../domain/player-home-away";

export class HttpPlayerHomeAwayRepository {
  constructor(private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init)) {}

  async find(playerId: string): Promise<PlayerHomeAway | null> {
    const url = new URL("api/npb/home-away", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    url.searchParams.set("playerId", playerId);
    const response = await this.fetcher(url, { headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Player Home/Away HTTP ${response.status}`);
    const value = playerHomeAwaySchema.parse(await response.json());
    if (value.player.id !== playerId) throw new Error("Player Home/Away identity mismatch");
    return value;
  }
}
