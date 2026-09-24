import { mkdir } from "node:fs/promises";
import { openDataClient } from "../src/data/database";
import { runNpbDayDryRun } from "../src/data/npb-day-dry-run";

const date = process.argv.find((arg)=>/^--date=\d{4}-\d{2}-\d{2}$/.test(arg))?.slice(7);
if (!date) throw new Error("Pass --date=YYYY-MM-DD");
const url = process.env.TURSO_DATABASE_URL ?? "file:.data/baseball.db";
if (process.argv.includes("--require-remote") && (url.startsWith("file:") || !process.env.TURSO_AUTH_TOKEN))
  throw new Error("Remote database URL and token required");
if (url.startsWith("file:")) await mkdir(".data",{recursive:true});
const client = openDataClient(url,process.env.TURSO_AUTH_TOKEN);
try {
  const result = await runNpbDayDryRun(client,date,{rawRoot:process.argv.includes("--reuse-local-raw")?".data/raw":undefined});
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
  if (result.dayStatus!=="complete") process.exitCode=1;
} finally {client.close();}
