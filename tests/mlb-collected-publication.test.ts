import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
describe("Collected Records publication scope isolation", () => {
  it("accepts a legacy Regular-only app archive but requires both complete expansion scopes", () => {
    const root = mkdtempSync(join(tmpdir(), "mlb-release-years-"));
    try {
      const payload = { schemaVersion: 1, league: "MLB", current2026: "unavailable", teams: [{ id: "mlb:team:00000000-0000-5000-8000-000000000002", name: "Fixture" }], seasons: [2020, 2021, 2022, 2023, 2024, 2025].map(season => ({ season, firstDate: `${season}-07-01`, lastDate: `${season}-09-01`, games: 1, playerCount: 1, coverage: "complete" })) };
      writeFileSync(join(root, "manifest.json.gz"), gzipSync(JSON.stringify(payload)));
      const run = (mode: string) => execFileSync(process.execPath, ["--import", "tsx", "scripts/verify-mlb-release-manifests.ts", root, mode], { stdio: "pipe" });
      expect(() => run("app-only")).not.toThrow();
      expect(() => run("expansion")).toThrow();
      mkdirSync(join(root, "postseason"));
      writeFileSync(join(root, "postseason/manifest.json.gz"), gzipSync(JSON.stringify({ ...payload, competitionType: "postseason" })));
      expect(() => run("app-only")).not.toThrow();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 20000);
  it.each(["regular", "postseason"])("updates only %s and validates advertised aggregate periods", scope => {
    const root = mkdtempSync(join(tmpdir(), "mlb-collected-fixture-")), base = scope === "regular" ? root : join(root, "postseason");
    const opposite = scope === "regular" ? join(root, "postseason") : root;
    try {
      mkdirSync(join(base, "players"), { recursive: true }); mkdirSync(join(base, "seasons")); mkdirSync(join(base, "records")); mkdirSync(opposite, { recursive: true });
      const write = (path: string, data: unknown) => writeFileSync(join(base, `${path}.gz`), gzipSync(JSON.stringify({ ...(data as object), ...(scope === "postseason" ? { competitionType: scope } : {}) })));
      const id = "mlb:player:00000000-0000-5000-8000-000000000001", team = "mlb:team:00000000-0000-5000-8000-000000000002";
      write("manifest.json", { schemaVersion: 1, league: "MLB", current2026: "unavailable", seasons: [{ season: 2020, firstDate: "2020-07-23", lastDate: "2020-09-27", games: 1, coverage: "complete", playerCount: 1 }], teams: [{ id: team, name: "Fixture" }], features: { directBvp: "unavailable" } });
      write("players/index.json", { schemaVersion: 1, league: "MLB", players: [{ id, name: "Fixture", positions: [], seasons: [2020], teamIds: [team] }] });
      write("seasons/2020.json", { schemaVersion: 1, league: "MLB", season: 2020, coverage: "complete", firstDate: "2020-07-23", lastDate: "2020-09-27", gameCount: 1, players: [{ playerId: id, batting: { H: { value: 3, status: "complete" } }, pitching: null }] });
      const untouched = join(opposite, "manifest.json.gz"), sentinel = Buffer.from("Opposite generation, not a collector fixture");
      writeFileSync(untouched, sentinel);
      execFileSync(process.execPath, ["--import", "tsx", "scripts/generate-mlb-collected-records.ts", root, "--competition", scope], { stdio: "pipe" });
      expect(readFileSync(untouched)).toEqual(sentinel);
      const manifest = JSON.parse(gunzipSync(readFileSync(join(base, "manifest.json.gz"))).toString());
      const range = JSON.parse(gunzipSync(readFileSync(join(base, "records/range.json.gz"))).toString());
      expect(manifest.collectedRecordPeriods.map((p: { id: string }) => p.id)).toEqual(["range", "decade-2020"]);
      expect(range.collectedSeasons).toEqual([2020]); expect(range.records[0].rows[0].value).toBe(3); expect(range.rate).toBe("not_ready");
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 20000);
});
