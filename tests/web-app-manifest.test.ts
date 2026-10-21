import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("keeps install identity, hash route and icons inside both root and Pages scope", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
  expect(manifest.display).toBe("standalone");
  expect(manifest.name).toBe("Baseball Notes");
  for (const base of ["https://example.test/", "https://tomoya41.github.io/baseball-notes/"]) {
    const scope = new URL(manifest.scope, base);
    expect(new URL(manifest.id, base).href).toBe(scope.href);
    const start = new URL(manifest.start_url, base);
    expect(start.pathname).toBe(scope.pathname);
    expect(start.hash).toBe("#/NPB/home");
    for (const icon of manifest.icons) expect(new URL(icon.src, base).pathname.startsWith(scope.pathname)).toBe(true);
  }
  expect(manifest.icons.map((icon: {sizes:string}) => icon.sizes)).toEqual(["192x192", "512x512", "512x512"]);
  expect(manifest.icons.at(-1).purpose).toBe("maskable");
  for (const icon of manifest.icons) {
    const png = readFileSync(resolve("public", icon.src));
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    const size = Number(icon.sizes.split("x")[0]);
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  }
  expect(readFileSync("index.html", "utf8")).toContain('href="%BASE_URL%manifest.webmanifest"');
});
