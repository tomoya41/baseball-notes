import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const base = "https://tomoya41.github.io/baseball-notes/data/mlb/";
const target = process.argv[2] ?? "dist/data/mlb";
const probe = await fetch(`${base}historical/manifest.json.gz?v=${Date.now()}`);
if (probe.status === 404) {
  console.log("MLB historical payload not yet published; initial publish will supply it");
  process.exit(0);
}
if (!probe.ok) throw new Error(`Cannot check existing MLB historical payload: ${probe.status}`);
const [archiveResponse, checksumResponse] = await Promise.all([
  fetch(`${base}historical-payload.tar.gz?v=${Date.now()}`),
  fetch(`${base}historical-payload.sha256?v=${Date.now()}`),
]);
if (!archiveResponse.ok || !checksumResponse.ok)
  throw new Error(`Cannot preserve published MLB historical payload: ${archiveResponse.status}/${checksumResponse.status}`);
const archive = Buffer.from(await archiveResponse.arrayBuffer());
const expected = (await checksumResponse.text()).trim();
const actual = createHash("sha256").update(archive).digest("hex");
if (!/^[0-9a-f]{64}$/.test(expected) || expected !== actual) throw new Error("MLB payload archive checksum mismatch");
await mkdir(target, { recursive: true });
const archivePath = join(target, "historical-payload.tar.gz");
await writeFile(archivePath, archive);
await writeFile(join(target, "historical-payload.sha256"), `${actual}\n`);
const members = execFileSync("tar", ["-tzf", archivePath], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 })
  .split(/\r?\n/).filter(Boolean);
if (!members.length || members.some(name => !/^historical(?:\/|$)/.test(name) || name.includes("..") || name.startsWith("/")))
  throw new Error("Unsafe MLB payload archive members");
execFileSync("tar", ["-xzf", archivePath, "-C", target]);
const manifest = await readFile(join(target, "historical", "manifest.json.gz"));
if (!manifest.length) throw new Error("Preserved MLB historical manifest is empty");
console.log(JSON.stringify({ archiveBytes: archive.length, sha256: actual, files: members.length }));
