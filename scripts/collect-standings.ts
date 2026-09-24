import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { openDataClient, migrateData } from "../src/data/database";
import { extractGameInfo, normalizeRetrosheetGames, RETROSHEET_ARCHIVE_URL } from "../src/data/retrosheet";
import { SqliteStandingsRepository, syncSourceRegistry } from "../src/data/standings-repository";
import { FileArchiveStore } from "../src/data/archive";
import { standingsPayload } from "../src/data/payload";
import { cleanupExpired, retentionDays } from "../src/data/retention";

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1] ?? null;
}

async function loadArchive(): Promise<Uint8Array> {
  const file = option("--zip");
  if (file) return new Uint8Array(await readFile(file));
  if (!process.argv.includes("--fetch")) throw new Error("Pass --zip <file> or --fetch explicitly");
  const response = await fetch(RETROSHEET_ARCHIVE_URL, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Retrosheet HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 20_000_000) throw new Error("Unexpected archive size");
  await mkdir(".data/raw", { recursive: true });
  await writeFile(".data/raw/2025csvs.zip", bytes);
  return bytes;
}

async function main(): Promise<void> {
  const daily = process.argv.includes("--daily");
  if (daily) {
    // No approved current-season provider exists. Never mislabel 2025 history as today's data.
    process.stdout.write("skipped: no enabled current-season source; Retrosheet coverage ends in 2025\n");
    return;
  }
  const date = option("--date");
  if (!date) throw new Error("Pass --date YYYY-MM-DD");
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.TURSO_DATABASE_URL ?? "file:.data/baseball.db";
  if (url.startsWith("file:")) await mkdir(".data", { recursive: true });
  const client = openDataClient(url, process.env.TURSO_AUTH_TOKEN);
  try {
    await migrateData(client);
    if (!dryRun) await syncSourceRegistry(client);
    let csv: string;
    try {
      const zip = await loadArchive();
      csv = extractGameInfo(zip);
    } catch (error) {
      if (!dryRun) await client.execute({
        sql: "INSERT INTO ingestion_runs (run_id, source_key, target_date, started_at, finished_at, status, error_count, error_summary) VALUES (?, 'retrosheet-csv', ?, ?, ?, 'failed', 1, ?)",
        args: [randomUUID(), date, new Date().toISOString(), new Date().toISOString(), String(error).slice(0, 500)],
      });
      throw error;
    }
    if (!dryRun && process.argv.includes("--fetch")) {
      const storedAt = new Date();
      const expiresAt = new Date(storedAt.getTime() + retentionDays.rawResponse * 24 * 60 * 60 * 1000);
      await client.execute({
        sql: `INSERT INTO raw_response_manifest (object_key, source_key, archive_class, stored_at, expires_at)
              VALUES ('2025csvs.zip', 'retrosheet-csv', 'raw-response', ?, ?)
              ON CONFLICT(object_key) DO UPDATE SET stored_at=excluded.stored_at, expires_at=excluded.expires_at`,
        args: [storedAt.toISOString(), expiresAt.toISOString()],
      });
    }
    const repository = new SqliteStandingsRepository(client);
    const result = await repository.importRetrosheet2025(csv, date, dryRun);
    if (!dryRun) {
      try {
        const facts = normalizeRetrosheetGames(csv, 2025, new Date().toISOString());
        await new FileArchiveStore(".data/archive").putGameFacts("retrosheet-csv", 2025, facts);
        const payload = await standingsPayload(repository, date);
        const path = join("public", "data", "standings", "mlb", `${date}.json`);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, JSON.stringify(payload));
        await cleanupExpired(client, ".data/raw");
      } catch (error) {
        await client.execute({ sql: "UPDATE ingestion_runs SET status='partial', error_count=1, error_summary=? WHERE run_id=?", args: [String(error).slice(0, 500), result.runId] });
        throw error;
      }
    }
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    client.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
