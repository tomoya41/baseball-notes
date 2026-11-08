// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it } from "vitest";
import { NpbSeasonEntry } from "../src/ui/npb-season-entry";

it("shows official notices separately from app collection and preserves the 2026 return URL", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={["/NPB/players/npb:player:example?season=2027&date=2027-03-26&view=batting"]}>
      <Routes><Route path="/NPB/*" element={<NpbSeasonEntry/>}/></Routes>
    </MemoryRouter>));
    const notice = container.querySelector('[aria-labelledby="npb-official-schedule"]');
    expect(notice?.textContent).toContain("公式発表済み");
    expect(notice?.textContent).toContain("2027年3月26日開幕予定");
    expect([...notice!.querySelectorAll("a")].map(a => a.href)).toEqual([
      "https://npb.jp/games/2027/", "https://npb.jp/news/detail/20261104_03.html", "https://npb.jp/news/detail/20261104_02.html",
    ]);
    expect(container.textContent).toContain("アプリに日程は未登録");
    expect(container.textContent).toContain("試合結果・選手成績も未取得");
    expect(container.textContent).not.toMatch(/試合なし|0勝|完全収録/);
    expect([...container.querySelectorAll("a")].find(a => a.textContent?.includes("2026年の保存データ"))?.getAttribute("href"))
      .toBe("/NPB/players/npb:player:example?season=2026&view=batting");
    expect(container.querySelector('a[href="/NPB/my"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
