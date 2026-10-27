import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { evaluateWeeklyAiOffline } from "./lib/weekly-ai-evaluation";

const args = process.argv.slice(2);
if (args.length !== 2 || args.some(arg => arg.startsWith("--"))) throw Error("Usage: evaluate-weekly-ai.ts <prepared-weekly-evidence.json> <local-report.json>");
const sourcePath = resolve(args[0]!), outputPath = resolve(args[1]!);
if (sourcePath === outputPath) throw Error("Evaluation must not overwrite evidence");
if ((await stat(sourcePath)).size > 256_000) throw Error("Evaluation evidence exceeds budget");
const report = evaluateWeeklyAiOffline(JSON.parse(await readFile(sourcePath, "utf8")));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: report.failed ? "OFFLINE_EVALUATION_FAILED" : report.candidates ? "OFFLINE_CONTROLS_PASSED" : "NO_SUPPORTED_CANDIDATES", inputSha256: report.inputSha256, passed: report.passed, failed: report.failed, aiRequests: 0, adoption: report.adoption, publiclyAdmitted: false }));
if (report.failed) process.exitCode = 1;
