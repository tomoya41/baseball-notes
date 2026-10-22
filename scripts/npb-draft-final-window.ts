import { createHash } from "node:crypto";
import pin from "../src/data/npb-draft-final-release.json";
import publication from "../src/data/npb-draft-final-publication.json";
import display from "../src/data/npb-draft-final-display.json";
import { assertFinalAppPublicationWindow, finalDraftForecastSchema, draft2026Start } from "../src/domain/npb-draft-final";

/** Explicit postmeeting archive admission is separate from first premeeting Pages publication. */
async function verifyPremeetingRelease(request: typeof fetch, now: number) {
  if (now < Date.parse(draft2026Start)) throw Error("Postmeeting archive cannot be presented before the meeting");
  const response = await request(`https://api.github.com/repos/tomoya41/baseball-notes/releases/${display.releaseId}`, {
    headers: { "User-Agent": "BaseballNotes/1.0 (https://github.com/tomoya41/baseball-notes; immutable archive verification)" },
    signal: AbortSignal.timeout(15000), cache: "no-store",
  });
  if (!response.ok || !response.body) throw Error(`Archive release proof unavailable (HTTP ${response.status})`);
  const reader = response.body.getReader(), parts: Uint8Array[] = []; let length = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break; length += part.value.length; if (length > 64000) throw Error("Archive release proof byte budget exceeded"); parts.push(part.value); } }
  catch (error) { await reader.cancel().catch(() => undefined); throw error; } finally { reader.releaseLock(); }
  const release = JSON.parse(Buffer.concat(parts).toString()) as Record<string, unknown>;
  if (!Array.isArray(release.assets) || release.id !== display.releaseId || release.tag_name !== pin.tag || release.draft !== false || release.prerelease !== false || release.html_url !== publication.releaseUrl || release.published_at !== publication.firstPublishedAt) throw Error("Wrong immutable archive release");
  const beforeMeeting = (s: unknown) => typeof s === "string" && Number.isFinite(Date.parse(s)) && Date.parse(s) < Date.parse(draft2026Start);
  if (!beforeMeeting(release.published_at) || Date.parse(String(release.published_at)) < Date.parse(pin.frozenAt)) throw Error("Release was not published before the meeting");
  const assets = release.assets.filter((a: Record<string, unknown>) => a.id === display.assetId);
  const asset = assets[0] as Record<string, unknown> | undefined;
  if (assets.length !== 1 || !asset || asset.name !== "final-2026.json.gz" || asset.size !== display.compressedBytes || asset.state !== "uploaded" || asset.digest !== `sha256:${pin.sha256}` || asset.browser_download_url !== pin.assetUrl || !beforeMeeting(asset.created_at) || !beforeMeeting(asset.updated_at)) throw Error("Archive asset is missing, replaced or not premeeting");
  // This is proof of a public Release only. Never call it premeeting app/Pages publication.
  return { alreadyPublished: false, releasePublishedBeforeMeeting: true, mode: "postmeeting_archive", httpReads: 1 };
}

/** Shared normal-build/deploy gate. Timestamps alone never authorize late premeeting publication. */
export async function verifyFinalDraftWindow(request: typeof fetch = fetch, now = Date.now(), mode: "premeeting" | "postmeeting_archive" = display.mode as "postmeeting_archive") {
  if (mode === "postmeeting_archive") return verifyPremeetingRelease(request, now);
  if (mode !== "premeeting") throw Error("Unknown final forecast publication purpose");
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
