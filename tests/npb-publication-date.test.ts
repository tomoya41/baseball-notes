import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { npbLatestPublicationDate } from "../scripts/lib/npb-publication-date";

describe("latest-only coordinated NPB publication", () => {
  it("uses the stored date, independent of the device date", () => {
    expect(npbLatestPublicationDate("2026-09-30")).toBe("2026-09-30");
    expect(npbLatestPublicationDate("2026-09-30", null)).toBe("2026-09-30");
  });
  it("accepts the actual latest date explicitly", () => {
    expect(npbLatestPublicationDate("2026-09-30", "2026-09-30")).toBe("2026-09-30");
  });
  it.each(["2026-09-29", "2026-10-01"])("rejects %s rather than relabeling current projections", date => {
    expect(() => npbLatestPublicationDate("2026-09-30", date)).toThrow(/historical replay is unsupported/);
  });
  it("fails closed with missing or invalid stored/requested dates", () => {
    for (const date of [undefined, null, "2026-02-30", ""])
      expect(() => npbLatestPublicationDate(date)).toThrow();
    for (const date of ["2026-02-30", "", "2026-09-30T00:00:00Z"])
      expect(() => npbLatestPublicationDate("2026-09-30", date)).toThrow();
  });
  it.each([
    ["publish-npb-hot", "new PlayerPeriodBatchService"],
    ["generate-npb-game-surface", "await readNpbGameIndex"],
    ["generate-npb-player-directory", "await writeNpbPlayerDirectoryAtomically"],
  ])("%s checks the cutoff before generating/writing projections", (script, operation) => {
    const code = readFileSync(`scripts/${script}.ts`, "utf8");
    const check = code.indexOf("npbLatestPublicationDate(");
    expect(check).toBeGreaterThan(-1);
    expect(code.indexOf(operation)).toBeGreaterThan(check);
  });
});
