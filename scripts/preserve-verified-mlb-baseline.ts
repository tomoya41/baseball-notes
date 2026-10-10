import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { equivalentHistoricalPayload, protectedHistoricalPath } from "./lib/mlb-payload-preservation";

const args = process.argv.slice(2);
const get = (key: string) => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
const before = get("--before"), after = get("--after");
if (!before || !after) throw Error("Explicit baseline and candidate roots required");
const paths: string[] = [];
async function walk(root: string) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory()) await walk(join(root, entry.name));
    else {
      const path = relative(before!, join(root, entry.name)).replaceAll("\\", "/");
      if (entry.name.endsWith(".json.gz") && protectedHistoricalPath(path)) paths.push(path);
    }
  }
}
await walk(before);
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const checked: { path: string; baselineHash: string; candidateHash: string }[] = [];
// Verify the entire immutable set before reusing any bytes. Never conceal a source correction.
for (const path of paths) {
  const [oldBytes, newBytes] = await Promise.all([readFile(join(before, path)), readFile(join(after, path))]);
  if (!equivalentHistoricalPayload(path, JSON.parse(gunzipSync(oldBytes).toString()), JSON.parse(gunzipSync(newBytes).toString()))) throw Error(`Existing Historical content changed: ${path}`);
  checked.push({ path, baselineHash: sha(oldBytes), candidateHash: sha(newBytes) });
}
let reused = 0;
for (const row of checked) {
  if (row.baselineHash === row.candidateHash) continue;
  const [baselineBytes, candidateBytes] = await Promise.all([readFile(join(before, row.path)), readFile(join(after, row.path))]);
  if (sha(baselineBytes) !== row.baselineHash || sha(candidateBytes) !== row.candidateHash) throw Error("Payload changed during preservation");
  await writeFile(join(after, row.path), baselineBytes); reused++;
}
const report = { result: "PASS", verified: checked.length, reused, canonicalWrites: 0 };
if (get("--report")) await writeFile(get("--report")!, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
