import { z } from "zod";
import { catalogSchema, timestampSchema } from "../domain/models";
import type { CatalogResult, League } from "../domain/models";
import type { CacheStore, PlayerProvider } from "./ports";

const entrySchema = z.object({
  version: z.literal(2),
  data: catalogSchema,
  fetchedAt: timestampSchema,
  expiresAt: timestampSchema,
});
type Entry = z.infer<typeof entrySchema>;

export class PlayerRepository {
  private readonly pending = new Map<League, Promise<CatalogResult>>();
  constructor(
    private readonly provider: PlayerProvider,
    private readonly cache: CacheStore,
    private readonly now: () => number = Date.now,
    private readonly timeoutMs = 8_000,
  ) {}
  load(league: League, force = false): Promise<CatalogResult> {
    const pending = this.pending.get(league);
    if (pending) return pending;
    const request = this.read(league, force).finally(() => {
      this.pending.delete(league);
    });
    this.pending.set(league, request);
    return request;
  }
  private async read(league: League, force: boolean): Promise<CatalogResult> {
    const key = `catalog:v2:${this.provider.id}:${league}`;
    const warnings: string[] = [];
    let cached: Entry | null = null;
    if (this.provider.policy.allowPersistence) {
      try {
        const raw = await this.cache.read(key);
        if (raw != null) {
          const parsed = entrySchema.safeParse(raw);
          if (
            parsed.success &&
            parsed.data.data.league === league &&
            parsed.data.data.source.providerId === this.provider.id &&
            Date.parse(parsed.data.fetchedAt) <= this.now()
          )
            cached = parsed.data;
          else
            warnings.push(
              "保存データを読み直す必要があります。提供元から再取得します。",
            );
        }
      } catch {
        warnings.push("キャッシュを読み込めません。");
      }
    }
    const result = (
      entry: Entry,
      origin: "cache" | "provider",
      failed = false,
    ): CatalogResult => {
      // Source age and fetch age are different: refetching old data cannot make it fresh.
      const expiresAt = new Date(
        Math.min(
          Date.parse(entry.expiresAt),
          Date.parse(entry.fetchedAt) + this.provider.policy.cacheTtlMs,
          Date.parse(entry.data.source.updatedAt) +
            this.provider.policy.maxSourceAgeMs,
        ),
      ).toISOString();
      return {
        data: entry.data,
        freshness: {
          fetchedAt: entry.fetchedAt,
          expiresAt,
          origin,
          state:
            failed || this.now() >= Date.parse(expiresAt) ? "stale" : "fresh",
        },
        warnings,
      };
    };
    if (cached && !force && result(cached, "cache").freshness.state === "fresh")
      return result(cached, "cache");
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);
    try {
      const data = catalogSchema.parse(
        await this.provider.loadCatalog(league, controller.signal),
      );
      if (
        data.league !== league ||
        data.source.providerId !== this.provider.id ||
        Date.parse(data.source.updatedAt) > this.now() + 5 * 60_000
      )
        throw new Error("Invalid source metadata");
      const fetchedAt = new Date(this.now()).toISOString();
      const entry: Entry = {
        version: 2,
        data,
        fetchedAt,
        expiresAt: new Date(
          this.now() + this.provider.policy.cacheTtlMs,
        ).toISOString(),
      };
      if (this.provider.policy.allowPersistence) {
        try {
          await this.cache.write(key, entry);
        } catch {
          warnings.push(
            "端末にキャッシュを保存できません。この表示は今回のみです。",
          );
        }
      }
      return result(entry, "provider");
    } catch {
      if (cached) {
        warnings.push(
          "更新できなかったため、保存済みのデータを表示しています。",
        );
        return result(cached, "cache", true);
      }
      throw new Error(
        "選手データを取得できません。接続を確認して、もう一度お試しください。",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
