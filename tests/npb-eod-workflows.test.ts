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
  expect(build).toContain("publish-npb-hot.ts --require-remote");
  expect(build.indexOf("generate-npb-season.ts")).toBeLessThan(build.indexOf("npm run build"));
  expect(build).toContain("else\n  npx tsx scripts/preserve-published-npb-hot.ts");
});

test("formal HOT re-evaluation follows completed trusted Scheduled production, never a manual proof", () => {
  const workflow = parse(readFileSync(".github/workflows/npb-season-publish.yml", "utf8"));
  expect(workflow.on.workflow_run).toEqual({ workflows: ["Daily NPB collector and Pages delivery"], types: ["completed"] });
  const guard = workflow.jobs.admission.if;
  for (const required of ["workflow_run.event == 'schedule'", "workflow_run.conclusion == 'success'",
    "workflow_run.head_branch == 'main'", "workflow_run.head_repository.id == github.repository_id"])
    expect(guard).toContain(required);
  expect(workflow.jobs.deploy.if).toContain("needs.stage.result == 'success'");
  const runs = workflow.jobs.stage.steps.map((step: { run?: string }) => step.run ?? "").join("\n");
  expect(runs).toContain("publish-npb-hot.ts --require-remote");
  expect(runs).not.toContain("collector:npb:day");
  expect(runs).not.toContain("--trigger=scheduled");
  // Never check out a workflow_run-controlled ref or execute a PR artifact.
  expect(JSON.stringify(workflow.jobs.stage.steps)).not.toContain("workflow_run.head_sha");
  const publisher = readFileSync("scripts/publish-npb-hot.ts", "utf8");
  expect(publisher).toContain('action?.conclusion === "success"');
  expect(publisher).toContain("action.inferredTargetDate === asOfDate");
  expect(publisher).toContain('action.encryptedBackupArtifact === "present"');
});
