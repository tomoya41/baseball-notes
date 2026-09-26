import { playerOpponentSchema, type PlayerOpponent } from "../../domain/player-opponent";

export class HttpPlayerOpponentRepository {
  constructor(private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init)) {}

  async find(playerId: string): Promise<PlayerOpponent | null> {
    const url = new URL("api/npb/opponent", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    url.searchParams.set("playerId", playerId);
    const response = await this.fetcher(url, { headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Player Opponent HTTP ${response.status}`);
    const value = playerOpponentSchema.parse(await response.json());
    if (value.player.id !== playerId) throw new Error("Player Opponent identity mismatch");
    return value;
  }
}
