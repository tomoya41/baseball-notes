import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stageHistoricalCompetition } from "../src/data/mlb-publication-staging";

describe("corrected competition publication", () => {
  it.each(["regular", "postseason"] as const)("removes obsolete %s paths and preserves the other scope", async competition => {
    const root = await mkdtemp(join(tmpdir(), "mlb-staging-")), target = join(root, "dist/data/mlb/historical"), source = join(root, "generated");
    try {
      await mkdir(join(target, "postseason"), { recursive: true }); await mkdir(join(source, competition === "postseason" ? "postseason" : ""), { recursive: true });
      await writeFile(join(target, "regular-old.json.gz"), "regular old"); await writeFile(join(target, "postseason/post-old.json.gz"), "post old");
      const selected = competition === "postseason" ? "postseason/new.json.gz" : "new.json.gz";
      await writeFile(join(source, selected), "corrected");
      await stageHistoricalCompetition(source, target, competition);
      expect(await readFile(join(target, selected), "utf8")).toBe("corrected");
      if (competition === "postseason") {
        expect(await readFile(join(target, "regular-old.json.gz"), "utf8")).toBe("regular old");
        expect(await readdir(join(target, "postseason"))).toEqual(["new.json.gz"]);
      } else {
        expect(await readFile(join(target, "postseason/post-old.json.gz"), "utf8")).toBe("post old");
        expect((await readdir(target)).sort()).toEqual(["new.json.gz", "postseason"]);
      }
      await stageHistoricalCompetition(source, target, competition);
      expect(await readFile(join(target, selected), "utf8")).toBe("corrected");
      expect((await readdir(competition === "postseason" ? target : join(root, "dist/data/mlb"))).some(x => x.startsWith(".historical-"))).toBe(false);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("leaves published files intact when generation is missing and rejects unsafe targets", async () => {
    const root = await mkdtemp(join(tmpdir(), "mlb-staging-")), target = join(root, "dist/data/mlb/historical");
    try {
      await mkdir(target, { recursive: true }); await writeFile(join(target, "keep"), "original");
      await expect(stageHistoricalCompetition(join(root, "missing"), target, "regular")).rejects.toThrow("missing");
      expect(await readFile(join(target, "keep"), "utf8")).toBe("original");
      await expect(stageHistoricalCompetition(root, root, "regular")).rejects.toThrow("target");
      await expect(stageHistoricalCompetition(target, target, "regular")).rejects.toThrow("Overlapping");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
