import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { historicalPublicArchivePointer, parseHistoricalPublicArchive, verifyHistoricalArchive } from "../src/data/mlb-public-archive";

const target = resolve(process.argv[2] ?? "dist/data/mlb");
const pointerPath = join(target, "historical-release.json");
let existing = null;
try { existing = parseHistoricalPublicArchive(JSON.parse(await readFile(pointerPath, "utf8"))); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
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
      "--notes", "Content-addressed copy of the app's public MLB historical aggregates and game read models. Retrosheet and Chadwick attribution is available in the app's Data Sources page. No raw PA rows, source archives, credentials or private database backup are included."]);
  }
  await writeFile(pointerPath, `${JSON.stringify(pointer)}\n`);
  console.log(JSON.stringify({ reused: false, archiveBytes: archive.length, ...pointer }));
}
// These are known generated files in the explicitly selected payload directory.
for (const name of ["historical-payload.tar.gz", "historical-payload.sha256"]) {
  try { await unlink(join(target, name)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}
