import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { parse } from "yaml";

test("form publication validates additions and preserves all old bytes before refreshing archive", async () => {
  const workflow = parse(await readFile(".github/workflows/mlb-historical-publish.yml", "utf8"));
  const stage = workflow.jobs.stage.steps.find((s: { name?: string }) => s.name === "Stage compressed Historical payload and preservation archive");
  const script: string = stage.run;
  const generation = script.indexOf("scripts/generate-historical-form.ts");
  const validation = script.indexOf("scripts/verify-historical-form.ts");
  const preservation = script.indexOf("scripts/verify-form-preservation.ts");
  const refresh = script.indexOf("scripts/publish-mlb-public-archive.ts dist/data/mlb --refresh");
  expect(generation).toBeGreaterThan(0); expect(validation).toBeGreaterThan(generation);
  expect(preservation).toBeGreaterThan(validation); expect(refresh).toBeGreaterThan(preservation);
  expect(script).toContain('[ "$MLB_REFRESH_FORM" != \'true\' ]');
  expect(stage.env.TURSO_DATABASE_URL).toBeUndefined();
  expect(workflow.jobs.deploy.steps.some((s: { run?: string }) => s.run === "npx tsx scripts/verify-published-historical-form.ts")).toBe(true);
});
