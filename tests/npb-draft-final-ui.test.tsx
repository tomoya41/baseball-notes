// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { NpbFinalDraft } from "../src/ui/npb-draft-final";
import { readNpbFinalDraft } from "../src/application/npb-draft-final-reader";
import { finalDraftForecastSchema } from "../src/domain/npb-draft-final";
import json from "../src/data/npb-draft-2026-final-forecast.json";
import { draftFixture } from "./fixtures/npb-draft";
import { draftEventQuery } from "../src/domain/npb-draft-query";
import { portableRoute } from "../src/domain/product-sharing";
import { canonicalDeepLink } from "../src/domain/native-navigation";
vi.mock("../src/application/npb-draft-final-reader", () => ({ readNpbFinalDraft: vi.fn() }));
// Exact legacy identity check is exercised against the archived base during build and domain tests. Synthetic UI never invents provider observations.
vi.mock("../src/domain/npb-draft-final", async original => ({ ...await original<typeof import("../src/domain/npb-draft-final")>(), assertFinalDraftBase: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
async function mount(view = "preview", team = "all", q = "", fail = false) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(readNpbFinalDraft).mockImplementation(async () => { if (fail) throw Error("offline"); return finalDraftForecastSchema.parse(json); });
  const host = document.createElement("div"), root = createRoot(host); document.body.append(host);
  await act(async () => root.render(<MemoryRouter><NpbFinalDraft base={draftFixture()} team={team} view={view} q={q} group="all" onSearch={vi.fn()} onGroup={vi.fn()} /></MemoryRouter>));
  return { host, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}
it("shows all 36 active choices, distinct first bids, qualification and frozen information times", async () => {
  const f = await mount(); try {
    expect(f.host.querySelectorAll("article > a.player-row")).toHaveLength(36);
    expect(f.host.textContent).toContain("保留0枠"); expect(f.host.textContent).toContain("初回入札予想");
    expect(f.host.textContent).toContain("抽選敗退後"); expect(f.host.textContent).toContain("学生30人");
    expect(f.host.textContent).toContain("社会人5人"); expect(f.host.textContent).toContain("NPBドラフト対象者欄");
    expect(f.host.textContent).toContain("別シナリオ"); expect(f.host.querySelectorAll('a[href*="oldid="]')).toHaveLength(28);
    expect(readNpbFinalDraft).toHaveBeenCalledTimes(1);
  } finally { await f.close(); }
});
it("filters one club to three selections without losing source and candidate navigation", async () => {
  const f = await mount("preview", "npb:team:giants"); try {
    expect(f.host.querySelectorAll("article")).toHaveLength(3);
    expect(f.host.querySelector('a[href*="forecast=final"]')).not.toBeNull();
    expect(f.host.textContent).toContain("榊原七斗"); expect(f.host.textContent).toContain("確認済み支配下指名は未収録");
  } finally { await f.close(); }
});
it("finds new individually verified candidates and keeps rejected targets out of the active pool", async () => {
  const f = await mount("candidates", "all", "藤澤"); try { expect(f.host.querySelectorAll("article")).toHaveLength(1); expect(f.host.textContent).toContain("在籍2年目"); } finally { await f.close(); }
  const g = await mount("candidates", "all", "山田凜虎"); try { expect(g.host.querySelectorAll("article")).toHaveLength(0); expect(g.host.textContent).toContain("掲載なしを指名資格なし"); } finally { await g.close(); }
});
it("provides explicit retry and never silently uses a held old forecast after final asset failure", async () => {
  const f = await mount("preview", "all", "", true); try { expect(f.host.textContent).toContain("直前最終予想を取得できません"); expect(f.host.querySelectorAll("article")).toHaveLength(0); expect(f.host.querySelector("button")!.textContent).toBe("再試行"); } finally { await f.close(); }
});
it("preserves archived URL meanings and final forecast deep links", () => {
  expect(draftEventQuery(new URLSearchParams()).forecast).toBe("latest");
  for (const edition of ["final", "latest", "expanded", "original"]) {
    const q = `view=preview&team=npb%3Ateam%3Agiants&forecast=${edition}`;
    expect(draftEventQuery(new URLSearchParams(q)).valid).toBe(true);
    expect(portableRoute("/NPB/talent/2026", q)).toBe("/NPB/talent/2026?" + q);
    expect(canonicalDeepLink("baseballnotes://NPB/talent/2026?" + q)).toBe("/NPB/talent/2026?" + q);
  }
});
