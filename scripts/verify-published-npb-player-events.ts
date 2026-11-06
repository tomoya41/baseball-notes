import { createHash } from "node:crypto";
import active from "../src/data/npb-player-events-release.json";
import retained from "../src/data/npb-player-events-retained-releases.json";

const activeOnly = process.argv.includes("--active-only");
const releases = activeOnly ? [active] : [active, ...retained];
const attempts = activeOnly ? 1 : 4;
const base = "https://tomoya41.github.io/baseball-notes/";
const appSha = process.env.EXPECTED_APP_INDEX_SHA256;
if (!activeOnly && (appSha || process.env.GITHUB_ACTIONS === "true") && !/^[a-f0-9]{64}$/.test(appSha ?? ""))
  throw Error("Staged app index hash required for deployment verification");

async function verify(path: string, sha256: string, size?: number) {
  const response = await fetch(`${base}${path}?verify=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw Error(`Published asset HTTP ${response.status}: ${path}`);
  if (Number(response.headers.get("content-length")) > 250_000) throw Error(`Published asset exceeds size limit: ${path}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if ((size !== undefined && bytes.length !== size) || createHash("sha256").update(bytes).digest("hex") !== sha256)
    throw Error(`Published asset hash or length mismatch: ${path}`);
}

let pending: { path: string; hash: string; size?: number }[] =
  releases.map(release => ({ path: `data/npb/events/${release.sha256}/2026.json`, hash: release.bodySha256, size: release.bytes }));
if (!activeOnly && appSha) pending.push({ path: "index.html", hash: appSha, size: undefined });
for (let attempt = 0; attempt < attempts; attempt++) {
  const results = await Promise.allSettled(pending.map(({ path, hash, size }) => verify(path, hash, size)));
  if (results.every(result => result.status === "fulfilled")) {
    console.log(JSON.stringify({ status: "PASS", versions: releases.length, activeEvents: active.events, activeSourceRevision: active.sourceRevision, appIndexVerified: !activeOnly && !!appSha }));
    break;
  }
  if (attempt === attempts - 1) {
    throw new AggregateError(results.flatMap(result => result.status === "rejected" ? [result.reason] : []), "Public player-event readback failed");
  }
  pending = pending.filter((_, index) => results[index]?.status === "rejected");
  await new Promise(resolve => setTimeout(resolve, 10_000));
}
