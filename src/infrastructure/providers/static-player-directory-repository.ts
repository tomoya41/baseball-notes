import { npbPlayerDirectorySchema, type NpbPlayerDirectory } from "../../domain/npb-player-directory";

type SmallCache = Pick<Storage, "getItem" | "setItem">;
function browserCache(): SmallCache | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export class StaticPlayerDirectoryRepository {
  constructor(private readonly baseUrl: string,
    private readonly request: typeof fetch = (input, init) => fetch(input, init),
    private readonly cache: SmallCache | null = browserCache()) {}

  async findLatestNpb(): Promise<NpbPlayerDirectory> {
    const url = `${this.baseUrl.replace(/\/?$/, "/")}data/npb/players/latest.json`;
    const cacheKey = `npb-player-directory-v2:${url}`;
    let cached: NpbPlayerDirectory | null = null;
    try {
      const raw = this.cache?.getItem(cacheKey);
      if (raw) cached = npbPlayerDirectorySchema.parse(JSON.parse(raw) as unknown);
    } catch { /* Ignore damaged device cache. */ }
    try {
      const response = await this.request(url, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Player directory HTTP ${response.status}`);
      const value = npbPlayerDirectorySchema.parse(await response.json() as unknown);
      if (cached && cached.generatedAt > value.generatedAt) return cached;
      try { this.cache?.setItem(cacheKey, JSON.stringify(value)); } catch { /* Remote result remains usable. */ }
      return value;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  }
}
