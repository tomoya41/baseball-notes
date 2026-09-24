import { mkdir } from "node:fs/promises";
import { migrateData, openDataClient } from "../src/data/database";

const url=process.env.TURSO_DATABASE_URL??"file:.data/baseball.db";
if(process.argv.includes("--require-remote") && (url.startsWith("file:")||!process.env.TURSO_AUTH_TOKEN))
  throw new Error("Remote database required");
if(url.startsWith("file:")) await mkdir(".data",{recursive:true});
const client=openDataClient(url,process.env.TURSO_AUTH_TOKEN);
try {
  await migrateData(client);
  const versions=await client.execute("SELECT version FROM schema_migrations ORDER BY version");
  process.stdout.write(`Applied schema versions: ${versions.rows.map((row)=>Number(row.version)).join(",")}\n`);
} finally {client.close();}
