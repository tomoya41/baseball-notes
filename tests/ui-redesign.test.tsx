import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PlayerTabs, Monogram } from "../src/ui/design-system";
import { ExploreScreen, FutureFeatureScreen, PlayerFutureLinks } from "../src/ui/future-surfaces";
import { futureSections } from "../src/presentation/future-features";
import { historicalPositions, collectedSeasonsLabel } from "../src/presentation/historical-player";
import { parseTheme } from "../src/app/appearance";
import { isVerifiedJapanPlayer, japanCohortEvidence } from "../src/domain/mlb-japan-cohort";
import { canonicalDeepLink, parentNativeRoute } from "../src/domain/native-navigation";
import cohort from "../src/data/mlb-japan-cohort.json";
import reviewed from "../src/data/mlb-japan-reviewed-entities.json";
const id = "00000000-0000-4000-8000-000000000001";
const mlb = "mlb:player:e70b8d12-aa41-50c0-9c1b-d468d451355f";
const wrap = (child: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{child}</MemoryRouter>);
describe("new navigation and future surfaces", () => {
  it("retains canonical player routes and historical context across the five tabs", () => {
    const html = wrap(<PlayerTabs base={`/MLB/players/${encodeURIComponent(mlb)}`} section="analysis" search="?season=2020" />);
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="[^"]+\/analysis\?season=2020"/);
    for (const label of ["概要", "成績", "分析", "試合別", "プロフィール"]) expect(html).toContain(label);
  });
  it.each(Object.keys(futureSections) as (keyof typeof futureSections)[])("%s is explicitly planned, with no fabricated data", feature => {
    const html = wrap(<FutureFeatureScreen feature={feature} league="NPB" />);
    expect(html).toContain("COMING SOON"); expect(html).toContain("現在、この機能のデータは表示していません");
    expect(html).not.toMatch(/<table|metric-tile|profile-photo|順位.*1位/);
  });
  it("groups future destinations away from current Home while preserving game and records access", () => {
    const html = wrap(<ExploreScreen league="NPB" />);
    for (const path of ["schedule", "records", "moves", "talent", "preseason", "matchup", "watch", "milestones"]) expect(html).toContain(`/NPB/${path}`);
    for (const label of ["選手移動・FA・Posting", "ドラフト・プロスペクト"]) expect(html).toContain(label);
  });
  it("selects a valid default section when a future-screen link contains an invalid tab", () => {
    for (const tab of ["99", "-1", "broken"]) {
      const html = renderToStaticMarkup(<MemoryRouter initialEntries={[`/NPB/moves?tab=${tab}`]}><FutureFeatureScreen feature="moves" league="NPB" /></MemoryRouter>);
      expect(html).toMatch(/aria-current="page"[^>]*href="[^"]+\?tab=0"/);
    }
  });
  it("places NPB career and advanced preparation in player context, without replacing MLB's real features", () => {
    expect(wrap(<PlayerFutureLinks base={`/NPB/players/${id}`} />)).toContain(`/players/${id}/career`);
    expect(wrap(<PlayerFutureLinks base={`/MLB/players/${mlb}`} historical />)).not.toContain("Direct BvP");
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={[`/NPB/players/${id}/career`]}><Routes><Route path="/NPB/players/:playerId/career" element={<FutureFeatureScreen feature="career" league="NPB" />} /></Routes></MemoryRouter>);
    expect(html).toContain(`/NPB/players/${id}/analysis`);
    expect(parentNativeRoute(`/NPB/players/${id}/career`)).toBe(`/NPB/players/${id}`);
  });
  it("keeps new tab deep links canonical and disallows arbitrary sections", () => {
    expect(canonicalDeepLink(`baseballnotes://MLB/players/${encodeURIComponent(mlb)}/stats?season=2025`)).toContain("/stats?season=2025");
    expect(canonicalDeepLink(`baseballnotes://NPB/players/${id}/more`)).toBe(`/NPB/players/${id}/more`);
    expect(canonicalDeepLink(`baseballnotes://NPB/players/${id}/admin`)).toBeNull();
  });
});
describe("verified Japanese cohort and display", () => {
  it("uses verified canonical identity, not spelling or a provider ID", () => {
    expect(isVerifiedJapanPlayer(mlb)).toBe(true); expect(japanCohortEvidence(mlb)).toBe("https://www.wikidata.org/entity/Q4391858");
    for (const value of ["大谷翔平", "ohtas001", "660271", "mlb:player:unknown"]) expect(isVerifiedJapanPlayer(value)).toBe(false);
  });
  it("does not classify known conflicting source entities as verified", () => {
    // Conflicting P27 results were excluded by the reviewed entity allowlist.
    for (const [canonical, entity] of Object.entries(cohort.players)) {
      expect(canonical).toMatch(/^mlb:player:[a-f0-9-]{36}$/);
      expect(reviewed.entities).toContain(entity.split("/").at(-1));
    }
    expect(Object.keys(cohort.players)).toHaveLength(23);
  });
  it("localizes reliable position codes while keeping unknown values explicit", () => {
    expect(historicalPositions(["P","DH"])).toBe("投手・指名打者"); expect(historicalPositions(["unknown"])).toBe("unknown");
    expect(collectedSeasonsLabel([2025,2020,2025,2023])).toBe("2020–2025 · 3シーズン");
  });
  it("uses neutral name marks rather than unauthorized photographs or team marks", () => {
    expect(wrap(<Monogram name="大谷翔平" />)).toContain("大谷"); expect(wrap(<Monogram name="Long Player Name" />)).not.toMatch(/<img|https:/);
  });
  it("falls back to the system theme for unavailable or corrupt settings", () => {
    expect(parseTheme(null)).toBe("system"); expect(parseTheme("broken")).toBe("system"); expect(parseTheme("dark")).toBe("dark"); expect(parseTheme("light")).toBe("light");
  });
});
