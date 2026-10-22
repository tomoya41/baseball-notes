import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { assertFinalDraftArchive } from "../scripts/stage-npb-draft-final";
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
it("verifies published compressed bytes and exact local body without depending on recompression", () => {
  const body = Buffer.from("fictional frozen archive\n"), published = gzipSync(body);
  // The gzip OS header can differ even though the uncompressed forecast is identical.
  published[9] = published[9] === 3 ? 0 : 3;
  const pin = { sha256: hash(published), bodySha256: hash(body), bytes: body.length };
  expect(() => assertFinalDraftArchive(published, body, pin)).not.toThrow();
  expect(() => assertFinalDraftArchive(gzipSync(body), body, pin)).toThrow(/digest/);
  expect(() => assertFinalDraftArchive(published, Buffer.from("edited after meeting"), pin)).toThrow(/body/);
  expect(() => assertFinalDraftArchive(published, body, { ...pin, bytes: body.length + 1 })).toThrow(/body/);
});
it("rejects corrupt, oversized and expanding archives before public staging", () => {
  for (const published of [Buffer.from("invalid"), Buffer.alloc(50001), gzipSync(Buffer.alloc(150001))]) {
    const pin = { sha256: hash(published), bodySha256: hash(Buffer.from("small")), bytes: 5 };
    expect(() => assertFinalDraftArchive(published, Buffer.from("small"), pin)).toThrow();
  }
});
