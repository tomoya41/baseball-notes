import { writeFile } from "node:fs/promises";
import { auditHistoricalPostseason } from "./lib/mlb-postseason-audit";
const args = process.argv.slice(2), get = (key: string, fallback: string) => args.includes(key) ? args[args.indexOf(key) + 1]! : fallback;
const { report } = await auditHistoricalPostseason(get("--root", ".data/postseason-public/data/mlb/historical"), get("--regular-root", ".data/mlb-public/data/mlb/historical"));
await writeFile(get("--report", ".data/postseason-public-audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
