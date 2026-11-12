import { describe, expect, it } from "vitest";
import { canonicalDeepLink, parentNativeRoute } from "../src/domain/native-navigation";
import { npbGamePlayerContext, npbGamePlayerLinks, npbGamePlayerSearch } from "../src/domain/npb-game-player-journey";
import { portableRoute, savedNpbPlayerComparison } from "../src/domain/product-sharing";

const player = "00000000-0000-4000-8000-000000000001";
const origin = { gameId: "npb:game:0123456789abcdefabcd", date: "2026-10-08", side: "home", stage: "regular", role: "pitching" } as const;
const query = (url: string) => new URLSearchParams(url.split("?")[1]);

describe("NPB game to player analysis", () => {
  it("retains the selected pitcher, year, scope and side through sharing and native Back", () => {
    const links = npbGamePlayerLinks(player, origin);
    const profile = canonicalDeepLink(`https://tomoya41.github.io/baseball-notes/#${links.profile}`)!;
    expect(npbGamePlayerContext(query(profile))).toEqual(origin);
    expect(npbGamePlayerContext(query(links.annual))).toEqual(origin);
    expect(query(links.compare!).get("player")).toBe(player);
    expect(query(links.compare!).get("players")).toBe(player);
    expect(parentNativeRoute(profile)).toBe(links.game);
    expect(parentNativeRoute(links.annual)).toBe(links.profile);
    expect(parentNativeRoute(links.compare!)).toBe(links.annual);
    expect(portableRoute("/NPB/compare",query(links.compare!).toString())).toContain(`player=${player}`);
  });

  it("keeps the originating club through a saved comparison and the route back to its schedule", () => {
    const scoped = { ...origin, scheduleTeam: "npb:team:tigers" };
    const links = npbGamePlayerLinks(player, scoped);
    const params = query(links.compare!);
    params.set("players", `${player},00000000-0000-4000-8000-000000000002`);
    params.set("playerCompare", "1");
    params.set("condition", "season");
    const saved = savedNpbPlayerComparison(params);
    expect(saved && npbGamePlayerContext(saved)).toEqual(scoped);
    expect(parentNativeRoute(`/NPB/compare?${saved}`)).toBe(links.annual);
    expect(parentNativeRoute(links.annual)).toBe(links.profile);
    expect(parentNativeRoute(links.profile)).toBe(links.game);
    expect(parentNativeRoute(links.game)).toBe("/NPB/schedule?date=2026-10-08&team=npb%3Ateam%3Atigers");
  });

  it("preserves CS stage without generating an official-season comparison", () => {
    const cs = { ...origin, stage: "npb_cs_final", role: "batting" } as const;
    const links = npbGamePlayerLinks(player, cs);
    expect(links.compare).toBeNull();
    expect(query(links.annual).get("competition")).toBe("postseason");
    expect(query(links.annual).get("stage")).toBe(cs.stage);
    expect(parentNativeRoute(links.profile)).toBe(links.game);
    expect(npbGamePlayerContext(query(canonicalDeepLink(`baseballnotes://NPB/players/${player}${links.search}`)!))).toEqual(cs);
  });

  it("rejects malformed or mismatched route context", () => {
    const params = npbGamePlayerSearch(origin);
    params.set("stage", "japan_series");
    expect(npbGamePlayerContext(params)).toBeNull();
    params.delete("stage");
    params.set("game", "https://example.com/redirect");
    expect(npbGamePlayerContext(params)).toBeNull();
    params.set("game", origin.gameId);
    params.append("season", "2025");
    expect(npbGamePlayerContext(params)).toBeNull();
  });
});
