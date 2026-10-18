// @vitest-environment jsdom
import {act} from "react";
import {createRoot} from "react-dom/client";
import {MemoryRouter} from "react-router-dom";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {NpbPlayerStory} from "../src/ui/npb-player-story";
import {PlayerLifecycle} from "../src/ui/npb-lifecycle";
import {cohortFixture,cohortId} from "./fixtures/npb-cohort";
beforeEach(()=>vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true));
afterEach(()=>vi.unstubAllGlobals());
it.each([
  ["P",true,true,"pitching"],["OF",true,false,"batting"],[null,false,true,"pitching"],[null,true,true,"batting"],
] as const)("opens the appropriate available story role (%s) without hiding other recorded roles",async(position,battingAvailable,pitchingAvailable,expected)=>{
  const f=cohortFixture(),player={...f.catalog.players[0]!,profile:{...f.catalog.players[0]!.profile,position},battingAvailable,pitchingAvailable},host=document.createElement("div"),root=createRoot(host);
  try{
    await act(async()=>root.render(<MemoryRouter><PlayerLifecycle player={player}/></MemoryRouter>));
    const link=host.querySelector('a[href*="story=1"]')!;expect(new URLSearchParams(link.getAttribute("href")!.split("?")[1]).get("role")).toBe(expected);
  }finally{await act(async()=>root.unmount());}
});
it("connects licensed school/draft/history to recorded years without estimating entry, current roster or missing periods",async()=>{
  const f=cohortFixture(),p=f.catalog.players[0]!;p.profile.schools=["架空高校"];p.profile.draftRound="1位";
  f.manifest.players[0]!.seasons=[2023,2025];
  const repository={catalog:vi.fn().mockResolvedValue(f.catalog)},host=document.createElement("div"),root=createRoot(host);
  try{
    await act(async()=>root.render(<MemoryRouter><NpbPlayerStory playerId={cohortId(0)} role="pitching" manifest={f.manifest} repository={repository}/></MemoryRouter>));
    expect(host.textContent).toContain("架空高校");expect(host.textContent).toContain("2017年 ドラフト");expect(host.textContent).toContain("年末26歳");
    const seasons=[...host.querySelectorAll('a[href*="story=1"]')].map(e=>e.getAttribute("href"));
    expect(seasons).toEqual([`/NPB/players/${cohortId(0)}/seasons?season=2023&role=pitching&story=1`,`/NPB/players/${cohortId(0)}/seasons?season=2025&role=pitching&story=1`]);
    expect(host.querySelector('a[href="https://example.com/identity/0"]')).not.toBeNull();
    expect(host.textContent).not.toContain("2017年入団");expect(host.textContent).toContain("完全なキャリアや現在の登録");
    expect(repository.catalog).toHaveBeenCalledTimes(1);
  }finally{await act(async()=>root.unmount());}
});
it("keeps unknown identity metadata and an unavailable manifest distinct from no historical seasons",async()=>{
  const f=cohortFixture();f.catalog.players=[];const host=document.createElement("div"),root=createRoot(host),repository={catalog:vi.fn().mockResolvedValue(f.catalog)};
  try{
    await act(async()=>root.render(<MemoryRouter><NpbPlayerStory playerId={cohortId(0)} role="batting" manifest={null} repository={repository}/></MemoryRouter>));
    expect(host.textContent).toContain("経歴プロフィールは未収録");expect(host.textContent).toContain("年度一覧が未確認");expect(host.textContent).not.toContain("年末26歳");
    await act(async()=>root.render(<MemoryRouter><NpbPlayerStory playerId={cohortId(0)} role="batting" manifest={f.manifest} repository={repository}/></MemoryRouter>));
    expect(host.querySelector('a[href*="season=2025"]')).not.toBeNull();expect(repository.catalog).toHaveBeenCalledTimes(1);
  }finally{await act(async()=>root.unmount());}
});
it("offers retry without converting failed profile retrieval to absent data",async()=>{
  const f=cohortFixture(),host=document.createElement("div"),root=createRoot(host),repository={catalog:vi.fn().mockRejectedValueOnce(Error("offline")).mockResolvedValueOnce(f.catalog)};
  try{
    await act(async()=>root.render(<MemoryRouter><NpbPlayerStory playerId={cohortId(0)} role="batting" manifest={f.manifest} repository={repository}/></MemoryRouter>));
    expect(host.textContent).toContain("取得できません");expect(host.textContent).not.toContain("経歴プロフィールは未収録");
    await act(async()=>host.querySelector("button")!.click());expect(host.textContent).toContain("2017年 ドラフト");
  }finally{await act(async()=>root.unmount());}
});
