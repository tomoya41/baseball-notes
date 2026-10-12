import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { HeadlineStats, HomeDiscover, PlayerIdentity, TeamRecord } from "../src/ui/signature";
import { ComparisonBars } from "../src/ui/comparison-bars";
import type { ComparisonRow } from "../src/domain/product-comparison";

const render = (element: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
describe("reconstructed sports presentation boundaries", () => {
  it("keeps a partial Season cutoff and unknown headline visible, with local metric help", () => {
    const html = render(<HeadlineStats title="2026 打撃 · 2026-10-07まで" partial stats={[{ metric: "OPS", value: "—" }, { metric: "HR", value: "0" }]} />);
    expect(html).toContain("2026-10-07まで"); expect(html).toContain("一部未収集");
    expect(html).toContain("<dd>—</dd>"); expect(html).toContain("<dd>0</dd>");
    expect(html).toContain('aria-label="OPSの説明"'); expect(html).not.toContain("2026-10-11");
  });
  it("identifies the player without inventing a portrait, number or current-roster claim", () => {
    const html = render(<PlayerIdentity name="非常に長い選手の登録名" context="2024 MLB · 公式戦" detail="収録球団" favorite={<button>お気に入り</button>} />);
    expect(html).toContain("<h1>非常に長い選手の登録名</h1>");
    expect(html).not.toMatch(/<svg|<img|背番号|現在所属/);
  });
  it("does not invent ties or replace unavailable team results with zero", () => {
    const html = render(<TeamRecord wins={0} losses={null} />);
    expect(html).toContain("<dd>0</dd>"); expect(html).toContain("<dd>—</dd>"); expect(html).not.toContain("引分");
  });
  it("keeps the Historical discovery scope and exact as-of in portable routes", () => {
    const html = render(<HomeDiscover league="MLB" year={2014} date="2014-09-28" />);
    expect(html).toContain("/MLB/form?season=2014&amp;asOfDate=2014-09-28");
    for (const route of ["data", "compare", "teams", "history"]) expect(html).toContain(`/MLB/${route}?season=2014`);
    expect(html).toContain("過去記録"); expect(html).not.toContain("今日");
  });
  it("does not offer an alternate NPB HOT ranking through Home discovery", () => {
    const html = render(<HomeDiscover league="NPB" />);
    expect(html).toContain("/NPB/talent"); expect(html).not.toMatch(/rank|HOT|1位|月間MVP/);
  });
  it("shows real zero, partial and unavailable comparison values without imaginary bars", () => {
    const rows: ComparisonRow[] = [
      { id: "one", name: "零", season: 2024, date: "2024-09-30", coverage: "complete", metrics: { ERA: { value: 0, status: "complete" } } },
      { id: "two", name: "未提供", season: 2024, date: "2024-09-30", coverage: "unknown", metrics: { ERA: { value: 8, status: "unavailable" } } },
      { id: "three", name: "一部", season: 2024, date: "2024-09-30", coverage: "partial", metrics: { ERA: { value: 2.5, status: "partial" } } },
    ];
    const html = render(<ComparisonBars rows={rows} metric="ERA" />);
    expect(html).toContain("0.00"); expect(html).toContain("2.50 *"); expect(html).toContain("—");
    expect(html.match(/style="width:/g)).toHaveLength(2);
    expect(html).toContain("順位や優劣の判定ではありません"); expect(html).not.toContain("8.00");
  });
});
