import { publicDataFetch, rememberPublicResponse } from "../public-response-cache";
import { validStaticPayload } from "../../domain/mlb-historical-public";
import { japaneseHistoricalPayload } from "../../domain/mlb-japanese-display";
import { publicAssetBase } from "../../app/platform";
export async function readHistoricalProduct<T>(path: string, request: typeof fetch = publicDataFetch): Promise<T> {
  const response = await request(`${publicAssetBase()}data/mlb/historical/${path}.gz`);
  if (!response.ok) throw new Error(`Historical product HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text() : new TextDecoder().decode(bytes);
  const value: unknown = JSON.parse(text);
  if (!validStaticPayload(path, value)) throw new Error("Invalid historical product payload");
  await rememberPublicResponse(response);
  return japaneseHistoricalPayload(path.replace(/^postseason\//, ""), value) as T;
}
