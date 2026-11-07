// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { NpbPlayerProgression } from "../src/ui/npb-player-progression";
import { historicalPitchingKeys, npbHistoricalRowSchema } from "../src/domain/npb-historical";
import { portableRoute } from "../src/domain/product-sharing";
import { viewConditions } from "../src/domain/portable-conditions";

it("keeps adjacent club years, missing values and split-year totals distinct", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const row = (season: number, team: string, outsRecorded: number, ER: number | null) => npbHistoricalRowSchema.parse({
    playerId: id, season, teamId: `npb:team:${team}`, role: "pitching",
    metrics: { ...Object.fromEntries(historicalPitchingKeys.map(key => [key, null])), outsRecorded, ER },
  });
  const rows = [row(2021, "hawks", 90, 3), row(2022, "dragons", 180, null),
    row(2024, "dragons", 90, 10), row(2024, "giants", 180, 0)];
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const div = document.createElement("div"), root = createRoot(div);
  try {
    await act(async () => root.render(<MemoryRouter><NpbPlayerProgression rows={rows} years={[2021,2022,2023,2024]}
      teamName={team => team.split(":").at(-1)!} observedAt="2026-10-25T00:00:00Z" /></MemoryRouter>));
    const panel=div.querySelector('[aria-label="球団が異なる年度の成績差"]')!;
    expect(panel.querySelectorAll(".comparison-bar")).toHaveLength(2);
    expect(panel.querySelector(".club-year-delta")?.textContent).toContain("比較値を計算できません");
    expect(panel.textContent).toContain("2022年 · dragons");
    expect(panel.textContent).toContain("60.0回");
    expect(panel.textContent).toContain("2023年はこの役割の成績が未収録");
    expect(panel.textContent).toContain("保存版 2026-10-25");
    const breakdown=panel.querySelector(".club-year-breakdown")!;
    expect(breakdown.textContent).toContain("収録行の年度集計ERA 1.00 · 90.0回");
    expect(breakdown.textContent).toContain("giantsの球団別行ERA 0.00 · 60.0回");
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});

it("serializes only valid regular club comparisons for Saved Views and shared URLs", () => {
  const id = "00000000-0000-4000-8000-000000000001", path = `/NPB/players/${id}/seasons`;
  const params = new URLSearchParams({ player: id, season: "2025", role: "pitching", years: "2023,2024,2025", trendMetric: "ERA", clubYears: "2024,2025" });
  const saved = new URLSearchParams(viewConditions(params, true, "NPB"));
  expect(saved.get("clubYears")).toBe("2024,2025");
  expect(saved.get("years")).toBe("2023,2024,2025");
  expect(saved.get("trendMetric")).toBe("ERA");
  expect(portableRoute(path, params.toString())).toContain("clubYears=2024%2C2025");
  params.set("clubYears","2023,2025");
  expect(viewConditions(params, true, "NPB")).not.toContain("clubYears");
  expect(portableRoute(path,params.toString())).not.toContain("clubYears");
});

it("shows each year's sample, preserves a missing-year gap and excludes sub-threshold rate bests", async () => {
  const rows = [2023, 2025].map((season, i) => npbHistoricalRowSchema.parse({
    playerId: "00000000-0000-4000-8000-000000000001", season, teamId: "npb:team:tigers", role: "pitching",
    metrics: { ...Object.fromEntries(historicalPitchingKeys.map(k => [k, null])), outsRecorded: i ? 90 : 89, ER: i ? 1 : 0 },
  }));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const div = document.createElement("div"), root = createRoot(div);
  try {
    await act(async () => root.render(<MemoryRouter><NpbPlayerProgression rows={rows} years={[2023, 2024, 2025]} teamName={() => "架空球団"} /></MemoryRouter>));
    expect(div.querySelector(".explorer-values")?.textContent).toContain("29.2回");
    expect(div.querySelector(".explorer-values")?.textContent).toContain("30.0回");
    expect(div.querySelector(".explorer-values")?.textContent).toContain("2024年 · 未収録—母数未収録");
    expect(div.querySelectorAll('svg[role="img"] circle')).toHaveLength(2);
    expect(div.querySelectorAll('.progression-axis')).toHaveLength(3);
    expect(div.querySelectorAll('.progression-segment')).toHaveLength(0); // Grid lines never fabricate a missing year's trend.
    expect(div.querySelectorAll('.progression-value')[1]?.textContent).toBe('—');
    expect(div.querySelector('.progression-best')?.textContent).toContain("収録内最小値2025年 0.30");
    expect(div.querySelector('.progression-delta')?.textContent).toContain("—連続する前年の収録が必要");
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});

it("shows the difference between consecutive seasons in baseball innings", async () => {
  const rows = [25, 31].map((outsRecorded, i) => npbHistoricalRowSchema.parse({
    playerId: "00000000-0000-4000-8000-000000000001", season: 2024 + i, teamId: "npb:team:tigers", role: "pitching",
    metrics: { ...Object.fromEntries(historicalPitchingKeys.map(k => [k, null])), outsRecorded },
  }));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const div = document.createElement("div"), root = createRoot(div);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={["/?trendMetric=outsRecorded"]}>
      <NpbPlayerProgression rows={rows} years={[2024, 2025]} teamName={() => "架空球団"} />
    </MemoryRouter>));
    expect(div.querySelector('.progression-summary')?.textContent).toContain("最新収録 · 2025年10.1");
    expect(div.querySelector('.progression-delta')?.textContent).toContain("前年との差 · 2024年比+2.0回");
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});

it("uses proportional count bars and baseball innings labels while preserving zero and missing observations", async () => {
  const rows = [0, 31].map((outsRecorded, i) => npbHistoricalRowSchema.parse({
    playerId: "00000000-0000-4000-8000-000000000001", season: 2023 + i * 2, teamId: "npb:team:tigers", role: "pitching",
    metrics: { ...Object.fromEntries(historicalPitchingKeys.map(k => [k, null])), outsRecorded },
  }));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const div = document.createElement("div"), root = createRoot(div);
  try {
    await act(async () => root.render(<MemoryRouter initialEntries={["/?trendMetric=outsRecorded"]}><NpbPlayerProgression rows={rows} years={[2023, 2024, 2025]} teamName={() => "架空球団"} /></MemoryRouter>));
    const bars = [...div.querySelectorAll('.progression-bar')];
    expect(bars).toHaveLength(2);
    expect(bars[0]?.getAttribute('height')).toBe('0');
    expect(Number(bars[1]?.getAttribute('height'))).toBeGreaterThan(100);
    expect([...div.querySelectorAll('.progression-value')].map(n => n.textContent)).toEqual(['0.0', '—', '10.1']);
    expect([...div.querySelectorAll('.progression-axis text')].map(n => n.textContent)).toEqual(['0.0', '6.0', '11.2']);
    expect(div.querySelectorAll('.progression-segment')).toHaveLength(0);
    expect(div.querySelector('.progression-method')?.textContent).toContain('高さはアウト数に比例');
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
