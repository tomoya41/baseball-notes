import { join } from "node:path";
import { openDataClient } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { buildNpbStandingsPayload, writeNpbPayloadAtomically } from "../src/data/npb-payload";
import { verifyNpbDatabase } from "../src/data/npb-verification";

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1] ?? null;
}

const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;
if (!url || url.startsWith("file:") || !token) throw new Error("Remote database URL and auth token are required");

const client = openDataClient(url, token);
try {
  const payload = await buildNpbStandingsPayload(new NpbRepository(client));
  const targetDate = option("--date");
  if (targetDate && payload.throughDate !== targetDate) throw new Error("Latest remote snapshot differs from requested date");
  const report = await verifyNpbDatabase(client, payload.throughDate);
  const path = join(option("--payload-root") ?? ".data/publish", "data", "standings", "npb", "latest.json");
  await writeNpbPayloadAtomically(path, payload);
  process.stdout.write(`${JSON.stringify({ ...report, generatedAt: payload.generatedAt })}\n`);
} finally { client.close(); }
