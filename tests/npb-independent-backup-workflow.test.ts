import { readFile, mkdtemp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parse } from "yaml";
import { expect, it } from "vitest";

const workflow = parse(await readFile(".github/workflows/npb-backup-drill.yml", "utf8"));
it("fails the drill when the backup command fails even if tee successfully writes its report", async () => {
  const step = workflow.jobs.drill.steps.find((s: { name?: string }) => s.name?.startsWith("Export Turso"));
  const interpreter = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/bash";
  if (!existsSync(interpreter)) throw Error("Bash is required for the backup failure regression");
  const dir = await mkdtemp(join(tmpdir(), "npb-independent-pipe-"));
  // No database/npm/network call: the fake command models an actual blocked SQL export.
  const result = spawnSync(interpreter, ["--noprofile", "--norc", "-c", `npm() { return 7; }\n${step.run}`], { cwd: dir, encoding: "utf8" });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(7);
});
it("never uploads plaintext backup data, and keeps independent backup separate from scheduled collection", () => {
  expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
  expect(workflow.on.workflow_dispatch.inputs.retain_encrypted.default).toBe(false);
  const upload = workflow.jobs.drill.steps.find((s: { uses?: string }) => s.uses?.includes("upload-artifact"));
  const paths = (upload.with.path as string).trim().split("\n");
  expect(paths.every(p => p.endsWith(".enc") || p === ".data/npb-independent-backup-summary.json")).toBe(true);
  expect(paths.some(p => /[*?]/.test(p))).toBe(false);
  expect(upload.if).toContain("success()");
  expect(upload.with.name).not.toContain("npb-facts-encrypted");
  expect(upload.with["retention-days"]).toBe(7);
});
