import { expect,it } from "vitest";
import { historicalCohort } from "../src/domain/npb-historical-cohort";
import { canonicalDeepLink } from "../src/domain/native-navigation";
import { portableRoute } from "../src/domain/product-sharing";
import { viewConditions } from "../src/domain/portable-conditions";
import { cohortFixture,cohortId } from "./fixtures/npb-cohort";

it("uses known birth years rather than names, saved ages or rookie assumptions",()=>{
 const {data,catalog}=cohortFixture();
 const result=historicalCohort(data,catalog,cohortId(0),"birthYear","batting");
 expect(result.year).toBe(1999);expect(result.members.map(m=>m.player.playerId).sort()).toEqual([cohortId(0),cohortId(1),cohortId(4),cohortId(5)]);
 expect(result.members.filter(m=>m.player.displayName==="同姓同名")).toHaveLength(2);
 expect(historicalCohort(data,catalog,cohortId(2),"birthYear","batting").year).toBeNull();
 expect(historicalCohort(data,catalog,"unknown","birthYear","batting").members).toEqual([]);
});
it("keeps unknown draft years distinct and separates roles",()=>{
 const {data,catalog}=cohortFixture();
 expect(historicalCohort(data,catalog,cohortId(0),"draftYear","batting").members.map(m=>m.player.playerId)).toEqual([cohortId(0),cohortId(1)]);
 expect(historicalCohort(data,catalog,cohortId(4),"draftYear","batting").year).toBeNull();
 const p=historicalCohort(data,catalog,cohortId(0),"birthYear","pitching").members;
 expect(p.map(m=>m.player.playerId)).toEqual([cohortId(6)]);expect(p[0]!.metrics.ERA).toBeNull();
 expect(()=>historicalCohort({...data,rows:[...data.rows,{...data.rows[0]!,season:2024}]},catalog,cohortId(0),"birthYear","batting")).toThrow(/one Historical season/);
});
it("retains transfer club rows, recomputes ratios from components and propagates missing components",()=>{
 const {data,catalog}=cohortFixture();
 const a=historicalCohort(data,catalog,cohortId(0),"birthYear","batting").members.find(m=>m.player.playerId===cohortId(0))!;
 expect(a.teams).toEqual(["npb:team:tigers","npb:team:hawks"]);expect(a.metrics.PA).toBe(114);expect(a.metrics.AVG).toBeCloseTo(25/110);expect(a.metrics.AVG).not.toBe((.2+.5)/2);
 const missing={...data,rows:data.rows.map(r=>r.playerId===cohortId(0)&&r.teamId==="npb:team:hawks"?{...r,metrics:{...r.metrics,BB:null}}:r)};
 expect(historicalCohort(missing,catalog,cohortId(0),"birthYear","batting").members.find(m=>m.player.playerId===cohortId(0))!.metrics.OPS).toBeNull();
});
it("preserves cohort/selection in shared URLs, native links and saved conditions without local IDs",()=>{
 const search=`season=2025&cohort=draftYear&peer=${cohortId(0)}&recentPlayers=${cohortId(0)},${cohortId(1)}&role=batting&secret=private`;
 const route=portableRoute("/NPB/history",search)!;const params=new URLSearchParams(route.split("?")[1]);
 expect(params.get("cohort")).toBe("draftYear");expect(params.get("peer")).toBe(cohortId(0));expect(params.get("recentPlayers")).toContain(cohortId(1));expect(params.has("secret")).toBe(false);
 const deep=canonicalDeepLink("https://tomoya41.github.io/baseball-notes/#"+route)!;
 expect(Object.fromEntries(new URLSearchParams(deep.split("?")[1]))).toEqual(Object.fromEntries(params));
 expect(new URLSearchParams(viewConditions(new URLSearchParams(search))).get("cohort")).toBe("draftYear");
 expect(portableRoute("/NPB/history","cohort=invalid")).toBeNull();expect(portableRoute("/NPB/history","cohort=birthYear&peer=local-secret")).toBeNull();
 expect(viewConditions(new URLSearchParams(search),true,"MLB")).not.toContain("cohort");
});
