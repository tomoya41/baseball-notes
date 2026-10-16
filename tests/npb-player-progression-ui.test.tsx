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
    expect(div.querySelectorAll('svg[role="img"] line')).toHaveLength(1); // Only the baseline; no fabricated gap segment.
    expect([...div.querySelectorAll("p")].find(p => p.textContent?.includes("この収録範囲の最小値"))?.textContent).toContain("2025年 0.30");
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
