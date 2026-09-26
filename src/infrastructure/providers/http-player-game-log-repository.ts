import { playerGameLogResponseSchema, type PlayerGameLogResponse } from "../../domain/player-game-log";

export interface PlayerGameLogReader {
  find(playerId: string, limit?: number, offset?: number): Promise<PlayerGameLogResponse | null>;
}

export class HttpPlayerGameLogRepository implements PlayerGameLogReader {
  constructor(private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init)) {}

  async find(playerId: string, limit = 10, offset = 0): Promise<PlayerGameLogResponse | null> {
    const url = new URL("api/npb/game-log", this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`);
    url.searchParams.set("playerId", playerId);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    const response = await this.fetcher(url, { headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Game Log HTTP ${response.status}`);
    const payload = playerGameLogResponseSchema.parse(await response.json());
    if (payload.playerId !== playerId || payload.limit !== limit || payload.offset !== offset)
      throw new Error("Game Log response identity mismatch");
    return payload;
  }
}
