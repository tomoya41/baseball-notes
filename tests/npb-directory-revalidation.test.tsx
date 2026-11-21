// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildNpbCatalog } from "../src/application/npb-product-payload";
import type { Services } from "../src/app/services";
import { npbTeams } from "../src/data/npb-nf3";
import type { NpbPlayerDirectory } from "../src/domain/npb-player-directory";
import type { Favorite } from "../src/domain/models";
import { NpbHomeFollowing } from "../src/ui/npb-home-following";
import { NpbSavedPlayers } from "../src/ui/npb-my";
import { NpbPlayer } from "../src/ui/npb-player";
import { NpbPlayerSearch } from "../src/ui/npb-player-search";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const favorite: Favorite = { league: "NPB", kind: "player", entityId: id, addedAt: "2026-09-25T00:00:00.000Z" };
const teams = npbTeams.map(team => ({ id: team.id, name: team.name, shortName: team.short }));
const before: NpbPlayerDirectory = {
  schemaVersion: 2, league: "NPB", effectiveDate: "2026-10-08", generatedAt: "2026-10-09T00:00:00.000Z", teams,
  players: [{ playerId: id, displayName: "確認済み選手", teamId: "npb:team:tigers", position: "C", playerType: "fielder",
    birthDate: null, birthPlace: null, nationality: null, bats: null, throws: null,
    battingAvailable: true, pitchingAvailable: false, recentAvailable: true }],
};
const after: NpbPlayerDirectory = { ...before, effectiveDate: "2026-10-12", generatedAt: "2026-10-13T00:00:00.000Z",
  players: [{ ...before.players[0]!, teamId: "npb:team:swallows" }] };

beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function resumeClock() {
  let time = 0;
  vi.spyOn(performance, "now").mockImplementation(() => time);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  return () => act(async () => {
    time += 31_000;
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

it("keeps the selected player and suppresses an old number while the new catalog is unavailable", async () => {
  const resume = resumeClock();
  const createProfile = (directory: NpbPlayerDirectory, uniformNumber: string) => {
    const player = buildNpbCatalog(directory, { observedAt: directory.generatedAt, effectiveDate: null, players: [] }).players[0]!;
    return { ...player, membership: { ...player.membership, uniformNumber } };
  };
  const findLatestNpb = vi.fn().mockResolvedValueOnce(before).mockResolvedValue(after);
  const player = vi.fn().mockResolvedValueOnce(createProfile(before, "12"))
    .mockRejectedValueOnce(new Error("Different publication"))
    .mockResolvedValue(createProfile(after, "34"));
  const recent = vi.fn().mockResolvedValue(null);
  const deps = { directory: { findLatestNpb }, product: { player }, recent: { find: recent },
    gameLog: { find: vi.fn().mockResolvedValue(null) } } as unknown as Services;
  const host = document.createElement("div"), root = createRoot(host);
  document.body.append(host);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[`/NPB/players/${id}`]}><Routes>
      <Route path="/NPB/players/:playerId" element={<NpbPlayer services={deps} favorites={[favorite]} saving={false} toggle={() => {}} />} />
    </Routes></MemoryRouter>));
    expect(host.querySelector(".player-uniform-number")?.textContent).toBe("#12");
    await resume();
    expect(host.querySelector(".player-identity")?.textContent).toContain("ヤクルト");
    expect(host.querySelector(".player-identity")?.textContent).toContain("2026-10-12時点");
    expect(host.querySelector(".player-uniform-number")).toBeNull();
    const calls = recent.mock.calls.length;
    await resume();
    expect(host.querySelector(".player-uniform-number")?.textContent).toBe("#34");
    expect(host.querySelector('.player-identity button[aria-pressed="true"]')).not.toBeNull();
    expect(recent).toHaveBeenCalledTimes(calls);
    expect(player).toHaveBeenLastCalledWith(id, after);
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it("keeps queries and saved player links when the public directory cannot be refreshed", async () => {
  const resume = resumeClock();
  const findLatestNpb = vi.fn().mockResolvedValue(before);
  const repository = { findLatestNpb };
  const query = `?q=${encodeURIComponent(before.players[0]!.displayName)}&role=batter`;
  function Address() { return <output>{useLocation().search}</output>; }
  const host = document.createElement("div"), root = createRoot(host);
  document.body.append(host);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[`/NPB/search${query}`]}>
      <NpbPlayerSearch repository={repository}/><NpbHomeFollowing repository={repository} favorites={[favorite]}/>
      <NpbSavedPlayers repository={repository} favorites={[favorite]} saving={false} toggle={() => {}}/><Address/>
    </MemoryRouter>));
    expect(host.querySelectorAll(`a[href="/NPB/players/${id}"]`)).toHaveLength(3);
    findLatestNpb.mockRejectedValue(new Error("HTTP 503"));
    await resume();
    expect(host.querySelectorAll(`a[href="/NPB/players/${id}"]`)).toHaveLength(3);
    expect(host.querySelector(".npb-player-search [role=status]")?.textContent).toContain("保存済みの選手一覧");
    expect(host.querySelector("output")?.textContent).toBe(query);
    findLatestNpb.mockResolvedValue(after);
    await resume();
    expect(host.querySelector(".npb-directory-row")?.textContent).toContain("ヤクルト");
    expect(host.querySelector(".home-following-player")?.textContent).toContain("ヤクルト");
    expect(host.querySelector(".saved-player-entry")?.textContent).toContain("ヤクルト");
    expect(host.querySelector(".npb-player-search [role=status]")).toBeNull();
    expect(host.querySelector("output")?.textContent).toBe(query);
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it("retries an unavailable directory without losing search filters or saved player identity", async () => {
  const read = () => vi.fn().mockRejectedValueOnce(Error("HTTP 503")).mockResolvedValue(before);
  const searchRead = read(), savedRead = read();
  const query = `?q=${encodeURIComponent(before.players[0]!.displayName)}&team=npb%3Ateam%3Atigers&role=batter`;
  const host = document.createElement("div"), root = createRoot(host);
  function Address() { return <output>{useLocation().search}</output>; }
  const toggle = vi.fn();
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={[`/NPB/search${query}`]}>
      <NpbPlayerSearch repository={{ findLatestNpb: searchRead }} />
      <section className="my-test"><NpbSavedPlayers repository={{ findLatestNpb: savedRead }} favorites={[favorite]} saving={false} toggle={toggle} /></section>
      <Address />
    </MemoryRouter>));
    expect(host.querySelector(".saved-player-entry a")?.getAttribute("href")).toBe(`/NPB/players/${id}`);
    expect(host.querySelector(".saved-player-actions")).toBeNull();
    for (const selector of [".npb-player-search", ".my-test"]) {
      const buttons = [...host.querySelectorAll<HTMLButtonElement>(`${selector} button`)];
      const retry = buttons.find(button => button.textContent === "選手情報を再読み込み")!;
      await act(async () => retry.click());
    }
    expect(host.querySelector(".npb-directory-row")?.textContent).toContain("確認済み選手");
    expect(host.querySelector(".saved-player-entry")?.textContent).toContain("確認済み選手");
    expect(host.querySelector("output")?.textContent).toBe(query);
    expect(toggle).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); }
});
