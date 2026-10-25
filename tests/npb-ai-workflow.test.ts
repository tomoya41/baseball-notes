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
