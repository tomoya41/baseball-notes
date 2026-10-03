import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { finalizePostseasonCapabilities } from "../scripts/lib/postseason-publication";
import { readFileSync } from "node:fs";

describe("whole-site postseason availability admission", () => {
  it("does not advertise absent initial data and rejects a partial subtree before publishing capabilities", async () => {
    const root = await mkdtemp(join(tmpdir(),"postseason-capability-"));
    try {
      const cap = await finalizePostseasonCapabilities(root);
      expect(cap.leagues.MLB.postseasonSeries.status).toBe("not_ready");
      const file = join(root,"data/postseason/capabilities.json"), before = await readFile(file,"utf8");
      await mkdir(join(root,"data/mlb/historical/postseason"),{recursive:true});
      await expect(finalizePostseasonCapabilities(root)).rejects.toThrow();
      expect(await readFile(file,"utf8")).toBe(before);
    } finally { await rm(root,{recursive:true,force:true}); }
  });
  it("finalizes availability inside the shared guard used by every whole-site publish path", () => {
    const guard = readFileSync(new URL("../scripts/verify-npb-publication.ts",import.meta.url),"utf8");
    expect(guard).toContain("await finalizePostseasonCapabilities(root)");
    const finalizer = readFileSync(new URL("../scripts/lib/postseason-publication.ts",import.meta.url),"utf8");
    expect(finalizer).toContain("{ requireDerivedProducts: true }");
    for(const name of ["daily-collector","npb-eod-watcher","npb-season-publish","npb-player-directory-publish","npb-hot-publish","mlb-historical-publish"]) {
      const workflow = readFileSync(new URL(`../.github/workflows/${name}.yml`,import.meta.url),"utf8");
      expect(workflow.indexOf("verify-npb-publication.ts dist")).toBeLessThan(workflow.indexOf("actions/upload-pages-artifact"));
    }
  });
});
