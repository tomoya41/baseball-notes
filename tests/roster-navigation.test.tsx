// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { PlayerTabs } from "../src/ui/design-system";
import { PlayerQuickActions } from "../src/ui/signature";
import { useRosterSearchParams } from "../src/ui/use-roster-search-params";
import { teamPlayerReturnPath } from "../src/presentation/team-player-list";

function Profile() {
  const location=useLocation(),[params,setParams]=useRosterSearchParams();
  return <><PlayerTabs base="/NPB/players/player" section={location.pathname.split('/')[4]} />
    <PlayerQuickActions compareTo="/NPB/compare" historyTo="/NPB/players/player/seasons" trendsTo="/NPB/players/player/trends"/>
    <button onClick={()=>setParams(p=>{p.set('season','2024');return p;},{replace:true})}>年度を変更</button>
    <output>{teamPlayerReturnPath(location.state) ?? 'no roster'}|{location.pathname}|{params.get('season')}</output></>;
}
it("retains the roster context through actual profile tabs, quick actions and year/metric URL changes",async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const host=document.createElement('div'),root=createRoot(host);
  const state={teamPlayers:{teamId:'npb:team:tigers',year:'2025',role:'pitching',sort:'innings',query:'村上'}};
  try {
    await act(async()=>root.render(<MemoryRouter initialEntries={[{pathname:'/NPB/players/player',state}]}><Profile/></MemoryRouter>));
    for(const label of ['成績','分析','選手情報']) {
      await act(async()=>[...host.querySelectorAll<HTMLAnchorElement>('.profile-tabs a')].find(a=>a.textContent===label)!.click());
      expect(host.querySelector('output')?.textContent).toContain('season=2025&role=pitching&sort=innings&q=%E6%9D%91%E4%B8%8A');
    }
    await act(async()=>host.querySelector<HTMLAnchorElement>('[aria-label="年度の変化を見る"]')!.click());
    await act(async()=>host.querySelector('button')!.click());
    expect(host.querySelector('output')?.textContent).toContain('/NPB/players/player/seasons|2024');
    expect(host.querySelector('output')?.textContent).toContain('season=2025&role=pitching&sort=innings');
  } finally {await act(async()=>root.unmount());vi.unstubAllGlobals();}
});
