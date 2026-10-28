// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { HonorsScreen } from "../src/ui/player-honors";
import { contextReader } from "../src/application/baseball-context-reader";
import { buildHonorCatalog } from "../src/domain/honor-discovery";
import type { Honor, HonorsPage } from "../src/domain/player-honors";
vi.mock("../src/application/baseball-context-reader", () => ({ contextReader: { manifest: vi.fn(), honors: vi.fn(), catalog: vi.fn(), recipient: vi.fn() } }));
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });
const a = "lahman:fixture01", b = "lahman:fixture02";
const row = (id: string, recipientId: string, year: number): Honor => ({ id: id.repeat(64), recipientId, league: "MLB", year, division: "NL", awardId: "mlb_mvp", name: "MVP", sourceName: "Most Valuable Player", kind: "award", position: null, seasonTeams: [{ name: recipientId === a ? "Prior Club" : "Other Club", id: null }], joint: null, sourceId: "s", evidenceSha256: "a".repeat(64), reportedCareerWins: null });
const page: HonorsPage = { schemaVersion: 1, records: [row("a", a, 1990), row("b", a, 2004), row("c", b, 2001)], recipients: [a, b].map(id => ({ id, name: "Same Name", identityStatus: "verified", links: [], externalIds: {}, counts: { mlb_mvp: id === a ? 2 : 1 } })), sources: [{ id: "s", name: "Fixture authors", url: "https://example.test/revision", license: "CC-BY-SA-3.0", sha256: "c".repeat(64) }] };
const catalog = buildHonorCatalog("MLB", page.records, page.recipients);
function setup() {
  vi.mocked(contextReader.manifest).mockResolvedValue({ schemaVersion: 1, observedAt: "2026-10-27T21:00:00Z", cutoff: 2025, coverage: "partial", attribution: "Fixture", years: { NPB: [], MLB: [2004, 2001, 1990] }, counts: { MLBRows: 3 }, files: {} });
  vi.mocked(contextReader.catalog).mockResolvedValue(catalog);
  vi.mocked(contextReader.recipient).mockResolvedValue(page);
}
async function mount(path: string) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><HonorsScreen league="MLB" /></MemoryRouter>));
  return { host, close: async () => { await act(async () => root.unmount()); } };
}
it("opens collected lifetime honors for an unlinked winner without fabricated statistics or a canonical profile", async () => {
  setup(); const f = await mount(`/MLB/awards?recipient=${a}`);
  try {
    expect(contextReader.honors).not.toHaveBeenCalled();
    expect(contextReader.recipient).toHaveBeenCalledExactlyOnceWith("MLB", a);
    expect(f.host.querySelectorAll(".honors-list li")).toHaveLength(2);
    expect(f.host.textContent).toContain("年度成績は未収録");
    expect(f.host.textContent).not.toContain("Other Club");
    expect(f.host.querySelectorAll('a[href*="/players/"]')).toHaveLength(0);
    expect(f.host.querySelector('a[href="https://example.test/revision"]')).not.toBeNull();
    const year = f.host.querySelector<HTMLSelectElement>('select')!;
    await act(async () => { year.value = "1990"; year.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(f.host.querySelectorAll(".honors-list li")).toHaveLength(1);
    expect(contextReader.recipient).toHaveBeenCalledOnce();
  } finally { await f.close(); }
});
it("searches source recipients without joining same names and caps the rendered directory", async () => {
  setup(); const f = await mount("/MLB/awards?view=players&q=Same");
  try {
    expect(f.host.querySelectorAll(".honors-player-link")).toHaveLength(2);
    expect(f.host.querySelectorAll(".honors-player-link")[0]?.getAttribute("href")).not.toBe(f.host.querySelectorAll(".honors-player-link")[1]?.getAttribute("href"));
    expect(contextReader.recipient).not.toHaveBeenCalled();
    expect(contextReader.honors).not.toHaveBeenCalled();
  } finally { await f.close(); }
});
it("keeps invalid and unknown identities separate from an empty career and makes no recipient request", async () => {
  for (const [id, message] of [["npb:12345678", "条件を確認"], ["lahman:unknown01", "この選手の表彰歴は未収録"]]) {
    setup(); const f = await mount(`/MLB/awards?recipient=${id}`);
    try { expect(f.host.textContent).toContain(message); expect(contextReader.recipient).not.toHaveBeenCalled(); }
    finally { await f.close(); }
  }
});
it("keeps a failed request distinct from missing data and retries only on an explicit action", async () => {
  setup(); vi.mocked(contextReader.catalog).mockRejectedValueOnce(Error("503"));
  const f = await mount("/MLB/awards?view=players");
  try {
    expect(f.host.textContent).toContain("読み込めません");
    expect(f.host.textContent).not.toContain("0人");
    const retry = [...f.host.querySelectorAll("button")].find(b => b.textContent === "再試行")!;
    await act(async () => retry.click());
    expect(contextReader.catalog).toHaveBeenCalledTimes(2);
    expect(f.host.querySelectorAll(".honors-player-link")).toHaveLength(2);
  } finally { await f.close(); }
});
