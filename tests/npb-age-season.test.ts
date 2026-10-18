import { expect, it } from "vitest";
import { ageCollectedPlan, ageSeasonPlan, ageSeasonQuery, historicalBirthDate } from "../src/domain/npb-age-season";
import { portableRoute } from "../src/domain/product-sharing";
import { viewConditions } from "../src/domain/portable-conditions";
import { activityFromRoute } from "../src/application/personal-library";
import { cohortFixture, cohortId } from "./fixtures/npb-cohort";

it("uses year-end age for December/January and leap-day births without a draft/debut inference", () => {
  const { catalog, manifest } = cohortFixture();
  catalog.players[0]!.profile.birthDate = "1999-12-31";
  catalog.players[1]!.profile.birthDate = "2000-01-01";
  catalog.players[3]!.profile.birthDate = "2000-02-29";
  const plan = ageSeasonPlan([cohortId(0), cohortId(1), cohortId(2), cohortId(3)], 26, catalog, manifest);
  expect(plan.map(p => p.season)).toEqual([2025, 2026, null, 2026]);
  expect(plan.map(p => p.available)).toEqual([true, false, false, false]);
  expect(plan[2]!.reason).toContain("生年月日");
  expect(ageSeasonPlan([cohortId(99)], 26, catalog, manifest)[0]!.reason).toContain("選手情報");
});
it("requires a player-specific admitted year, rejects oversized plans and does not invent future years", () => {
  const { catalog, manifest } = cohortFixture(); manifest.players[0]!.seasons = [2024];
  expect(ageSeasonPlan([cohortId(0)], 26, catalog, manifest)[0]!.available).toBe(false);
  expect(ageSeasonPlan([cohortId(0)], 99, catalog, manifest)[0]!.available).toBe(false);
  expect(() => ageSeasonPlan([cohortId(0), cohortId(0)], 26, catalog, manifest)).toThrow();
  expect(() => ageSeasonPlan(Array.from({length:5},(_,i)=>cohortId(i)),26,catalog,manifest)).toThrow();
});
it("plans only admitted years through the year-end cutoff without manufacturing missing years or birthdays",()=>{
 const {catalog,manifest}=cohortFixture();manifest.seasons.push({...manifest.seasons[0]!,season:2022},{...manifest.seasons[0]!,season:2024});manifest.players[0]!.seasons=[2022,2024,2025];
 expect(ageCollectedPlan([cohortId(0)],25,catalog,manifest)[0]).toMatchObject({season:2024,seasons:[2022,2024],available:true});
 expect(ageCollectedPlan([cohortId(0)],26,catalog,manifest)[0]!.seasons).toEqual([2022,2024,2025]);
 expect(ageCollectedPlan([cohortId(2)],26,catalog,manifest)[0]).toMatchObject({season:null,seasons:[],available:false});
 const params=new URLSearchParams(`cohort=ageSeason&age=26&ageMode=collected&recentPlayers=${cohortId(0)}`);
 expect(ageSeasonQuery(params)).toMatchObject({valid:true,mode:"collected"});expect(portableRoute("/NPB/history",String(params))).toContain("ageMode=collected");expect(viewConditions(params,true,"NPB")).toContain("ageMode=collected");expect(viewConditions(params,true,"MLB")).not.toContain("ageMode");
 params.set("ageMode","full-career");expect(ageSeasonQuery(params).valid).toBe(false);expect(portableRoute("/NPB/history",String(params))).toBeNull();
});
it("uses an admitted historical-only birthdate without creating a Current profile or ignoring a conflict",()=>{
  const {catalog,manifest}=cohortFixture(),id=cohortId(0),p=manifest.players[0]!;
  p.identityScope="historical_only";p.birthDate="1999-04-01";catalog.players=catalog.players.filter(c=>c.playerId!==id);
  expect(ageSeasonPlan([id],26,catalog,manifest)[0]).toMatchObject({birthDate:"1999-04-01",birthDateSource:"historical",season:2025,available:true});
  expect(catalog.players.some(c=>c.playerId===id)).toBe(false);
  p.identityScope=undefined;expect(historicalBirthDate(id,catalog,manifest).birthDate).toBeNull();
  p.identityScope="historical_only";catalog.players.push({...cohortFixture().catalog.players[0]!,profile:{...cohortFixture().catalog.players[0]!.profile,birthDate:"1998-04-01"}});
  expect(ageSeasonPlan([id],26,catalog,manifest)[0]).toMatchObject({birthDate:null,available:false,birthDateSource:"conflict"});
});
it.each(["age=-1", "age=2.5", "age=100", "age=", "season=2026", "years=2024,2025", "asOfDate=2025-08-20", "period=7", "stage=npb_cs_final", "competition=postseason", "competition=preseason", "role=invalid", "recentPlayers=unknown", `recentPlayers=${Array.from({length:5},(_,i)=>cohortId(i)).join(",")}`])("rejects incompatible or malformed conditions: %s", bad => {
  expect(ageSeasonQuery(new URLSearchParams(`cohort=ageSeason&${bad}`)).valid).toBe(false);
  expect(portableRoute("/NPB/history", `cohort=ageSeason&${bad}`)).toBeNull();
});
it("preserves explicit Saved View/share age selections but omits them from automatic Activity and MLB", () => {
  const params = new URLSearchParams(`cohort=ageSeason&age=26&role=pitching&recentPlayers=${cohortId(0)},${cohortId(1)}&sort1=outsRecorded`);
  expect(portableRoute("/NPB/history", params.toString())).toContain("age=26");
  expect(viewConditions(params, true, "NPB")).toContain("age=26");
  expect(viewConditions(params, true, "MLB")).not.toContain("age=");
  const activity = activityFromRoute("/NPB/history", params.toString(), 1)!;
  expect(activity.conditions).not.toMatch(/age=|cohort=|recentPlayers=/);
  expect(portableRoute(`/NPB/players/${cohortId(0)}/seasons`, "season=2025&story=1")).toContain("story=1");
});
