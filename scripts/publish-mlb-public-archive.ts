import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { HISTORICAL_PUBLIC_ARCHIVE_ATTRIBUTION, hasHistoricalSourceAttribution, historicalPublicArchivePointer, parseHistoricalPublicArchive, verifyHistoricalArchive } from "../src/data/mlb-public-archive";

const target = resolve(process.argv[2] ?? "dist/data/mlb");
const pointerPath = join(target, "historical-release.json");
let existing = null;
try { existing = parseHistoricalPublicArchive(JSON.parse(await readFile(pointerPath, "utf8"))); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
const attributionPath = join(target, "historical", "ATTRIBUTION.txt");
let attribution = null;
try { attribution = await readFile(attributionPath, "utf8"); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
// Existing attributed releases are immutable. An app-only deployment must reuse
// their pointer even when explanatory wording in this script changes.
const refresh = process.argv.includes("--refresh");
if ((!existing || refresh || !hasHistoricalSourceAttribution(attribution)) && attribution !== HISTORICAL_PUBLIC_ARCHIVE_ATTRIBUTION) {
  await writeFile(attributionPath, HISTORICAL_PUBLIC_ARCHIVE_ATTRIBUTION);
  // Migrate the legacy public copy into an attributed immutable archive.
  existing = null;
}
// Explicit release replacement; app-only preservation must never rebuild the archive.
if (refresh) existing = null;
if (existing) console.log(JSON.stringify({ reused: true, ...existing }));
else {
  await mkdir(".data", { recursive: true });
  const staging = await mkdtemp(".data/mlb-release-archive-");
  const archivePath = resolve(staging, "historical-payload.tar.gz");
  execFileSync("tar", ["-C", target, "-czf", archivePath, "historical"]);
  const archive = await readFile(archivePath);
  const pointer = historicalPublicArchivePointer(archive);
  const tag = `mlb-historical-${pointer.sha256.slice(0, 24)}`;
  const repo = "tomoya41/baseball-notes";
  let releaseExists = false;
  try { execFileSync("gh", ["release", "view", tag, "--repo", repo], { stdio: "pipe" }); releaseExists = true; }
  catch { /* An absent content-addressed release is created below. */ }
  if (releaseExists) {
    const comparison = await mkdtemp(".data/mlb-release-compare-");
    execFileSync("gh", ["release", "download", tag, "--repo", repo, "--pattern", "historical-payload.tar.gz", "--dir", comparison]);
    verifyHistoricalArchive(await readFile(join(comparison, "historical-payload.tar.gz")), pointer.sha256);
  } else {
    execFileSync("gh", ["release", "create", tag, archivePath, "--repo", repo, "--target", process.env.GITHUB_SHA ?? "main",
      "--latest=false", "--title", "MLB historical public aggregate preservation",
      "--notes", `${HISTORICAL_PUBLIC_ARCHIVE_ATTRIBUTION}\nContent-addressed public aggregate preservation. No raw PA rows, source archives, credentials or private database backup are included.`]);
  }
  await writeFile(pointerPath, `${JSON.stringify(pointer)}\n`);
  console.log(JSON.stringify({ reused: false, archiveBytes: archive.length, ...pointer }));
}
// These are known generated files in the explicitly selected payload directory.
for (const name of ["historical-payload.tar.gz", "historical-payload.sha256"]) {
  try { await unlink(join(target, name)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}
