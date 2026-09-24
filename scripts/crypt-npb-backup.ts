import { readFile, writeFile } from "node:fs/promises";
import { backupKey, decryptNpbBackup, encryptNpbBackup } from "../src/data/npb-backup-crypto";

const [mode,input,output]=process.argv.slice(2);
if((mode!=="encrypt"&&mode!=="decrypt")||!input||!output)
  throw new Error("Usage: crypt-npb-backup.ts encrypt|decrypt <input> <output>");
const encoded=process.env.NPB_BACKUP_ENCRYPTION_KEY;
if(!encoded) throw new Error("NPB_BACKUP_ENCRYPTION_KEY secret is required");
const key=backupKey(encoded);
const inputBytes=await readFile(input);
if(mode==="encrypt") {
  await writeFile(output,encryptNpbBackup(inputBytes,key),{flag:"wx"});
} else {
  await writeFile(output,decryptNpbBackup(inputBytes,key),{flag:"wx"});
}
