// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter,Routes,Route } from "react-router-dom";
import { it,expect } from "vitest";
import type { Services } from "../src/app/services";
import { NpbRoutes } from "../src/ui/npb-routes";
import { npbSeasonEntry,needsNpbSeasonEntry,savedNpbSnapshotRoute } from "../src/domain/npb-season-entry";
import { portableRoute } from "../src/domain/product-sharing";
import { canonicalDeepLink } from "../src/domain/native-navigation";

it("future-season readiness is not a known calendar, no-game Day, roster or Production success",()=>{
 expect(npbSeasonEntry(2027)).toEqual({season:2027,status:"awaiting_verified_dataset",schedule:"unregistered",results:"uncollected"});
 expect(npbSeasonEntry(2028).status).toBe("unsupported");
 for(const path of ["home","schedule","monthly","weekly","players/id","teams/id","moves","postseason","talent/2026","season-compare"]){
  expect(needsNpbSeasonEntry(`/NPB/${path}`,new URLSearchParams("season=2027"))).toBe(true);
  expect(needsNpbSeasonEntry(`/NPB/${path}`,new URLSearchParams("season=2026"))).toBe(false);
  expect(needsNpbSeasonEntry(`/NPB/${path}`,new URLSearchParams())).toBe(false);
 }
 for(const path of ["my","favorites","library","season"])expect(needsNpbSeasonEntry(`/NPB/${path}`,new URLSearchParams("season=2027"))).toBe(false);
 expect(savedNpbSnapshotRoute("/NPB/monthly",new URLSearchParams("season=2027&month=2027-04&stage=japan_series"))).toBe("/NPB/monthly?season=2026&stage=japan_series");
});
it("canonical future links retain the empty year rather than silently routing to 2026",()=>{
 for(const path of ["season","schedule","monthly","postseason","season-compare"]){
  expect(portableRoute(`/NPB/${path}`,"season=2027&secret=hidden")).toBe("/NPB/season?season=2027");
  expect(canonicalDeepLink(`baseballnotes://NPB/${path}?season=2027&date=2027-03-01`)).toBe("/NPB/season?season=2027");
 }
 expect(portableRoute("/NPB/season","season=2026")).toBe("/NPB/season?season=2026");
 expect(portableRoute("/NPB/season","season=2028")).toBeNull();
});
it("actual future routes render no-data before reading any Current or Historical adapter",async()=>{
 let reads=0;const services=new Proxy({},{get(){reads++;throw Error("Future view must not fetch saved 2026 data");}}) as Services;
 const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
 try{
  for(const page of ["schedule","monthly","players/id","moves","season-compare"]){
   await act(async()=>root.render(<MemoryRouter key={page} initialEntries={[`/NPB/${page}?season=2027`]}><Routes><Route path="/NPB/*" element={<NpbRoutes services={services} favorites={[]} saving={false} toggle={()=>{}}/>}/></Routes></MemoryRouter>));
   expect(container.textContent).toContain("2027年のデータは未収録");expect(container.textContent).toContain("日程は未登録");expect(container.textContent).not.toContain("0勝");
   expect(container.querySelector('a[href*="talent/2026"]')?.textContent).toContain("2026年ドラフト");expect(reads).toBe(0);
  }
 }finally{await act(async()=>root.unmount());container.remove();}
});

it("retains the saved player's comparison conditions when returning from 2027",()=>{
 const id="a1ca7cac-f9be-4993-a78c-bcd1e1ae3399";
 const params=new URLSearchParams({season:"2027",kind:"player",entity:id,years:"2026",role:"batting",metric:"OPS"});
 const path=savedNpbSnapshotRoute("/NPB/season-compare",params);
 expect(path).toBe(`/NPB/season-compare?season=2026&kind=player&entity=${id}&years=2026&role=batting&metric=OPS`);
 expect(params.get("season")).toBe("2027");
});
