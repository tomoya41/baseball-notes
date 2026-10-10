import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { gunzipSync } from "node:zlib";
const args = process.argv.slice(2);
const get = (key: string) => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
const before = get("--before"), after = get("--after");
if (!before || !after) throw Error("Explicit --before / --after historical roots required");
let hashUnchanged = 0, profileUnchanged = 0, hubUnchanged = 0;
const failures: string[] = [], paths: string[] = [];
async function walk(root: string) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory()) await walk(join(root, entry.name));
    else if (entry.name.endsWith(".json.gz")) paths.push(relative(before!, join(root, entry.name)).replaceAll("\\", "/"));
  }
}
await walk(before);
const parse = (bytes: Buffer) => JSON.parse(gunzipSync(bytes).toString());
for (const path of paths) {
  const scoped = path.replace(/^postseason\//, ""), oldBytes = await readFile(join(before, path));
  const old = parse(oldBytes);
  if (scoped.startsWith("players/") && scoped !== "players/index.json.gz") {
    const current = parse(await readFile(join(after, path)));
    const knownYears: number[] = old.player.seasons;
    const same = ["id", "name", "bats", "throws", "retrosheetId", "chadwick"].every(field => isDeepStrictEqual(old.player[field], current.player[field])) &&
      ["positions", "teamIds"].every(field => old.player[field].every((value: string) => current.player[field].includes(value))) &&
      knownYears.every(year => current.player.seasons.includes(year) && isDeepStrictEqual(old.seasonTotals[year], current.seasonTotals[year])) &&
      ["batting", "pitching"].every(role => isDeepStrictEqual(old[role], current[role].filter((row: { season: number }) => knownYears.includes(row.season))));
    if (!same) failures.push(`Profile existing identity/Facts/totals: ${path}`); else profileUnchanged++;
  } else if (scoped.startsWith("hub/")) {
    const current = parse(await readFile(join(after, path)));
    delete old.generatedAt; delete current.generatedAt;
    delete old.provenance.verifiedAt; delete current.provenance.verifiedAt;
    if (!isDeepStrictEqual(old, current)) failures.push(`Hub semantics: ${path}`); else hubUnchanged++;
  } else if (/^(games|schedule|seasons|teams|chronology|exploration\/recent)\//.test(scoped) || /^records\/\d{4}\.json\.gz$/.test(scoped) || /^advanced\/202[0-5]\//.test(scoped)) {
    const current = await readFile(join(after, path));
    if (createHash("sha256").update(oldBytes).digest("hex") !== createHash("sha256").update(current).digest("hex")) failures.push(`Protected payload hash: ${path}`);
    else hashUnchanged++;
  }
}
const report = { result: failures.length ? "FAIL" : "PASS", hashUnchanged, profileUnchanged, hubUnchanged, failures };
await writeFile(get("--report") ?? ".data/mlb-history-preservation.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (failures.length) throw Error("Existing published Historical data changed");
