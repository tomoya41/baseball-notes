// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NpbClubComparison } from "../src/ui/npb-club-comparison";
import { historicalBattingKeys, npbHistoricalRowSchema } from "../src/domain/npb-historical";

const id = "00000000-0000-4000-8000-000000000001";
const row = (season: number, teamId: string, pa: number | null) => npbHistoricalRowSchema.parse({ playerId: id, season, teamId, role: "batting",
  metrics: {...Object.fromEntries(historicalBattingKeys.map(k => [k, null])), PA: pa, AB: 100, H: 30, HR: 5} });
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => vi.unstubAllGlobals());
it("shows exact collected club years and samples, linked annual detail, missing values and preserved source access", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  document.body.appendChild(host);
  const sources = document.createElement("aside"); sources.id = "historical-comparison-sources"; sources.tabIndex = -1;
  sources.scrollIntoView = vi.fn(); document.body.appendChild(sources);
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  try {
    await act(async () => root.render(<MemoryRouter><NpbClubComparison rows={[row(2022, "npb:team:tigers", 120), row(2025, "npb:team:giants", null)]} years={[2022, 2024, 2025]} metric="OPS" teamName={t => t.endsWith("tigers") ? "架空の長い球団名・甲" : "架空の球団乙"} /></MemoryRouter>));
    expect(host.querySelector("summary")?.textContent).toBe("球団別に見比べる · 2球団");
    expect(host.textContent).toContain("収録年度：2022年 · 120打席");
    expect(host.textContent).toContain("収録年度：2025年 · 母数未収録");
    expect(host.textContent).toContain("2024年のこの役割は未収録");
    expect(host.textContent).toContain("移籍日・移籍理由");
    expect(host.querySelectorAll(".comparison-bar__track span")).toHaveLength(0);
    const sourceButton = [...host.querySelectorAll("button")].find(b => b.textContent === "この比較の出典・利用条件")!;
    await act(async () => sourceButton.click());
    expect(document.activeElement).toBe(sources); expect(sources.scrollIntoView).toHaveBeenCalled();
    expect(host.querySelector('a[href="#historical-comparison-sources"]')).toBeNull(); // Hash Router route must not change.
    expect([...host.querySelectorAll("a")].map(a => a.getAttribute("href"))).toContain(`/NPB/players/${id}/seasons?season=2025&role=batting&years=2025`);
    await act(async () => { host.querySelector("details")!.open = true; });
    expect(fetch).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); host.remove(); sources.remove(); }
});
it("does not manufacture a second club for single-club or absent observations", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<MemoryRouter><NpbClubComparison rows={[row(2025, "npb:team:tigers", 120)]} years={[2024, 2025]} metric="HR" teamName={t => t} /></MemoryRouter>));
    expect(host.textContent).toBe("");
    await act(async () => root.render(<MemoryRouter><NpbClubComparison rows={[]} years={[2025]} metric="HR" teamName={t => t} /></MemoryRouter>));
    expect(host.textContent).toBe("");
  } finally { await act(async () => root.unmount()); }
});
