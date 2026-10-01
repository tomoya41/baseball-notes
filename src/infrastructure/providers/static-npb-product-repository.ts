import { npbCatalogSchema, npbCapabilitiesSchema, npbTeamSeasonSchema } from "../../domain/npb-product-contract";
import type { NpbCatalog, NpbCapabilities } from "../../domain/npb-product-contract";
import { npbSeasonMilestonesSchema } from "../../domain/npb-season-milestones";
import { publicDataFetch, rememberPublicResponse } from "../public-response-cache";

export class StaticNpbProductRepository {
  private pendingCatalog: Promise<NpbCatalog> | null = null;
  constructor(private readonly baseUrl: string, private readonly request: typeof fetch = publicDataFetch) {}
  private async read(path: string) {
    const response = await this.request(`${this.baseUrl.replace(/\/?$/, "/")}data/npb/${path}`, { cache: "no-cache" });
    if (!response.ok) throw Error(`NPB product HTTP ${response.status}`);
    return { value: await response.json() as unknown, response };
  }
  catalog(): Promise<NpbCatalog> {
    if (!this.pendingCatalog) this.pendingCatalog = (async () => {
      const result = await this.read("catalog/latest.json");
      const catalog = npbCatalogSchema.parse(result.value);
      await rememberPublicResponse(result.response);
      return catalog;
    })().catch(error => { this.pendingCatalog = null; throw error; });
    return this.pendingCatalog;
  }
  // Explicit refresh on reconnect/foreground; no page reload and no per-Player network fan-out.
  invalidateCatalog() { this.pendingCatalog = null; }
  async player(playerId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playerId))
      throw Error("Canonical Player ID required");
    return (await this.catalog()).players.find(p => p.playerId === playerId) ?? null;
  }
  async capabilities() {
    const result = await this.read("capabilities.json"), value = npbCapabilitiesSchema.parse(result.value);
    await rememberPublicResponse(result.response); return value;
  }
  async teamSeason(season: number) {
    if (!Number.isInteger(season) || season < 2000 || season > 9999) throw Error("Invalid Season");
    const result = await this.read(`teams/season/${season}/latest.json`), value = npbTeamSeasonSchema.parse(result.value);
    if (value.season !== season) throw Error("Season payload mismatch");
    await rememberPublicResponse(result.response); return value;
  }
  async seasonMilestones(season: number, expected: Pick<NpbCapabilities, "effectiveDate" | "generatedAt">) {
    if (!Number.isInteger(season) || season < 2000 || season > 9999) throw Error("Invalid Season");
    const result = await this.read(`milestones/${season}/latest.json`), value = npbSeasonMilestonesSchema.parse(result.value);
    if (value.season !== season) throw Error("Milestone Season payload mismatch");
    if (value.effectiveDate !== expected.effectiveDate || value.generatedAt !== expected.generatedAt)
      throw Error("Milestone publication generation mismatch");
    await rememberPublicResponse(result.response); return value;
  }
}
