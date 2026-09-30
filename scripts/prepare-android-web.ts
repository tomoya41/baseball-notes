import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
// Isolated shell only. Never bundle the published historical/NPB databases or raw PA.
const target = resolve(".data/android-web");
if (target !== resolve(".data", "android-web")) throw Error("Invalid Android shell directory");
await rm(target, { recursive: true, force: true }); await mkdir(target, { recursive: true });
for (const entry of await readdir("dist", { withFileTypes: true })) {
  if (entry.name === "data" || entry.name.startsWith(".")) continue;
  await cp(resolve("dist", entry.name), resolve(target, entry.name), { recursive: true });
}
