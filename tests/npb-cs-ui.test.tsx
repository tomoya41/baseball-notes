// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { NpbCsScreen } from "../src/ui/npb-cs";
import { readNpbCs } from "../src/application/npb-cs-reader";
import { canonicalDeepLink } from "../src/domain/native-navigation";
vi.mock("../src/application/npb-cs-reader", () => ({ readNpbCs: vi.fn() }));
const id = "00000000-0000-4000-8000-000000000001";
const fixture = { observedAt: "2026-10-16T05:00:00Z", sources: [{ pageId: 5301694, title: "架空のテスト用記事", revision: 123 }], games: [{ id: "npb:game:aaaaaaaaaaaaaaaaaaaa", date: "2026-10-10", homeTeamId: "npb:team:lions", awayTeamId: "npb:team:fighters", homeScore: 3, awayScore: 2, stage: "npb_cs_first" }], players: Array.from({ length: 31 }, (_, i) => ({ playerId: i ? `${id}-${i}` : id, name: `架空の長いテスト選手${i}` })), rows: Array.from({ length: 31 }, (_, i) => ({ gameIds: ["npb:game:aaaaaaaaaaaaaaaaaaaa"], aggregate: { playerId: i ? `${id}-${i}` : id, teamId: "npb:team:lions", role: "batting", scope: { stage: "npb_cs_first" } } })) };
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
function Location() { return <output>{useLocation().search}</output>; }
async function mount(query = "") {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.mocked(readNpbCs).mockResolvedValue(fixture as never);
  const div = document.createElement("div"), root = createRoot(div);
  await act(async () => root.render(<MemoryRouter initialEntries={[`/NPB/cs${query}`]}><Location /><NpbCsScreen /></MemoryRouter>));
  return { div, close: async () => { await act(async () => root.unmount()); } };
}
it("shows saved scores, partial coverage and per-revision credits without Current ranking claims", async () => {
  const { div, close } = await mount(); try { expect([...div.querySelectorAll('.scoreboard-side>strong')].map(e=>e.textContent)).toEqual(["2","3"]); expect(div.textContent).toContain("一部試合・一部選手"); expect(div.textContent).toContain("完全収録ではありません"); expect(div.querySelector('a[href*="oldid=123"]')).not.toBeNull(); expect(div.querySelectorAll("a.player-row")).toHaveLength(30); } finally { await close(); }
});
it("pages and filters through URL state without rendering an unbounded list", async () => {
  const { div, close } = await mount(); try {
    await act(async () => { [...div.querySelectorAll("button")].find(b => b.textContent === "次へ")!.click(); });
    expect(div.querySelector("output")?.textContent).toContain("page=2"); expect(div.querySelectorAll("a.player-row")).toHaveLength(1);
    const role = [...div.querySelectorAll("select")][1]!;
    await act(async () => { role.value = "pitching"; role.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(div.querySelector("output")?.textContent).not.toContain("page="); expect(div.textContent).toContain("条件に一致する収録選手はいません");
  } finally { await close(); }
});
it.each(["?season=2027", "?role=unknown", "?stage=japan_series"])("does not fetch unadmitted URL %s", async query => {
  const { div, close } = await mount(query); try { expect(readNpbCs).not.toHaveBeenCalled(); expect(div.textContent).toContain("未対応"); } finally { await close(); }
});
it("preserves CS native-link filters without accepting another year/stage", () => {
  expect(canonicalDeepLink("baseballnotes://NPB/cs?season=2026&stage=npb_cs_first&role=pitching&page=2")).toContain("stage=npb_cs_first&role=pitching&page=2");
  expect(canonicalDeepLink("baseballnotes://NPB/cs?season=2027")).toBeNull();
  expect(canonicalDeepLink("baseballnotes://MLB/cs?season=2026")).toBeNull();
});
