import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { expect, it } from "vitest";

it("reruns cannot restore their older exact cache instead of subsequent attempt history",()=>{
  const workflow=parse(readFileSync(".github/workflows/npb-ai-insights.yml","utf8")) as {
    on:Record<string,unknown>;jobs:{prepare:{steps:{uses?:string;with?:Record<string,string>}[]}}};
  expect(workflow.on.schedule).toBeUndefined();
  const steps=workflow.jobs.prepare.steps,restore=steps.find(s=>s.uses?.startsWith("actions/cache/restore@"))!.with!,
    save=steps.find(s=>s.uses?.startsWith("actions/cache/save@"))!.with!;
  expect(restore.key).toBe(save.key);
  const key=(run:string,attempt:string)=>restore.key!.replace("${{ github.run_id }}",run).replace("${{ github.run_attempt }}",attempt);
  const a=key("run-A","1"),b=key("run-B","1"),rerunA=key("run-A","2");
  expect(rerunA).not.toBe(a);expect(rerunA).not.toBe(b);
  for(const k of [a,b,rerunA])expect(k.startsWith(restore["restore-keys"]!)).toBe(true);
});

it("exports one explicit review file, not credentials, raw provider bodies or the whole cache",()=>{
  const workflow=parse(readFileSync(".github/workflows/npb-ai-insights.yml","utf8")) as {
    jobs:{prepare:{steps:{uses?:string;with?:Record<string,string|number>;if?:string}[]}}};
  const upload=workflow.jobs.prepare.steps.find(s=>s.uses?.startsWith("actions/upload-artifact@"))!;
  expect(upload.with?.path).toBe(".data/npb-ai-insights/review.json");expect(upload.with?.["retention-days"]).toBe(7);
  expect(upload.if).toContain("steps.prepare.outcome == 'success'");
});

it("keeps structured weekly trials manual and inside the unchanged legacy cache boundary",()=>{
  const workflow=parse(readFileSync(".github/workflows/npb-ai-insights.yml","utf8")) as {
    on:{workflow_dispatch:{inputs:{analysis:{default:string};generate:{default:boolean}}}};jobs:{prepare:{concurrency?:unknown;steps:{uses?:string;with?:Record<string,string>;run?:string}[]}}};
  expect(workflow.on.workflow_dispatch.inputs.analysis.default).toBe("weekly");expect(workflow.on.workflow_dispatch.inputs.generate.default).toBe(false);
  expect(workflow.jobs.prepare.steps.find(s=>s.uses?.startsWith("actions/cache/restore@"))?.with?.path).toBe(".data/npb-ai-insights");
  expect(readFileSync("scripts/prepare-weekly-ai.ts","utf8")).toContain('root=".data/npb-ai-insights"');
  expect(readFileSync("scripts/prepare-npb-ai-insights.ts","utf8")).toContain("claimInsightAttempt");
  expect(readFileSync("scripts/prepare-weekly-ai.ts","utf8")).toContain("claimInsightAttempt");
});

it("blocks generation when restored attempt history is missing instead of bootstrapping a new budget",()=>{
  const workflow=parse(readFileSync(".github/workflows/npb-ai-insights.yml","utf8")) as {jobs:{prepare:{steps:{id?:string;env?:Record<string,string>;run?:string;if?:string}[]}}};
  const steps=workflow.jobs.prepare.steps,history=steps.find(s=>s.id==="history")!;
  expect(history.env?.RESTORED_AI_CACHE_KEY).toBe("${{ steps.state.outputs.cache-matched-key }}");
  expect(history.run).toContain("scripts/check-ai-attempt-history.ts");
  expect(steps.find(s=>s.run?.includes("scripts/prepare-weekly-ai.ts --generate"))?.if).toContain("steps.history.outputs.available == 'true'");
  expect(steps.indexOf(history)).toBeGreaterThan(steps.findIndex(s=>s.id==="prepare"));
});
