import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PlayerTabs, Monogram, ScoreboardRow, ScoreHero, DateRibbon } from "../src/ui/design-system";
import { MetricLabel } from "../src/ui/components";
import { metricHelp } from "../src/presentation/metric-help";
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
    for (const label of ["概要", "成績", "分析", "試合別", "選手情報"]) expect(html).toContain(label);
  });
  it.each(Object.keys(futureSections) as (keyof typeof futureSections)[])("%s is explicitly planned, with no fabricated data", feature => {
    const html = wrap(<FutureFeatureScreen feature={feature} league="NPB" />);
    expect(html).toContain("COMING SOON"); expect(html).toContain("現在、この機能のデータは表示していません");
    expect(html).not.toMatch(/<table|metric-tile|profile-photo|順位.*1位/);
  });
  it("groups future destinations away from current Home while preserving game and records access", () => {
    const html = wrap(<ExploreScreen league="NPB" />);
    for (const path of ["schedule", "records", "moves", "talent", "preseason", "matchup", "watch", "milestones"]) expect(html).toContain(`/NPB/${path}`);
    for (const label of ["選手移動・FA・Posting", "Draft履歴・若手探索"]) expect(html).toContain(label);
    expect(wrap(<ExploreScreen league="MLB" />)).toContain("ドラフト・プロスペクト");
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

describe("compact scoreboards and contextual metric help", () => {
  it("preserves score zero, unknown score, canonical routes and confirmed partial status", () => {
    const html = wrap(<ScoreboardRow to="/NPB/games/npb%3Agame%3Aone" home="阪神" away="DeNA" homeScore={0} awayScore={null} status="開始前" gameNumber={2} partial />);
    expect(html).toContain("npb%3Agame%3Aone"); expect(html).toMatch(/<strong[^>]*>0<\/strong>/); expect(html).toMatch(/<strong[^>]*>—<\/strong>/);
    expect(html).toContain("第2試合"); expect(html).toContain("一部データ確認中"); expect(html).not.toContain("scoreboard-winner");
  });
  it("marks a known leading score without inventing a game completion state", () => {
    const html = wrap(<ScoreboardRow to="/MLB/games/canonical" home="ホーム" away="ビジター" homeScore={1} awayScore={2} status="中断" />);
    expect(html).toContain("scoreboard-winner"); expect(html).toContain("中断"); expect(html).not.toContain("試合終了");
  });
  it("retains full club identity while giving long Japanese names a readable line boundary", () => {
    const html = wrap(<ScoreboardRow to="/MLB/games/canonical" home="ロサンゼルス・エンゼルス" away="ヒューストン・アストロズ" homeScore={2} awayScore={6} status="試合終了" />);
    expect(html).toContain("ビジター ヒューストン・アストロズ 6、ホーム ロサンゼルス・エンゼルス 2");
    expect(html).toContain('class="club-context">ヒューストン');
    expect(html).toContain('<span>アストロズ</span>');
  });
  it("keeps the central game hero's zero and unavailable scores distinct", () => {
    const html = wrap(<ScoreHero home="阪神" away="DeNA" homeScore={0} awayScore={null} status="中断" />);
    expect(html).toContain('role="group"'); expect(html).toContain("得点未確認");
    expect(html).toContain("—<i"); expect(html).toContain("</i>0"); expect(html).toContain("中断");
    expect(html).not.toContain("試合終了");
  });
  it("bounds the quick calendar to the imported season, across month boundaries", () => {
    const html = wrap(<DateRibbon date="2025-04-01" min="2025-03-31" max="2025-04-02" onChange={() => {}} />);
    for (const date of ["2025-03-31", "2025-04-01", "2025-04-02"]) expect(html).toContain(`aria-label="${date}"`);
    expect(html).not.toContain('aria-label="2025-03-30"'); expect(html).not.toContain('aria-label="2025-04-03"');
    expect(html).toContain('aria-label="2025-04-01" aria-pressed="true"');
    expect(wrap(<DateRibbon date="2025-03-31" min="2025-03-31" max="2025-04-02" onChange={() => {}} />)).toContain('aria-label="前日" disabled=""');
    expect(wrap(<DateRibbon date="2025-04-02" min="2025-03-31" max="2025-04-02" onChange={() => {}} />)).toContain('aria-label="翌日" disabled=""');
    for (const date of ["broken", "2025-02-30", "2026-04-01"]) expect(wrap(<DateRibbon date={date} min="2025-03-31" max="2025-04-02" onChange={() => {}} />)).toBe("");
  });
  it.each(["OPS", "OBP", "SLG", "K9", "K/9", "BF", "RISP", "PA", "AB", "IP", "outsRecorded"])("%s has a local accessible explanation", key => {
    const definition = metricHelp(key)!; expect(definition.description).toBeTruthy(); expect(definition.interpretation).toBeTruthy();
    const html = wrap(<MetricLabel metric={key} />);
    expect(html).toContain(`aria-label="${definition.name}の説明"`); expect(html).toContain('aria-haspopup="dialog"'); expect(html).not.toContain("<dialog"); expect(html).not.toMatch(/href=|<img/);
  });
  it("explains OBP denominator, SLG meaning and RISP context without evaluative labels", () => {
    expect(metricHelp("OBP")!.description).toContain("打数＋四球＋死球＋犠飛");
    expect(metricHelp("SLG")!.interpretation).toContain("長打の割合そのものではありません");
    expect(metricHelp("bases:risp")).toEqual(metricHelp("RISP")); expect(metricHelp("BF")!.interpretation).toContain("良し悪しは判断しません");
    expect(metricHelp("unknown-metric")).toBeUndefined();
  });
});
