import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { canonicalEntityPath, canonicalEntityRefSchema, favoriteMatches, leagueSwitchPath, normalizePlayerSearch } from "../src/domain/cross-league";
import { leagueAvailabilitySchema, mlbAvailability } from "../src/domain/league-availability";
import { StaticLeagueAvailabilityRepository } from "../src/infrastructure/providers/static-league-availability-repository";
import { Favorites } from "../src/application/favorites";
import type { Favorite } from "../src/domain/models";
import { MlbLeagueView } from "../src/ui/mlb-foundation";

const uuid = "a66dfd52-1ae2-4245-b849-558f263e6422";
const npb: Favorite = { league: "NPB", kind: "player", entityId: uuid, addedAt: "2026-09-27T00:00:00Z" };
const mlb: Favorite = { ...npb, league: "MLB", entityId: `mlb:player:${uuid}` };
const render = (view: React.ReactNode, path = "/MLB/home") => renderToStaticMarkup(
  <MemoryRouter initialEntries={[path]}>{view}</MemoryRouter>);

describe("canonical league boundaries", () => {
  it.each(["player", "team", "game"] as const)("routes MLB %s with a private canonical UUID", kind => {
    const id = `mlb:${kind}:${uuid}`;
    expect(canonicalEntityPath({ league: "MLB", kind, id })).toBe(`/MLB/${kind}s/${encodeURIComponent(id)}`);
    expect(canonicalEntityRefSchema.safeParse({ league: "NPB", kind, id }).success).toBe(false);
  });
  it("keeps existing NPB IDs unchanged", () => {
    expect(canonicalEntityPath({ league: "NPB", kind: "player", id: uuid })).toBe(`/NPB/players/${uuid}`);
    expect(canonicalEntityRefSchema.safeParse({ league: "NPB", kind: "game", id: "npb:game:32c76ee9e92f7408892c" }).success).toBe(true);
  });
  it.each(["660271", "npb:team:hawks", "mlb:game:660271", "https://provider/game/660271"])("rejects provider/cross-league key %s", id => {
    expect(canonicalEntityRefSchema.safeParse({ league: "MLB", kind: "game", id }).success).toBe(false);
  });
  it("rejects bad leagues", () => {
    expect(canonicalEntityRefSchema.safeParse({ league: "BAD", kind: "player", id: uuid }).success).toBe(false);
  });
  it("keeps schedule date but drops entity and source routes when switching", () => {
    expect(leagueSwitchPath("/NPB/schedule", "?date=2026-09-25", "MLB")).toBe("/MLB/schedule");
    expect(leagueSwitchPath(`/NPB/players/${uuid}`, "?source=secret", "MLB")).toBe("/MLB/search");
    expect(leagueSwitchPath("/MLB/my", "", "NPB")).toBe("/NPB/my");
    expect(leagueSwitchPath("/MLB/schedule", "?season=2020&date=2020-09-20", "NPB")).toBe("/NPB/schedule");
    expect(leagueSwitchPath("/MLB/records", "?season=2020", "MLB")).toBe("/MLB/records?season=2020");
    expect(leagueSwitchPath("/NPB/schedule", "?date=2026-09-25", "NPB")).toBe("/NPB/schedule?date=2026-09-25");
  });
  it("normalizes case, space and accents without merging player identity", () => {
    expect(normalizePlayerSearch("  JOSÉ   Ramírez ")).toBe("jose ramirez");
    expect(normalizePlayerSearch("Ｊｏｓｅ Ramirez")).toBe("jose ramirez");
  });
});

describe("source permission boundary", () => {
  it("uses unknown coverage and no effective date rather than no-games", () => {
    expect(mlbAvailability.coverage).toBe("unknown");
    expect(mlbAvailability.effectiveDate).toBeNull();
  });
  it.each(["restricted", "unverified"] as const)("rejects %s with a production result", sourcePermission => {
    expect(leagueAvailabilitySchema.safeParse({ ...mlbAvailability, sourcePermission,
      features: { ...mlbAvailability.features, schedule: "available" } }).success).toBe(false);
  });
  it("requires coverage for ready status and rejects leaked payload fields", () => {
    expect(leagueAvailabilitySchema.safeParse({ ...mlbAvailability, sourcePermission: "approved", readiness: "ready", reason: "ready" }).success).toBe(false);
    expect(leagueAvailabilitySchema.safeParse({ ...mlbAvailability, sourceId: "provider-private-id" }).success).toBe(false);
  });
  it("loads one small static manifest, deduplicated across sections", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(mlbAvailability)));
    const repository = new StaticLeagueAvailabilityRepository("/baseball-notes/", request);
    await Promise.all([repository.find("MLB"), repository.find("MLB")]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toBe("/baseball-notes/data/mlb/manifest.json");
  });
  it("rejects league mismatch and retries a failed read", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ ...mlbAvailability, league: "NPB" })))
      .mockResolvedValueOnce(new Response(JSON.stringify(mlbAvailability)));
    const repository = new StaticLeagueAvailabilityRepository("/", request);
    await expect(repository.find("MLB")).rejects.toThrow("mismatch");
    expect(await repository.find("MLB")).toEqual(mlbAvailability);
  });
});

describe("Favorites storage compatibility", () => {
  it("preserves v1 NPB data, allows MLB, remains idempotent after reload", async () => {
    let raw = JSON.stringify({ version: 1, items: [npb] });
    const storage = { get: vi.fn(async () => raw), set: vi.fn(async (_key: string, value: string) => { raw = value; }) };
    const favorites = new Favorites(storage);
    await favorites.add(mlb); await favorites.add(mlb);
    expect(storage.set).toHaveBeenCalledTimes(1);
    const reloaded = new Favorites(storage);
    expect((await reloaded.list()).map(item => item.league)).toEqual(["NPB", "MLB"]);
    await reloaded.remove(mlb);
    expect(await reloaded.list()).toEqual([npb]);
    expect(favoriteMatches(npb, { ...npb, league: "MLB" })).toBe(false);
  });
  it("does not overwrite corrupt saved data", async () => {
    const storage = { get: vi.fn(async () => "broken"), set: vi.fn() };
    await expect(new Favorites(storage).add(mlb)).rejects.toThrow();
    expect(storage.set).not.toHaveBeenCalled();
  });
});

describe("MLB UI isolation", () => {
  it.each(["home", "search", "schedule", "analysis", "records", "my"])("has an isolated %s route without NPB facts or sample statistics", section => {
    const html = render(<Routes><Route path="/MLB/*" element={<MlbLeagueView favorites={[]} toggle={() => undefined} saving={false} />} /></Routes>, `/MLB/${section}`);
    expect(html).not.toContain("サンプル");
    expect(html).not.toContain("DeNA");
    expect(html).not.toContain("npb:game");
    expect(html).not.toContain("参考ランキング");
  });
});
