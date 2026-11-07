import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it.each([
  ["16 KB", { enabled: true, alignment: "PAGE_ALIGNMENT_16K" }, 0],
  ["4 KB", { enabled: true, alignment: "PAGE_ALIGNMENT_4K" }, 1],
  ["missing alignment", { enabled: true }, 1],
  ["disabled native library optimization", { enabled: false, alignment: "PAGE_ALIGNMENT_16K" }, 1],
  ["missing configuration", undefined, 1],
])("checks the bundletool output for %s", (_name, uncompressNativeLibraries, exit) => {
  const result = spawnSync(process.execPath, ["scripts/verify-android-bundle-alignment.mjs"], {
    input: JSON.stringify({ optimizations: { uncompressNativeLibraries }, bundletool: { version: "1.18.1" } }),
    encoding: "utf8", timeout: 5000,
  });
  expect(result.status).toBe(exit);
});
