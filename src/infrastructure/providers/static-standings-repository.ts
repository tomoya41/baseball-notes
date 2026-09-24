import type { StandingsRepository, Standing } from "../../domain/standings";
import { npbLatestStandingsSchema, standingsPayloadSchema, type NpbLatestStandings } from "../../domain/standings";

type SmallCache = Pick<Storage, "getItem" | "setItem">;
function browserCache(): SmallCache | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

// The app reads our generated payload, never the original baseball source or a DB token.
export class StaticStandingsRepository implements StandingsRepository {
  constructor(
    private readonly baseUrl: string,
    private readonly request: typeof fetch = (input, init) => fetch(input, init),
    private readonly npbBaseUrl = baseUrl,
    private readonly cache: SmallCache | null = browserCache(),
  ) {}
  async findByDate(league: "MLB" | "NPB", date: string): Promise<Standing[]> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid standings date");
    const response = await this.request(`${this.baseUrl}data/standings/${league.toLowerCase()}/${date}.json`);
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`Standings payload HTTP ${response.status}`);
    const payload = standingsPayloadSchema.parse(await response.json() as unknown);
    if (payload.league !== league || payload.throughDate !== date) throw new Error("Standings payload identity mismatch");
    return payload.standings;
  }
  async findLatestNpb(): Promise<NpbLatestStandings | null> {
    const url = `${this.npbBaseUrl.replace(/\/?$/, "/")}data/standings/npb/latest.json`;
    const cacheKey = `npb-standings-v1:${url}`;
    let cached: NpbLatestStandings | null = null;
    try {
      const raw = this.cache?.getItem(cacheKey);
      if (raw) cached = npbLatestStandingsSchema.parse(JSON.parse(raw) as unknown);
    } catch { /* Ignore damaged or unavailable device cache. */ }
    try {
      const response = await this.request(url, { cache: "no-cache" });
      if (response.status === 404) return cached;
      if (!response.ok) throw new Error(`NPB standings payload HTTP ${response.status}`);
      const payload = npbLatestStandingsSchema.parse(await response.json() as unknown);
      if (cached && cached.throughDate > payload.throughDate) return cached;
      try { this.cache?.setItem(cacheKey, JSON.stringify(payload)); } catch { /* The remote payload remains usable. */ }
      return payload;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  }
}
