import { it, expect, vi, afterEach } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { readNpbFinalDraft } from "../src/application/npb-draft-final-reader";
import { rememberPublicResponse, publicDataFetch } from "../src/infrastructure/public-response-cache";
import data from "../src/data/npb-draft-2026-final-forecast.json";
const state = vi.hoisted(() => ({ pin: { sha256: "f".repeat(64), bodySha256: "", bytes: 0, frozenAt: "" } }));
vi.mock("../src/data/npb-draft-final-release.json", () => ({ default: state.pin }));
vi.mock("../src/infrastructure/public-response-cache", () => ({ publicDataFetch: vi.fn(), rememberPublicResponse: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
const payload = () => { const body = JSON.stringify(data) + "\n"; Object.assign(state.pin, { bodySha256: createHash("sha256").update(body).digest("hex"), bytes: Buffer.byteLength(body), frozenAt: data.frozenAt }); vi.stubGlobal("crypto", webcrypto); return body; };
it("reads one bounded pinned final projection and caches only validated content", async () => { const body = payload(), request = vi.fn(async () => new Response(body)); expect(await readNpbFinalDraft(request)).toEqual(data); expect(request).toHaveBeenCalledTimes(1); expect(rememberPublicResponse).toHaveBeenCalledTimes(1); });
it.each(["size", "hash", "edition", "schema"])("rejects %s mismatch before cache admission", async kind => {
  let body = payload();
  if (kind === "size") state.pin.bytes++;
  if (kind === "hash") state.pin.bodySha256 = "0".repeat(64);
  if (kind === "edition") state.pin.frozenAt = "2026-10-22T07:50:00Z";
  if (kind === "schema") { body = body.replace('"reviewed_eligible"', '"unverified"'); Object.assign(state.pin, { bodySha256: createHash("sha256").update(body).digest("hex"), bytes: Buffer.byteLength(body) }); }
  await expect(readNpbFinalDraft(async () => new Response(body))).rejects.toThrow(); expect(rememberPublicResponse).not.toHaveBeenCalled();
});
it("deduplicates default requests across views and permits retry after a failed request", async () => {
  const body = payload(); vi.mocked(publicDataFetch).mockRejectedValueOnce(Error("offline"));
  const failed = await Promise.allSettled([readNpbFinalDraft(), readNpbFinalDraft()]);
  expect(failed.every(r => r.status === "rejected")).toBe(true); expect(publicDataFetch).toHaveBeenCalledTimes(1);
  vi.mocked(publicDataFetch).mockResolvedValue(new Response(body));
  const success = await Promise.all([readNpbFinalDraft(), readNpbFinalDraft()]);
  expect(success[0]).toEqual(data); expect(success[1]).toEqual(data); expect(publicDataFetch).toHaveBeenCalledTimes(2);
  await readNpbFinalDraft(); expect(publicDataFetch).toHaveBeenCalledTimes(2);
});
