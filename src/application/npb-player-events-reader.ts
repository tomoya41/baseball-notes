import { publicAssetBase } from "../app/platform";
import { publicDataFetch, rememberPublicResponse } from "../infrastructure/public-response-cache";
import { npbPlayerEventsSchema, type NpbPlayerEvents } from "../domain/npb-player-events";
import pin from "../data/npb-player-events-release.json";

const pending = new WeakMap<typeof fetch, Promise<NpbPlayerEvents>>();
export function readNpbPlayerEvents(request: typeof fetch = publicDataFetch): Promise<NpbPlayerEvents> {
  const existing = pending.get(request); if (existing) return existing;
  const task = acquire(request).finally(() => pending.delete(request)); pending.set(request, task); return task;
}
async function acquire(request: typeof fetch) {
  const response = await request(`${publicAssetBase()}data/npb/events/${pin.sha256}/2026.json`);
  if (!response.ok) throw Error(`Player events HTTP ${response.status}`);
  const text = await response.text(), bytes = new TextEncoder().encode(text);
  if (bytes.length !== pin.bytes || bytes.length > 250000) throw Error("Player-event payload size mismatch");
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  if ([...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, "0")).join("") !== pin.bodySha256) throw Error("Player-event payload hash mismatch");
  const dataset = npbPlayerEventsSchema.parse(JSON.parse(text));
  if (dataset.source.revision !== pin.sourceRevision || dataset.identityInputSha256 !== pin.identityInputSha256 || dataset.events.length !== pin.events || dataset.players.length !== pin.players) throw Error("Unadmitted player-event generation");
  await rememberPublicResponse(response); return dataset;
}
