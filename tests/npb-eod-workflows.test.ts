import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { expect, test } from "vitest";
type Workflow={on:{schedule?:{cron:string;timezone?:string}[]};concurrency?:{group:string};jobs:Record<string,{if?:string;steps:{if?:string;run?:string;uses?:string}[]}>};
const read=(name:string)=>parse(readFileSync(`.github/workflows/${name}.yml`,"utf8")) as Workflow;
test("all EOD/safety workflows are valid YAML and retain safety schedules",()=>{
  const watcher=read("npb-eod-watcher"),sync=read("npb-schedule-sync"),daily=read("daily-collector"),fresh=read("npb-freshness");
  expect(watcher.on.schedule).toEqual([{cron:"17 * * * *",timezone:"Asia/Tokyo"}]);
  expect(sync.on.schedule).toHaveLength(3);
  expect(daily.on.schedule?.[0]?.cron).toBe("37 18 * * *");
  expect(fresh.on.schedule?.[0]?.cron).toBe("17 3 * * *");
  expect(new Set([watcher,sync,daily,read("npb-season-publish")].map(w=>w.concurrency?.group)).size).toBe(1);
});
test("heavy EOD steps and deploy require publish output; manual fixtures cannot publish",()=>{
  const w=read("npb-eod-watcher");
  for(const s of w.jobs.watch!.steps.filter(s=>s.run?.includes("npm run build")||s.run?.includes("backup:npb:drill")))
    expect(["steps.watch.outputs.publish == 'true'","inputs.fixture_only && inputs.verify_backup"]).toContain(s.if);
  expect(w.jobs.deploy?.if).toBe("needs.watch.outputs.publish == 'true'");
  expect(w.jobs.watch?.steps.find(s=>s.run?.includes("--action=watch"))?.if).toBe("!inputs.fixture_only");
  expect(read("daily-collector").jobs.deploy?.if).toContain("needs.collect.outputs.skip != 'true'");
});
test("Daily safety-net publication regenerates player payloads after verified Fact collection",()=>{
  const steps=read("daily-collector").jobs.collect!.steps;
  const collectIndex=steps.findIndex(s=>s.run?.includes("npm run collector:npb:day"));
  const buildIndex=steps.findIndex(s=>s.run?.includes("npm run build"));
  expect(collectIndex).toBeGreaterThanOrEqual(0);
  expect(buildIndex).toBeGreaterThan(collectIndex);
  const build=steps[buildIndex]!.run!;
  expect(build).toContain('"$GITHUB_EVENT_NAME" == "schedule"');
  expect(build).toContain("generate-npb-season.ts --date=\"$date_jst\"");
  expect(build).toContain("generate-npb-player-directory.ts --require-remote");
  expect(build).toContain("generate-npb-hot-payload.ts --require-remote");
  expect(build.indexOf("generate-npb-season.ts")).toBeLessThan(build.indexOf("npm run build"));
  expect(build).toContain("else\n  npx tsx scripts/preserve-published-npb-hot.ts");
});
