import { createHash } from "node:crypto";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { parse } from "yaml";
import { expect, it, vi } from "vitest";
import { stagedHistoricalManifestHashes, verifyHistoricalManifestReadback } from "../scripts/lib/mlb-public-readback";
const full = Array.from({ length: 12 }, (_, i) => 2014 + i);
const sha = (v: Uint8Array) => createHash("sha256").update(v).digest("hex");
const body = (years = full, competition?: string, coverage = "complete") => gzipSync(JSON.stringify({ schemaVersion: 1, league: "MLB", current2026: "unavailable", ...(competition ? { competitionType: competition } : {}),
  seasons: years.map(season => ({ season, firstDate: `${season}-04-01`, lastDate: `${season}-10-01`, games: 1, playerCount: 1, coverage })),
  teams: [{ id: "mlb:team:00000000-0000-5000-8000-000000000001", name: "team" }] }));
const reg = body(), post = body(full, "postseason");
const hashes = { "manifest.json": sha(reg), "postseason/manifest.json": sha(post) };
const requestFor = (regular = reg, postseason = post) => vi.fn<typeof fetch>(async url => new Response(String(url).includes("postseason/") ? postseason : regular));
it.each([
  { mode: "app-only", years: full, valid: true },
  { mode: "expansion", years: full, valid: true },
  { mode: "app-only", years: full.slice(2), valid: true },
  { mode: "app-only", years: full.slice(6), valid: true },
  { mode: "expansion", years: full.slice(6), valid: false },
  { mode: "app-only", years: [2020, 2020, 2020, 2020, 2020, 2020], valid: false },
])("validates exact staged years: $mode $years", async ({ mode, years, valid }) => {
  const raw = body(years), expected = { "manifest.json": sha(raw) };
  const promise = verifyHistoricalManifestReadback(mode === "expansion" ? { ...expected, "postseason/manifest.json": sha(body(years, "postseason")) } : expected, mode, { request: requestFor(raw, body(years, "postseason")), attempts: 1 });
  if (valid) expect((await promise).result).toBe("PASS"); else await expect(promise).rejects.toThrow();
});
it("retries a stale generation and consumes the entire oversized response", async () => {
  let requests = 0;
  const stale = Buffer.alloc(3_000_000, "x");
  const server = createServer((req, res) => { const bytes = requests++ === 0 ? stale : req.url?.includes("postseason/") ? post : reg; res.writeHead(200, { "Content-Length": bytes.length }); res.end(bytes); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); if (!address || typeof address === "string") throw Error("Missing server");
    const request: typeof fetch = (url, init) => fetch(`http://127.0.0.1:${address.port}${new URL(String(url)).pathname}`, init);
    const wait = vi.fn(async () => {});
    expect(await verifyHistoricalManifestReadback(hashes, "expansion", { request, wait, attempts: 2 })).toMatchObject({ result: "PASS", requests: 3, attempts: 2, canonicalWrites: 0 });
    expect(wait).toHaveBeenCalledTimes(1);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
});
it("does not accept mixed scope generations, partial coverage, or a changed hash", async () => {
  for (const [expected, request] of [
    [hashes, requestFor(reg, body(full.slice(2), "postseason"))],
    [{ ...hashes, "manifest.json": sha(body(full, undefined, "partial")) }, requestFor(body(full, undefined, "partial"))],
    [hashes, requestFor(body(full.slice(2)))],
  ] as const) await expect(verifyHistoricalManifestReadback(expected, "app-only", { request, attempts: 1 })).rejects.toThrow();
});
it("preserves admitted asymmetric legacy scope ranges in app-only mode", async () => {
  const oldPost = body(full.slice(6), "postseason");
  const expected = { "manifest.json": sha(reg), "postseason/manifest.json": sha(oldPost) };
  expect((await verifyHistoricalManifestReadback(expected, "app-only", { request: requestFor(reg, oldPost), attempts: 1 })).result).toBe("PASS");
});
it("requires staged hashes, both expansion competitions and a bounded retry budget", async () => {
  for (const expected of [{}, { "other.json": sha(reg) }, { "manifest.json": "bad" }, { "manifest.json": sha(reg) }]) await expect(verifyHistoricalManifestReadback(expected, "expansion", { request: requestFor(), attempts: 1 })).rejects.toThrow("Invalid staged");
  const request = requestFor(body(full.slice(2))), wait = vi.fn(async () => {});
  await expect(verifyHistoricalManifestReadback(hashes, "expansion", { request, wait, attempts: 2 })).rejects.toThrow("retry budget");
  expect(request).toHaveBeenCalledTimes(2); expect(wait).toHaveBeenCalledTimes(1);
  await expect(verifyHistoricalManifestReadback(hashes, "expansion", { request, attempts: 13 })).rejects.toThrow("retry budget");
});
it("records exact staged gzip hashes and rejects incomplete expansion", async () => {
  const root = await mkdtemp(join(tmpdir(), "mlb-readback-"));
  try {
    await writeFile(join(root, "manifest.json.gz"), reg);
    await expect(stagedHistoricalManifestHashes(root, "expansion")).rejects.toThrow();
    expect(await stagedHistoricalManifestHashes(root, "app-only")).toEqual({ "manifest.json": sha(reg) });
    await mkdir(join(root, "postseason")); await writeFile(join(root, "postseason/manifest.json.gz"), post);
    expect(await stagedHistoricalManifestHashes(root, "expansion")).toEqual(hashes);
  } finally { await rm(root, { recursive: true, force: true }); }
});
it("wires staged manifest hashes into deployment readback after NPB validation", async () => {
  const w = parse(await readFile(".github/workflows/mlb-historical-publish.yml", "utf8"));
  const record = w.jobs.stage.steps.find((s: { id?: string }) => s.id === "historical_publication");
  expect(record.run).toContain("record-mlb-publication.ts");
  expect(w.jobs.stage.outputs.mlb_manifest_hashes).toContain("historical_publication.outputs.manifest_hashes");
  const steps = w.jobs.deploy.steps, verify = steps.find((s: { name?: string }) => s.name === "Verify public Historical and NPB payloads");
  expect(verify.env.MLB_MANIFEST_HASHES).toContain("needs.stage.outputs.mlb_manifest_hashes");
  expect(verify.run).toContain("verify-published-historical-manifests.ts");
  expect(steps.indexOf(verify)).toBeGreaterThan(steps.findIndex((s: { name?: string }) => s.name === "Verify preserved NPB public projection family"));
});
