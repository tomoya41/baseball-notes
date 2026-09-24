import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const magic=Buffer.from("NPBBACK1");
export function backupKey(encoded:string):Buffer {
  const key=Buffer.from(encoded,"base64");
  if(key.length!==32) throw new Error("Backup key must decode to 32 bytes");
  return key;
}
export function encryptNpbBackup(input:Uint8Array,key:Buffer):Buffer {
  const nonce=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",key,nonce);
  const body=Buffer.concat([cipher.update(input),cipher.final()]);
  return Buffer.concat([magic,nonce,cipher.getAuthTag(),body]);
}
export function decryptNpbBackup(input:Uint8Array,key:Buffer):Buffer {
  const bytes=Buffer.from(input);
  if(bytes.length<36 || !bytes.subarray(0,8).equals(magic)) throw new Error("Invalid encrypted backup");
  const decipher=createDecipheriv("aes-256-gcm",key,bytes.subarray(8,20));
  decipher.setAuthTag(bytes.subarray(20,36));
  return Buffer.concat([decipher.update(bytes.subarray(36)),decipher.final()]);
}
