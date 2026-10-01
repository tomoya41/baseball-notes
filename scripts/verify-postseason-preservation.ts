import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
const [mode, root = "dist/data/mlb/historical"] = process.argv.slice(2);
if (mode !== "before" && mode !== "after") throw new Error("Expected before/after");
const hashes: Record<string, string> = {};
async function scan(dir: string) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (dir === root && entry.name === "postseason") continue;
    const file = join(dir, entry.name);
    if (entry.isDirectory()) await scan(file);
    else hashes[relative(root, file).replaceAll("\\", "/")] = createHash("sha256").update(await readFile(file)).digest("hex");
  }
}
await scan(root);
const path = ".data/postseason-regular-preservation.json";
if (mode === "before") await writeFile(path, JSON.stringify(hashes));
else {
  const before = JSON.parse(await readFile(path, "utf8"));
  if (Object.keys(before).length !== Object.keys(hashes).length || Object.entries(hashes).some(([path, hash]) => before[path] !== hash)) throw new Error("Regular Season public bytes changed");
  console.log(JSON.stringify({ result: "PASS", regularFilesUnchanged: Object.keys(hashes).length }));
}
