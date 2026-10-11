// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Services } from "../src/app/services";
import { NpbPlayer } from "../src/ui/npb-player";

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
    }
  } finally { await act(async () => root.unmount()); }
});
