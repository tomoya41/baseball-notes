import { publicDataFetch, rememberPublicResponse } from "../public-response-cache";
import { validStaticPayload } from "../../domain/mlb-historical-public";
import { japaneseHistoricalPayload } from "../../domain/mlb-japanese-display";
import { publicAssetBase } from "../../app/platform";
export class HistoricalProductHttpError extends Error {
  constructor(readonly status: number) { super(`Historical product HTTP ${status}`); }
}
// Share acquisition, decompression and validation only while a read is in flight.
// Settled data is never memoized here: later checks must see corrected generations.
const readers = new WeakMap<typeof fetch, Map<string, Promise<unknown>>>();
export function readHistoricalProduct<T>(path: string, request: typeof fetch = publicDataFetch): Promise<T> {
  let pending = readers.get(request);
  if (!pending) { pending = new Map(); readers.set(request, pending); }
  let task = pending.get(path);
  if (!task) {
    task = decodeHistoricalProduct(path, request).finally(() => pending.delete(path));
    pending.set(path, task);
  }
  return task as Promise<T>;
}
async function decodeHistoricalProduct(path: string, request: typeof fetch): Promise<unknown> {
  const response = await request(`${publicAssetBase()}data/mlb/historical/${path}.gz`);
  if (!response.ok) throw new HistoricalProductHttpError(response.status);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text() : new TextDecoder().decode(bytes);
  const value: unknown = JSON.parse(text);
  if (!validStaticPayload(path, value)) throw new Error("Invalid historical product payload");
  await rememberPublicResponse(response);
  return japaneseHistoricalPayload(path.replace(/^postseason\//, ""), value);
}
