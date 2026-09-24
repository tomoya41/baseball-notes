import { access, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { openDataClient } from "../src/data/database";
import { restoreNpbBackup, verifyRestoredNpbRepository } from "../src/data/npb-backup";

const source = process.argv.find((arg)=>arg.startsWith("--from="))?.slice(7);
const target = process.argv.find((arg)=>arg.startsWith("--to="))?.slice(5);
if (!source || !target) throw new Error("Pass --from=<backup-directory> --to=<new-scratch-db-path>");
const destination=resolve(target);
try {await access(destination); throw new Error("Restore destination already exists");}
catch(error) {if ((error as NodeJS.ErrnoException).code!=="ENOENT") throw error;}
await mkdir(dirname(destination),{recursive:true});
const client=openDataClient(`file:${destination}`);
try {
  const manifest=await restoreNpbBackup(client,resolve(source));
  const readback=await verifyRestoredNpbRepository(client);
  process.stdout.write(`${JSON.stringify({result:"PASS",destination,schemaVersion:manifest.schemaVersion,
    tables:manifest.tables.map(({name,rows})=>({name,rows})),readback},null,2)}\n`);
} finally {client.close();}
