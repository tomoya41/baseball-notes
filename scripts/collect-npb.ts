import { mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { openDataClient, migrateData } from "../src/data/database";
import { runNpbCollector, jstToday, addDays } from "../src/data/npb-collector";
import { NpbRepository } from "../src/data/npb-repository";
import { buildNpbStandingsPayload, writeNpbPayloadAtomically } from "../src/data/npb-payload";

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1] ?? null;
}

async function main(): Promise<void> {
  const targetDate = option("--date") ?? addDays(jstToday(),-1);
  const dryRun = process.argv.includes("--dry-run");
  const offlineRaw = process.argv.includes("--offline-raw");
  if (!process.argv.includes("--fetch") && !offlineRaw) throw new Error("Pass --fetch or --offline-raw explicitly");
  const url = process.env.TURSO_DATABASE_URL ?? "file:.data/baseball.db";
  const remote = !url.startsWith("file:");
  if (process.argv.includes("--require-remote") && (!remote || !process.env.TURSO_AUTH_TOKEN))
    throw new Error("Remote database URL and auth token are required");
  if (url.startsWith("file:")) await mkdir(".data",{ recursive: true });
  const client = openDataClient(url,process.env.TURSO_AUTH_TOKEN);
  try {
    await migrateData(client);
    const request = offlineRaw ? async (urlToRead: string): Promise<string> => {
      const source = new URL(urlToRead);
      const key = `${source.pathname.slice(1)}${source.search}`;
      const digest = createHash("sha256").update(key).digest("hex");
      const path = join(".data","raw","nf3",targetDate,`${digest}.html.gz`);
      return gunzipSync(await readFile(path)).toString("utf8");
    } : undefined;
    const result = await runNpbCollector(client,{ targetDate,dryRun,request,archivedCapture:offlineRaw,
      persistRawManifest: !remote,
      lookbackDays: Number(option("--lookback") ?? 3) });
    if (!dryRun && result.standings === 12) {
      const repository = new NpbRepository(client);
      const payload = await buildNpbStandingsPayload(repository);
      if (payload.throughDate !== targetDate) throw new Error("Payload target date mismatch");
      const path = join(option("--payload-root") ?? "public","data","standings","npb","latest.json");
      await writeNpbPayloadAtomically(path,payload);
    }
    process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
    if (result.standings !== 12 || result.errors.some((error)=>error.startsWith("games/"))) process.exitCode = 1;
  } finally { client.close(); }
}
await main();
