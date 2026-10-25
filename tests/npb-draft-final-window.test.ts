import { it, expect, vi } from "vitest";
import { verifyFinalDraftWindow } from "../scripts/npb-draft-final-window";
import data from "../src/data/npb-draft-2026-final-forecast.json";
import { readdirSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import pin from "../src/data/npb-draft-final-release.json";
import publication from "../src/data/npb-draft-final-publication.json";
import display from "../src/data/npb-draft-final-display.json";
const releaseProof = () => ({ id: display.releaseId, tag_name: pin.tag, draft: false, prerelease: false, html_url: publication.releaseUrl, published_at: publication.firstPublishedAt, assets: [{ id: display.assetId, name: "final-2026.json.gz", size: display.compressedBytes, state: "uploaded", digest: `sha256:${pin.sha256}`, browser_download_url: pin.assetUrl, created_at: "2026-10-22T04:19:58Z", updated_at: "2026-10-22T04:19:58Z" }] });
it("normal builds before the guarded window make no remote calls", async () => { const request = vi.fn<typeof fetch>(); expect(await verifyFinalDraftWindow(request, Date.parse("2026-10-22T07:34:59Z"), "premeeting")).toEqual({ alreadyPublished: false, httpReads: 0 }); expect(request).not.toHaveBeenCalled(); });
it("a delayed normal build cannot stage a first forecast, even with earlier frozen metadata", async () => { const request = vi.fn(async () => new Response("", { status: 404 })); await expect(verifyFinalDraftWindow(request, Date.parse("2026-10-22T07:50:00Z"), "premeeting")).rejects.toThrow(/prior publication not verified/); expect(request).toHaveBeenCalledTimes(1); });
it("postmeeting maintenance requires an exact public immutable body", async () => { const request = vi.fn(async () => new Response(JSON.stringify(data) + "\n")); expect(await verifyFinalDraftWindow(request, Date.parse("2026-10-23T00:00:00Z"), "premeeting")).toEqual({ alreadyPublished: true, httpReads: 1 }); await expect(verifyFinalDraftWindow(async () => new Response("{}"), Date.parse("2026-10-23T00:00:00Z"), "premeeting")).rejects.toThrow(/immutable pin/); });
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
it("admits only an explicitly postmeeting archive of the already-public exact Release", async () => {
  const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(releaseProof())));
  expect(await verifyFinalDraftWindow(request, Date.parse("2026-10-23T00:00:00Z"), "postmeeting_archive")).toEqual({ alreadyPublished: false, releasePublishedBeforeMeeting: true, mode: "postmeeting_archive", httpReads: 1 });
  expect(request).toHaveBeenCalledTimes(1); expect(String(request.mock.calls[0]![0])).toContain(`/releases/${display.releaseId}`);
  await expect(verifyFinalDraftWindow(request, Date.parse("2026-10-22T07:49:59Z"), "postmeeting_archive")).rejects.toThrow(/cannot be presented before/);
});
it("uses the read-only Actions token only for the fixed GitHub proof endpoint and rejects redirects", async () => {
  const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(releaseProof())));
  await verifyFinalDraftWindow(request, Date.parse("2026-10-23T00:00:00Z"), "postmeeting_archive", "test-ci-token");
  expect(request.mock.calls[0]![0]).toBe(`https://api.github.com/repos/tomoya41/baseball-notes/releases/${display.releaseId}`);
  expect(new Headers(request.mock.calls[0]![1]?.headers).get("Authorization")).toBe("Bearer test-ci-token");
  expect(request.mock.calls[0]![1]?.redirect).toBe("error");
  const pages = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(data) + "\n"));
  await verifyFinalDraftWindow(pages, Date.parse("2026-10-23T00:00:00Z"), "premeeting", "test-ci-token");
  expect(new Headers(pages.mock.calls[0]![1]?.headers).has("Authorization")).toBe(false);
  const denied=vi.fn<typeof fetch>(async()=>new Response("do not retain",{status:403}));
  await expect(verifyFinalDraftWindow(denied,Date.parse("2026-10-23T00:00:00Z"),"postmeeting_archive","test-ci-token")).rejects.toThrow("HTTP 403");
  expect(denied).toHaveBeenCalledOnce();
});
it("rejects changed, late or unpublished archive proof rather than trusting local timestamps", async () => {
  const variants = [
    (p: ReturnType<typeof releaseProof>) => { p.draft = true; },
    (p: ReturnType<typeof releaseProof>) => { p.published_at = "2026-10-23T00:00:00Z"; },
    (p: ReturnType<typeof releaseProof>) => { p.assets[0]!.digest = "sha256:" + "0".repeat(64); },
    (p: ReturnType<typeof releaseProof>) => { p.assets[0]!.updated_at = "2026-10-22T08:00:00Z"; },
    (p: ReturnType<typeof releaseProof>) => { p.assets[0]!.id++; },
    (p: ReturnType<typeof releaseProof>) => { p.assets.push(p.assets[0]!); },
  ];
  for (const change of variants) { const p = releaseProof(); change(p); await expect(verifyFinalDraftWindow(async () => new Response(JSON.stringify(p)), Date.parse("2026-10-23T00:00:00Z"), "postmeeting_archive")).rejects.toThrow(); }
  const denied = vi.fn<typeof fetch>(async () => new Response("", { status: 429 }));
  await expect(verifyFinalDraftWindow(denied, Date.parse("2026-10-23T00:00:00Z"), "postmeeting_archive")).rejects.toThrow(/429/); expect(denied).toHaveBeenCalledTimes(1);
  await expect(verifyFinalDraftWindow(async () => new Response("x".repeat(64001)), Date.parse("2026-10-23T00:00:00Z"), "postmeeting_archive")).rejects.toThrow(/byte budget/);
});
