import { createHash } from "node:crypto";
import pin from "../src/data/npb-draft-final-release.json";
import { assertFinalAppPublicationWindow, finalDraftForecastSchema, draft2026Start } from "../src/domain/npb-draft-final";

/** Shared normal-build/deploy gate. A metadata timestamp alone is not proof of prior app publication. */
export async function verifyFinalDraftWindow(request: typeof fetch = fetch, now = Date.now()) {
  if (now < Date.parse(draft2026Start) - 15 * 60000) {
    assertFinalAppPublicationWindow(false, now);
    return { alreadyPublished: false, httpReads: 0 };
  }
  const response = await request(`https://tomoya41.github.io/baseball-notes/data/npb/draft/${pin.sha256}/final-2026.json`, { signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!response.ok) throw Error(`First premeeting publication window closed; prior publication not verified (HTTP ${response.status})`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length !== pin.bytes || createHash("sha256").update(body).digest("hex") !== pin.bodySha256) throw Error("Public final forecast does not match immutable pin");
  finalDraftForecastSchema.parse(JSON.parse(body.toString()));
  assertFinalAppPublicationWindow(true, now);
  return { alreadyPublished: true, httpReads: 1 };
}
