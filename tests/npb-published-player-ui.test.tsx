// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { PublishedPlayerFallback } from "../src/ui/npb-published-player";
import { readPublishedPlayerStats } from "../src/application/npb-published-player";
import type { NpbPlayerDirectory } from "../src/domain/npb-player-directory";
vi.mock("../src/application/npb-published-player", () => ({ readPublishedPlayerStats: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
it("shows dated saved metrics and unavailable fields without declaring the API healthy", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(readPublishedPlayerStats).mockResolvedValue({ period: { from: "2026-03-27", to: "2026-10-08" }, effectiveDate: "2026-10-12", generatedAt: "2026-10-14T00:00:00Z", coverage: { status: "partial", summary: { dates: 2, complete: 1, partial: 1, failed: 0, unknown: 0, noGames: 0 } }, player: { playerId: "id", displayName: "選手", teamId: null, batting: null, pitching: { factCount: 1, metrics: { G: { value: 1, status: "complete", observedFacts: 1, factCount: 1 }, ERA: { value: null, status: "unavailable", observedFacts: 0, factCount: 1 } } } } } as never);
  const div = document.createElement("div"), root = createRoot(div);
  try {
    await act(async () => root.render(<PublishedPlayerFallback playerId="id" period="season" repository={{ findLatestNpb: async () => ({} as NpbPlayerDirectory) }} />));
    expect(div.textContent).toContain("成績の更新を確認できない"); expect(div.textContent).toContain("2026-10-08");
    expect(div.textContent).toContain("一部未収集"); expect(div.textContent).toContain("未収録を出場なしとは判定しません");
    expect(div.querySelector('button[aria-label="ERAの説明"]')?.closest('.metric-tile')?.querySelector('.metric-tile__value')?.textContent).toBe("—");
    expect(div.querySelector('.published-fallback-status')?.textContent).toBe("保存済み · 更新未確認 · 一部未収集");
    expect(div.querySelector('details')?.hasAttribute('open')).toBe(false);
    expect(div.textContent).not.toContain("API復旧済み");
  } finally { await act(async () => root.unmount()); }
});
it("prioritizes batting rates/power while retaining zeros, nulls and the saved cutoff",async()=>{
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  const metric=(value:number|null)=>({value,status:value===null?"unavailable":"complete",observedFacts:1,factCount:1});
  vi.mocked(readPublishedPlayerStats).mockResolvedValue({period:{from:"2026-03-27",to:"2026-10-08"},effectiveDate:"2026-10-12",generatedAt:"2026-10-14T00:00:00Z",coverage:{status:"partial",summary:{dates:1,complete:0,partial:1,failed:0,unknown:0,noGames:0}},player:{playerId:"id",displayName:"選手",teamId:null,pitching:null,batting:{factCount:1,metrics:{AVG:metric(null),HR:metric(0),OPS:metric(null),G:metric(1),PA:metric(0),H:metric(0),RBI:metric(0)}}}} as never);
  const div=document.createElement("div"),root=createRoot(div);
  try{
    await act(async()=>root.render(<PublishedPlayerFallback playerId="id" period="season" repository={{findLatestNpb:async()=>({} as NpbPlayerDirectory)}} />));
    const tiles=[...div.querySelectorAll('.metric-tile')];
    expect(tiles.slice(0,3).map(t=>t.querySelector('button')?.getAttribute('aria-label'))).toEqual(['AVGの説明','HRの説明','OPSの説明']);
    expect(tiles.slice(0,3).map(t=>t.querySelector('.metric-tile__value')?.textContent)).toEqual(['—','0','—']);
    expect(div.querySelector('.recent-dates')?.textContent).toContain('2026-10-08');expect(div.querySelector('.recent-dates')?.textContent).toContain('2026-10-12');
  }finally{await act(async()=>root.unmount());}
});

