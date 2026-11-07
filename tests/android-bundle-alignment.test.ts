import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
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

it("waits for bundletool to produce its configuration on a pipe", async () => {
  const input = JSON.stringify({ optimizations: { uncompressNativeLibraries: { enabled: true, alignment: "PAGE_ALIGNMENT_16K" } } });
  const verifier = spawn(process.execPath, ["scripts/verify-android-bundle-alignment.mjs"], { stdio: ["pipe", "ignore", "ignore"] });
  const producer = spawn(process.execPath, ["-e", "setTimeout(() => process.stdout.write(process.argv[1]), 250)", input],
    { stdio: ["ignore", "pipe", "ignore"] });
  verifier.stdin.on("error", () => {}); // The verifier exit code reports a rejected or prematurely closed pipe.
  producer.stdout.pipe(verifier.stdin);
  const [[sourceExit], [verifierExit]] = await Promise.all([once(producer, "exit"), once(verifier, "exit")]);
  expect(sourceExit).toBe(0);
  expect(verifierExit).toBe(0);
});
