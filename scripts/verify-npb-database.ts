import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { openDataClient } from "../src/data/database";
import { addDays, jstToday } from "../src/data/npb-collector";
import { verifyNpbDatabase } from "../src/data/npb-verification";
import { npbLatestStandingsSchema } from "../src/domain/standings";

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1] ?? null;
}

const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;
if (!url || url.startsWith("file:") || !token) throw new Error("Remote database URL and auth token are required");
const client = openDataClient(url, token);
try {
  if (process.argv.includes("--connection-only")) {
    try {
      await client.execute("SELECT 1");
      process.stdout.write('{"connection":"ok","queries":1,"writes":0,"tableScans":0,"integrityVerified":false}\n');
    } catch (error) {
      // No credentials, database URL, table contents or unredacted provider exception.
      const blocked = error instanceof Error && /SQL read operations are forbidden/i.test(error.message);
      process.stdout.write(`${JSON.stringify({ connection: blocked ? "reads_blocked" : "unavailable", queries: 1, writes: 0, tableScans: 0, integrityVerified: false })}\n`);
      process.exitCode = 1;
    }
  } else {
    const targetDate = option("--date") ?? addDays(jstToday(), -1);
    const report = await verifyNpbDatabase(client, targetDate);
    const payloadRoot = option("--payload-root");
    if (payloadRoot) {
      const path = join(payloadRoot, "data", "standings", "npb", "latest.json");
      const payload = npbLatestStandingsSchema.parse(JSON.parse(await readFile(path, "utf8")) as unknown);
      if (payload.throughDate !== targetDate) throw new Error("Published payload date differs from verified DB date");
    }
    process.stdout.write(`${JSON.stringify(report)}\n`);
  }
} finally { client.close(); }
