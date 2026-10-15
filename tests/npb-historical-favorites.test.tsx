// @vitest-environment jsdom
import {act} from "react";
import {createRoot} from "react-dom/client";
import {MemoryRouter} from "react-router-dom";
import {expect,it,vi} from "vitest";
import {NpbSavedPlayers} from "../src/ui/npb-my";
import registry from "../src/data/npb-historical-only-identities.json";
it("opens historical Favorites offline without inventing Current profile/affiliation and can remove them",async()=>{
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  const p=registry.players[0]!,directory=vi.fn().mockRejectedValue(Error("offline")),toggle=vi.fn(),div=document.createElement("div"),root=createRoot(div);
  try{
    await act(async()=>root.render(<MemoryRouter><NpbSavedPlayers repository={{findLatestNpb:directory}} favorites={[{league:"NPB",kind:"player",entityId:p.playerId,addedAt:"2026-10-16T00:00:00Z"}]} toggle={toggle} saving={false}/></MemoryRouter>));
    expect(div.textContent).toContain(p.article);expect(div.textContent).toContain("過去年度の成績");expect(div.querySelector("a")?.getAttribute("href")).toContain(`/NPB/history?season=`);expect(div.querySelector('a[href*="/players/"]')).toBeNull();
    await act(async()=>div.querySelector("button")!.click());expect(toggle).toHaveBeenCalledWith({league:"NPB",kind:"player",entityId:p.playerId});
  }finally{await act(async()=>root.unmount());vi.unstubAllGlobals();}
});
