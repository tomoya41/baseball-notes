import { expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { planNpbCalendar, inspectNpbCalendar, planNpbScheduleSync } from "../src/data/npb-season-lifecycle";
import { openDataClient, migrateData } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import type { DataClient } from "../src/data/database";
import { dayFactsStepName, hasCompletedDayFacts } from "../src/data/npb-publication-admission";

test.each(["2026-02-31", "2026-02-29", "2026-13-01", "2026-1-01", "garbage"])("rejects invalid calendar date %s", date => {
  expect(() => planNpbCalendar("daily", date)).toThrow("Invalid schedule date");
});
test("unknown year requires reviewed metadata, not an automatic successful skip", () => {
  expect(() => planNpbCalendar("daily", "2027-10-13")).toThrow("metadata unavailable");
});
test.each(["daily", "weekly", "monthly", "season"] as const)("outside reviewed calendar %s is a skip, not no-game or season completion", mode => {
  expect(planNpbCalendar(mode, "2026-10-13")).toEqual({ skip: true, reason: "outside_reviewed_regular_calendar", date: "2026-10-13", reviewedFrom: "2026-03-27", reviewedTo: "2026-10-08", endDateStatus: "scheduled" });
  expect(() => planNpbCalendar(mode, "2026-10-09", 1)).toThrow("Saved fixture outside reviewed calendar");
});
test("preseason windows intersecting the calendar are clamped; wholly outside windows skip", () => {
  expect(planNpbCalendar("daily", "2026-03-26").skip).toBe(true);
  expect(planNpbCalendar("weekly", "2026-03-20")).toEqual({ skip: false, range: { from: "2026-03-27", to: "2026-04-02" } });
  expect(planNpbCalendar("monthly", "2026-09-27")).toEqual({ skip: false, range: { from: "2026-09-27", to: "2026-10-08" } });
});
test("an empty in-calendar day is not a skip or completeness proof", () => {
  expect(planNpbCalendar("daily", "2026-10-07", 0)).toEqual({ skip: false, range: { from: "2026-10-07", to: "2026-10-07" } });
});
test("verified October 8 regular fixture is admitted, October 10 postseason stays outside", () => {
  expect(planNpbCalendar("daily", "2026-10-08", 1)).toEqual({ skip: false, range: { from: "2026-10-08", to: "2026-10-08" } });
  expect(planNpbCalendar("daily", "2026-10-10")).toMatchObject({ skip: true, endDateStatus: "scheduled" });
});
test("new/restored schema can bootstrap an admitted sync; outside preflight never migrates", async () => {
  const client = openDataClient("file::memory:");
  try {
    expect((await planNpbScheduleSync(client, "daily", "2026-10-13")).skip).toBe(true);
    expect((await client.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows).toHaveLength(0);
    expect((await planNpbScheduleSync(client, "daily", "2026-10-07")).skip).toBe(false);
    await migrateData(client);
    expect(await new NpbRepository(client).findGamesByDate("2026-10-07")).toEqual([]);
    const tables = (await client.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows;
    expect((await planNpbScheduleSync(client, "daily", "2026-10-13")).skip).toBe(true);
    expect((await client.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows).toEqual(tables);
    // A known makeup fixture remains an explicit exception even if outside the calendar.
    await client.execute(`INSERT INTO npb_games VALUES ('fixture',2026,'2026-10-09','home','away',1,NULL,NULL,'scheduled',NULL,NULL,'nf3','fixture','https://nf3.sakura.ne.jp/','2026-10-01','hash')`);
    await expect(planNpbScheduleSync(client, "daily", "2026-10-09")).rejects.toThrow("Saved fixture outside reviewed calendar");
    expect((await client.execute("SELECT COUNT(*) AS n FROM npb_games")).rows[0]?.n).toBe(1);
  } finally { client.close(); }
});
test("read-only lifecycle monitoring preserves known makeup dates and pending coverage", async () => {
  const execute = vi.fn(async () => ({ rows: [{ latest_game_date: "2026-10-09", target_games: 0, pending_games: 6 }] }));
  const result = await inspectNpbCalendar({ execute } as unknown as DataClient, "2026-10-13");
  expect(result).toMatchObject({ latestSavedGameDate: "2026-10-09", pendingSavedGames: 6, seasonEndConfirmed: false, metadataReviewRequired: true });
  expect(result.calendar.skip).toBe(true);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(execute.mock.calls[0]?.length).toBe(1);
});
test.each(["skipped", "failure", "cancelled", null])("successful workflow with collection %s cannot admit publication", conclusion => {
  expect(hasCompletedDayFacts([{ status: "completed", conclusion: "success", steps: [{ name: dayFactsStepName, status: "completed", conclusion }] }])).toBe(false);
});
test("only actual successful collection in a successful job admits the callback", () => {
  const job = { status: "completed", conclusion: "success", steps: [{ name: dayFactsStepName, status: "completed", conclusion: "success" }] };
  expect(hasCompletedDayFacts([job])).toBe(true);
  expect(hasCompletedDayFacts([{ ...job, conclusion: "failure" }])).toBe(false);
  expect(hasCompletedDayFacts([{ ...job, steps: [{ ...job.steps[0], name: "Some unrelated success" }] }])).toBe(false);
  expect(hasCompletedDayFacts(null)).toBe(false);
});
test("the protected callback uses the triggering Run and the exact actual Day Facts step", () => {
  const daily = parse(readFileSync(".github/workflows/daily-collector.yml", "utf8"));
  expect(daily.jobs.collect.steps.some((s: { name?: string }) => s.name === dayFactsStepName)).toBe(true);
  const callback = parse(readFileSync(".github/workflows/npb-season-publish.yml", "utf8"));
  expect(callback.jobs.stage.needs).toBe("admission");
  expect(callback.jobs.stage.if).toBe("needs.admission.outputs.admitted == 'true'");
  expect(callback.jobs.admission.if).toContain("github.event.workflow_run.head_repository.id == github.repository_id");
  expect(callback.jobs.admission.steps.at(-1).env.NPB_TRIGGER_RUN_ID).toBe("${{ github.event.workflow_run.id }}");
});
