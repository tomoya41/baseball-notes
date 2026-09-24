import { expect, test } from "vitest";
import { backupKey, decryptNpbBackup, encryptNpbBackup } from "../src/data/npb-backup-crypto";

test("backup encryption roundtrips without plaintext disclosure and rejects tampering",()=>{
  const key=backupKey(Buffer.alloc(32,7).toString("base64")); // non-production test key
  const plain=Buffer.from("portable SQLite export");
  const encrypted=encryptNpbBackup(plain,key);
  expect(encrypted.includes(plain)).toBe(false);
  expect(decryptNpbBackup(encrypted,key)).toEqual(plain);
  encrypted[encrypted.length-1]=encrypted[encrypted.length-1]!^1;
  expect(()=>decryptNpbBackup(encrypted,key)).toThrow();
  expect(()=>backupKey("short")).toThrow();
});
