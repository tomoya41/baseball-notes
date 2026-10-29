// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { GameMvp } from "../src/ui/game-mvp";
import { npbGameMvpInput } from "../src/domain/game-mvp";
import { mvpFixture } from "./fixtures/daily-mvp";
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; document.body.innerHTML = ""; vi.restoreAllMocks(); });
async function render(input = npbGameMvpInput(mvpFixture().game), scope = "") {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<MemoryRouter><GameMvp input={input} playerScope={scope}/></MemoryRouter>));
  return host;
}
it("immediately presents this game's evidence and player link without fetching other games", async () => {
  const request = vi.spyOn(globalThis, "fetch"), host = await render();
  expect(host.textContent).toContain("この試合のMVP"); expect(host.textContent).toContain("独自選出");
  expect(host.querySelector("a")?.getAttribute("href")).toBe("/NPB/players/00000000-0000-4000-8000-000000000001");
  expect(host.textContent).toContain("4打数3安打・1本塁打・3打点"); expect(request).not.toHaveBeenCalled();
});
it("does not fill missing player data or claim a game MVP when the box is partial", async () => {
  const host = await render({ ...npbGameMvpInput(mvpFixture().game), complete: false });
  expect(host.textContent).toContain("一部未収録"); expect(host.querySelector("a")).toBeNull();
});
it("preserves the selected season and competition in player navigation", async () => {
  const host = await render(npbGameMvpInput(mvpFixture().game), "?season=2025&competition=regular");
  expect(host.querySelector("a")?.getAttribute("href")).toContain("?season=2025&competition=regular");
});
it("shows a two-way player's tied batting and pitching evidence under one player link", async () => {
  const value = npbGameMvpInput(mvpFixture().game);
  value.pitching = value.pitching.map((p, i) => i === 1 ? { ...p, playerId: value.batting[1]!.playerId, name: value.batting[1]!.name, outsRecorded: 18, so: 6, runs: 0, er: 0 } : p);
  const host = await render(value);
  expect(host.querySelectorAll('.game-mvp__player')).toHaveLength(1);
  expect(host.querySelectorAll('.game-mvp__player span')).toHaveLength(2);
});
