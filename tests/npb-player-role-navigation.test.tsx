// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Services } from "../src/app/services";
import { NpbPlayer } from "../src/ui/npb-player";
import { NpbPlayerInternational } from "../src/ui/npb-player-international";

vi.mock("../src/ui/player-season", () => ({ PlayerSeasonView: ({ pitcherBatting }: { pitcherBatting?: boolean }) => <output data-testid="season-role">{pitcherBatting ? "secondary batting" : "standard batting"}</output> }));
afterEach(() => vi.unstubAllGlobals());
it.each(["P", "IF", null])("keeps the %s batting display policy consistent between overview and Stats", async position => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const playerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const services = {
    product: { player: async () => null },
    directory: { findLatestNpb: async () => ({ players: [{ playerId, displayName: "対象選手", position }], teams: [] }) },
    recent: { find: async () => null }, gameLog: { find: async () => null },
  } as unknown as Services;
  const element = document.createElement("div"), root = createRoot(element);
  try {
    for (const section of ["", "/stats"]) {
      await act(async () => root.render(<MemoryRouter key={section} initialEntries={[`/NPB/players/${playerId}${section}`]}><Routes><Route path="/NPB/players/:playerId/:section?" element={<NpbPlayer services={services} favorites={[]} saving={false} toggle={() => {}} />} /></Routes></MemoryRouter>));
      expect(element.querySelector('[data-testid="season-role"]')?.textContent).toBe(position === "P" ? "secondary batting" : "standard batting");
      const role = position === "P" ? "pitching" : "batting";
      const annual = `/NPB/players/${playerId}/seasons?season=2026&role=${role}`;
      expect(element.querySelector(".player-fixed-scope")?.getAttribute("href")).toBe(annual);
      if (!section) expect(element.querySelector('[aria-label="ほかの選手と比較"]')?.getAttribute("href"))
        .toBe(`/NPB/compare?players=${playerId}&role=${role}`);
    }
  } finally { await act(async () => root.unmount()); }
});

it("groups the confirmed Japan career by tournament and links to its individual sections", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const element = document.createElement("div"), root = createRoot(element);
  try {
    await act(async () => root.render(<MemoryRouter>
      <NpbPlayerInternational playerId="1581526b-5601-4a6b-8b4e-021709be1e47"/>
    </MemoryRouter>));
    expect(element.querySelector("details")?.open).toBe(false);
    const edition = [...element.querySelectorAll("li")].find(row => row.querySelector("h3")?.textContent === "APBC 2023")!;
    const links = [...edition.querySelectorAll("a")].map(link => [link.textContent, new URL(link.href).searchParams.get("section")]);
    expect(links).toEqual([
      ["大会MVP · 大会ベストナイン（二塁手）", "awards"], ["4試合で出場を確認", "appearances"], ["代表に選出", "selections"],
    ]);
    await act(async () => root.render(<MemoryRouter>
      <NpbPlayerInternational playerId="64c9071f-f9df-4227-afb5-faee4fc73d0d"/>
    </MemoryRouter>));
    expect(element.querySelector('a[href$="statRole=pitching"]')?.textContent).toMatch(/投球 · \d登板/);
    await act(async () => root.render(<MemoryRouter><NpbPlayerInternational playerId="unknown"/></MemoryRouter>));
    expect(element.textContent).toBe("");
  } finally { await act(async () => root.unmount()); }
});
