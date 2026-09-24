import { rm } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { DataClient } from "./database";

export const retentionDays = {
  fact: null, standings: null, seasonFinal: null, historicalRecord: null,
  seasonTotalDiagnostic: 30, rawResponse: 14, displayCache: 7, temporaryImport: 3,
} as const;

function withinRoot(root: string, key: string): string {
  if (isAbsolute(key) || key.split(/[\\/]/).includes("..")) throw new Error("Unsafe archive key");
  const target = resolve(root, key);
  const path = relative(resolve(root), target);
  if (path === "" || path.startsWith("..") || isAbsolute(path)) throw new Error("Unsafe archive key");
  return target;
}

export async function cleanupExpired(client: DataClient, rawRoot: string, now = new Date().toISOString()): Promise<{ cache: number; derived: number; raw: number }> {
  const expired = await client.execute({ sql: "SELECT object_key FROM raw_response_manifest WHERE expires_at <= ?", args: [now] });
  // Resolve every path before deleting any file; a malformed manifest must fail closed.
  const paths = expired.rows.map((row) => withinRoot(rawRoot, String(row.object_key)));
  for (const path of paths) await rm(path, { force: true });
  const [cache, derived, raw] = await client.batch([
    { sql: "DELETE FROM display_cache WHERE expires_at <= ?", args: [now] },
    { sql: "DELETE FROM derived_payloads WHERE expires_at IS NOT NULL AND expires_at <= ?", args: [now] },
    { sql: "DELETE FROM raw_response_manifest WHERE expires_at <= ?", args: [now] },
  ], "write");
  if (!cache || !derived || !raw) throw new Error("Cleanup result missing");
  return { cache: cache.rowsAffected, derived: derived.rowsAffected, raw: raw.rowsAffected };
}
