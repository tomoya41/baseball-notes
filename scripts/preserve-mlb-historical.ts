import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseHistoricalPublicArchive, validateHistoricalArchiveMembers, verifyHistoricalArchive } from "../src/data/mlb-public-archive";
import { generateHistoricalTeamHubs } from "./generate-historical-team-hubs";

const base = "https://tomoya41.github.io/baseball-notes/data/mlb/";
const target = process.argv[2] ?? "dist/data/mlb";
const probe = await fetch(`${base}historical/manifest.json.gz?v=${Date.now()}`);
if (probe.status === 404) {
  console.log("MLB historical payload not yet published; initial publish will supply it");
  process.exit(0);
}
if (!probe.ok) throw new Error(`Cannot check existing MLB historical payload: ${probe.status}`);
const pointerResponse = await fetch(`${base}historical-release.json?v=${Date.now()}`);
if (!pointerResponse.ok && pointerResponse.status !== 404) throw new Error(`Cannot read historical release pointer: ${pointerResponse.status}`);
const pointer = pointerResponse.ok ? parseHistoricalPublicArchive(await pointerResponse.json()) : null;
// Legacy Pages archives remain readable during migration or rollback.
const archiveResponse = await fetch(pointer?.assetUrl ?? `${base}historical-payload.tar.gz?v=${Date.now()}`);
if (!archiveResponse.ok) throw new Error(`Cannot preserve published MLB historical payload: ${archiveResponse.status}`);
const archive = Buffer.from(await archiveResponse.arrayBuffer());
let expected = pointer?.sha256;
if (!expected) {
  const checksumResponse = await fetch(`${base}historical-payload.sha256?v=${Date.now()}`);
  if (!checksumResponse.ok) throw new Error(`Cannot read historical checksum: ${checksumResponse.status}`);
  expected = (await checksumResponse.text()).trim();
}
verifyHistoricalArchive(archive, expected);
await mkdir(target, { recursive: true });
await mkdir(".data", { recursive: true });
const archivePath = join(await mkdtemp(".data/mlb-preserve-"), "historical-payload.tar.gz");
await writeFile(archivePath, archive);
const members = execFileSync("tar", ["-tzf", archivePath], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 })
  .split(/\r?\n/).filter(Boolean);
validateHistoricalArchiveMembers(members);
execFileSync("tar", ["-xzf", archivePath, "-C", target]);
const manifest = await readFile(join(target, "historical", "manifest.json.gz"));
if (!manifest.length) throw new Error("Preserved MLB historical manifest is empty");
if (pointer) await writeFile(join(target, "historical-release.json"), JSON.stringify(pointer));
else {
  // Preserve legacy compatibility until the MLB release workflow migrates it.
  await writeFile(join(target, "historical-payload.tar.gz"), archive);
  await writeFile(join(target, "historical-payload.sha256"), `${expected}\n`);
}
await unlink(archivePath);
await generateHistoricalTeamHubs(join(target, "historical"));
console.log(JSON.stringify({ archiveBytes: archive.length, sha256: expected, files: members.length, releaseAsset: Boolean(pointer) }));
