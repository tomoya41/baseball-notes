import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const paths = ["players/latest.json", "catalog/latest.json", "capabilities.json", "milestones/2026/latest.json", "teams/season/2026/latest.json"];
const digest = async (path: string) => createHash("sha256").update(await readFile(`.data/publish/data/npb/${path}`)).digest("hex");
const before = await Promise.all(paths.map(digest));
const report = JSON.parse(execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/generate-npb-game-surface.ts"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] })) as { queries: number; canonicalWrites: number };
const after = await Promise.all(paths.map(digest));
if (before.some((value, i) => value !== after[i]) || report.canonicalWrites !== 0)
  throw Error("Read-only product projection idempotency failed");
console.log(JSON.stringify({ result: "PASS", canonicalWrites: 0, repeatSelects: report.queries,
  files: paths.map((path, i) => ({ path, sha256: after[i] })) }));
