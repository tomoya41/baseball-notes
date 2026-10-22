import { it, expect, vi } from "vitest";
import { verifyFinalDraftWindow } from "../scripts/npb-draft-final-window";
import data from "../src/data/npb-draft-2026-final-forecast.json";
import { readdirSync, readFileSync } from "node:fs";
import { parse } from "yaml";
it("normal builds before the guarded window make no remote calls", async () => { const request = vi.fn<typeof fetch>(); expect(await verifyFinalDraftWindow(request, Date.parse("2026-10-22T07:34:59Z"))).toEqual({ alreadyPublished: false, httpReads: 0 }); expect(request).not.toHaveBeenCalled(); });
it("a delayed normal build cannot stage a first forecast, even with earlier frozen metadata", async () => { const request = vi.fn(async () => new Response("", { status: 404 })); await expect(verifyFinalDraftWindow(request, Date.parse("2026-10-22T07:50:00Z"))).rejects.toThrow(/prior publication not verified/); expect(request).toHaveBeenCalledTimes(1); });
it("postmeeting maintenance requires an exact public immutable body", async () => { const request = vi.fn(async () => new Response(JSON.stringify(data) + "\n")); expect(await verifyFinalDraftWindow(request, Date.parse("2026-10-23T00:00:00Z"))).toEqual({ alreadyPublished: true, httpReads: 1 }); await expect(verifyFinalDraftWindow(async () => new Response("{}"), Date.parse("2026-10-23T00:00:00Z"))).rejects.toThrow(/immutable pin/); });
it("guards every Pages deployment immediately before publishing, including delayed scheduled paths", () => {
  let publishers = 0;
  for (const file of readdirSync(".github/workflows").filter(f => f.endsWith(".yml"))) {
    const workflow = parse(readFileSync(`.github/workflows/${file}`, "utf8")) as { jobs: Record<string, { steps?: { uses?: string; run?: string }[] }> };
    for (const job of Object.values(workflow.jobs)) {
      const steps = job.steps ?? [], index = steps.findIndex(s => s.uses?.startsWith("actions/deploy-pages@"));
      if (index < 0) continue;
      publishers++;
      expect(steps[index - 1]?.run, file).toBe("npx tsx scripts/verify-npb-draft-final-window.ts");
      expect(steps.slice(0, index).some(s => s.uses?.startsWith("actions/checkout@")), file).toBe(true);
      expect(steps.slice(0, index).some(s => s.run === "npm ci"), file).toBe(true);
    }
  }
  expect(publishers).toBe(6);
});
