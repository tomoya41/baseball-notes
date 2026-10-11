import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { validStaticPayload } from "../../src/domain/mlb-historical-public";
import { MLB_BASELINE_SEASONS, MLB_PREVIOUS_EXPANSION_SEASONS, MLB_HISTORICAL_SEASONS } from "../../src/domain/mlb-historical-seasons";

const paths = ["manifest.json", "postseason/manifest.json"] as const;
const digest = (body: Uint8Array) => createHash("sha256").update(body).digest("hex");
function checkHashes(hashes: Record<string, string>, mode: string) {
  if (!["expansion", "app-only"].includes(mode) || !hashes[paths[0]] || Object.keys(hashes).some(p => !paths.includes(p as typeof paths[number]) || !/^[a-f0-9]{64}$/.test(hashes[p]!)) || mode === "expansion" && !hashes[paths[1]]) throw Error("Invalid staged Historical manifest hashes or mode");
}
function checkManifest(path: string, body: Uint8Array, mode: string) {
  const value: unknown = JSON.parse(gunzipSync(body).toString());
  if (!validStaticPayload(path, value)) throw Error("Historical public contract");
  const manifest = value as { seasons: { season: number; coverage: string }[] };
  const years = manifest.seasons.map(s => s.season);
  const allowed = mode === "expansion" ? [MLB_HISTORICAL_SEASONS] : [MLB_BASELINE_SEASONS, MLB_PREVIOUS_EXPANSION_SEASONS, MLB_HISTORICAL_SEASONS];
  if (!allowed.some(a => a.join(",") === years.join(",")) || manifest.seasons.some(s => s.coverage !== "complete")) throw Error("Historical public contract");
  return years;
}

export async function stagedHistoricalManifestHashes(root: string, mode: string) {
  const hashes: Record<string, string> = {};
  for (const path of paths) {
    let body;
    try { body = await readFile(join(root, path + ".gz")); }
    catch (error) { if (mode === "app-only" && path === paths[1] && (error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    checkManifest(path, body, mode); hashes[path] = digest(body);
  }
  checkHashes(hashes, mode); return hashes;
}

/** CDN lag never counts as successful publication. Retry only within a fixed budget. */
export async function verifyHistoricalManifestReadback(hashes: Record<string, string>, mode: string,
  options: { request?: typeof fetch; wait?: () => Promise<void>; attempts?: number } = {}) {
  checkHashes(hashes, mode);
  const attempts = options.attempts ?? 12;
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 12) throw Error("Invalid readback retry budget");
  const request = options.request ?? fetch, wait = options.wait ?? (() => new Promise<void>(r => setTimeout(r, 10_000)));
  let requests = 0, lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const seasons: Record<string, number[]> = {};
      for (const path of Object.keys(hashes)) {
        requests++;
        const response = await request(`https://tomoya41.github.io/baseball-notes/data/mlb/historical/${path}.gz?verify=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
        // Consume every response, including an old generation or HTTP failure.
        const body = new Uint8Array(await response.arrayBuffer());
        if (!response.ok || digest(body) !== hashes[path]) throw Error(`Historical manifest generation mismatch: ${path}`);
        seasons[path] = checkManifest(path, body, mode);
      }
      return { result: "PASS", requests, attempts: attempt + 1, seasons, canonicalWrites: 0 };
    } catch (error) { lastError = error; }
    if (attempt + 1 < attempts) await wait();
  }
  throw new Error("Published Historical manifests did not match staged hashes within retry budget", { cause: lastError });
}
