import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { openDataClient } from "../src/data/database";
import { backupSizeBytes, exportNpbBackup, restoreNpbBackup, verifyRestoredNpbRepository } from "../src/data/npb-backup";

const args = new Set(process.argv.slice(2));
const url = process.env.TURSO_DATABASE_URL ?? "file:.data/baseball.db";
if (args.has("--require-remote") && (url.startsWith("file:") || !process.env.TURSO_AUTH_TOKEN))
  throw new Error("Remote database URL and token required");
await mkdir(".data",{ recursive:true });
const root = await mkdtemp(join(".data","backup-drill-"));
const source = openDataClient(url,process.env.TURSO_AUTH_TOKEN);
try {
  const backup = join(root,"export");
  const manifest = await exportNpbBackup(source,backup,url.startsWith("file:") ? "local" : "turso-remote");
  const scratch = openDataClient(`file:${join(root,"scratch.db")}`);
  try {
    const restored = await restoreNpbBackup(scratch,backup);
    const readback = await verifyRestoredNpbRepository(scratch);
    process.stdout.write(`${JSON.stringify({ result:"PASS",directory:root,compressedBytes:await backupSizeBytes(backup),
      schemaVersion:restored.schemaVersion,tables:manifest.tables.map(({name,rows,bytes,sha256}) => ({name,rows,bytes,sha256})),
      readback },null,2)}\n`);
  } finally { scratch.close(); }
} finally { source.close(); }
