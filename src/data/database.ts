import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";

export type DataClient = Client;
export function openDataClient(url: string, authToken?: string): DataClient {
  if (!url.startsWith("file:") && !url.startsWith("libsql:") && !url.startsWith("https:"))
    throw new Error("Unsupported database URL");
  if (!url.startsWith("file:") && !authToken) throw new Error("Remote database token required");
  return createClient(authToken ? { url, authToken } : { url });
}

export async function migrateData(client: DataClient): Promise<void> {
  await client.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const version of [1, 2, 3]) {
    const existing = await client.execute({ sql: "SELECT version FROM schema_migrations WHERE version = ?", args: [version] });
    if (existing.rows.length > 0) continue;
    const name = version === 1 ? "001_data_foundation.sql" : version === 2 ? "002_npb_daily.sql" : "003_npb_game_completeness.sql";
    const path = fileURLToPath(new URL(`../../migrations/${name}`, import.meta.url));
    await client.executeMultiple(await readFile(path, "utf8"));
    await client.execute({ sql: "INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)", args: [version, new Date().toISOString()] });
  }
}
