import { npbHotPayloadSchema, type NpbHotPayload } from "../../application/npb-hot-payload";

type SmallCache = Pick<Storage, "getItem" | "setItem">;
function browserCache(): SmallCache | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export class StaticHotRepository {
  constructor(private readonly baseUrl: string,
    private readonly request: typeof fetch = (input, init) => fetch(input, init),
    private readonly cache: SmallCache | null = browserCache()) {}

  async findLatestNpb(): Promise<NpbHotPayload> {
    const url = `${this.baseUrl.replace(/\/?$/, "/")}data/npb/hot/latest.json`;
    const cacheKey = `npb-hot-v1:${url}`;
    let cached: NpbHotPayload | null = null;
    try {
      const raw = this.cache?.getItem(cacheKey);
      if (raw) cached = npbHotPayloadSchema.parse(JSON.parse(raw) as unknown);
    } catch { /* Ignore damaged or unavailable device cache. */ }
    try {
      const response = await this.request(url, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HOT payload HTTP ${response.status}`);
      const value = npbHotPayloadSchema.parse(await response.json() as unknown);
      if (cached && (cached.effectiveDate > value.effectiveDate ||
        cached.effectiveDate === value.effectiveDate && cached.generatedAt > value.generatedAt)) return cached;
      try { this.cache?.setItem(cacheKey, JSON.stringify(value)); } catch { /* Remote payload is still usable. */ }
      return value;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  }
}
