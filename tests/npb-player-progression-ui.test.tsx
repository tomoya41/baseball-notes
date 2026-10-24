// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { NpbPlayerProgression } from "../src/ui/npb-player-progression";
import { historicalPitchingKeys, npbHistoricalRowSchema } from "../src/domain/npb-historical";

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
    expect([...div.querySelectorAll("p")].find(p => p.textContent?.includes("この収録範囲の最小値"))?.textContent).toContain("2025年 0.30");
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
    expect(div.querySelector('figcaption')?.textContent).toContain('高さはアウト数に比例');
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
