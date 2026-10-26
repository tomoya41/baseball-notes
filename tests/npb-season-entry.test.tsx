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
 for(const path of ["home","schedule","monthly","weekly","players/id","teams/id","moves","postseason","talent/2026"]){
  expect(needsNpbSeasonEntry(`/NPB/${path}`,new URLSearchParams("season=2027"))).toBe(true);
  expect(needsNpbSeasonEntry(`/NPB/${path}`,new URLSearchParams("season=2026"))).toBe(false);
  expect(needsNpbSeasonEntry(`/NPB/${path}`,new URLSearchParams())).toBe(false);
 }
 for(const path of ["my","favorites","library","season"])expect(needsNpbSeasonEntry(`/NPB/${path}`,new URLSearchParams("season=2027"))).toBe(false);
 expect(savedNpbSnapshotRoute("/NPB/monthly",new URLSearchParams("season=2027&month=2027-04&stage=japan_series"))).toBe("/NPB/monthly?season=2026&stage=japan_series");
});
it("canonical future links retain the empty year rather than silently routing to 2026",()=>{
 for(const path of ["season","schedule","monthly","postseason"]){
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
  for(const page of ["schedule","monthly","players/id","moves"]){
   await act(async()=>root.render(<MemoryRouter key={page} initialEntries={[`/NPB/${page}?season=2027`]}><Routes><Route path="/NPB/*" element={<NpbRoutes services={services} favorites={[]} saving={false} toggle={()=>{}}/>}/></Routes></MemoryRouter>));
   expect(container.textContent).toContain("2027年のデータは未収録");expect(container.textContent).toContain("日程は未登録");expect(container.textContent).not.toContain("0勝");
   expect(container.querySelector('a[href*="talent/2026"]')?.textContent).toContain("2026年ドラフト");expect(reads).toBe(0);
  }
 }finally{await act(async()=>root.unmount());container.remove();}
});
