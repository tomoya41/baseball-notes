// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Services } from "../src/app/services";
import { NpbPlayer } from "../src/ui/npb-player";
it("announces a ready-but-empty Season outside closed profile details", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const playerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const response = { player: { id: playerId, name: "対象選手", teamId: "team", teamName: "球団" }, period: "season", asOfDate: "2026-10-11", batting: null, pitching: null };
  const services = { product: { player: async () => null }, directory: { findLatestNpb: async () => ({ effectiveDate: "2026-10-11", players: [{ playerId, displayName: "対象選手", position: null }], teams: [] }) }, recent: { find: async (_id: string, period: string) => period === "season" ? response : null }, gameLog: { find: async () => null } } as unknown as Services;
  const element = document.createElement("div"), root = createRoot(element);
  try { await act(async () => root.render(<MemoryRouter initialEntries={[`/NPB/players/${playerId}`]}><Routes><Route path="/NPB/players/:playerId" element={<NpbPlayer services={services} favorites={[]} saving={false} toggle={() => {}} />} /></Routes></MemoryRouter>)); const notices = [...element.querySelectorAll(".data-state")].filter(node => node.textContent?.includes("保存済みシーズン成績はありません")); expect(notices.some(node => node.closest("details") === null)).toBe(true); expect(element.querySelectorAll(".headline-stats dd")).toHaveLength(0); }
  finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
