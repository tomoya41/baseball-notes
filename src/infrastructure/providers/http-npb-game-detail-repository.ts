import { npbGameDetailSchema, type NpbGameDetail } from "../../domain/npb-game-detail";

export class HttpNpbGameDetailRepository {
  constructor(private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init)) {}

  async find(gameId: string): Promise<NpbGameDetail | null> {
    const url = new URL("api/npb/game-detail", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    url.searchParams.set("gameId", gameId);
    const response = await this.fetcher(url, { headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Game Detail HTTP ${response.status}`);
    const result = npbGameDetailSchema.parse(await response.json());
    if (result.gameId !== gameId) throw new Error("Game Detail identity mismatch");
    return result;
  }
}
