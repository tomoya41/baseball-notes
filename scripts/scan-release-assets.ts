import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const root = process.argv[2] ?? "dist";
let files = 0, bytes = 0;
async function scan(path: string) { for (const entry of await readdir(path, { withFileTypes: true })) {
  const full = join(path, entry.name); if (entry.isDirectory()) await scan(full); else {
    const buffer = await readFile(full); files++; bytes += buffer.length;
    if (/\.(js|json|html|xml|properties|txt)$/.test(entry.name) && /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|"private_key"\s*:|libsql:\/\/|TURSO_AUTH_TOKEN\s*[=:]|service_account"/.test(buffer.toString("utf8")))
      throw Error(`Private credential pattern in release file: ${entry.name}`);
  }
} }
await scan(root); console.log(JSON.stringify({ securityScan: "PASS", files, bytes }));
