import { npbSeasonPayloadSchema } from "./npb-season-payload";
import { publicAssetBase } from "../app/platform";
import { publicDataFetch, rememberPublicResponse } from "../infrastructure/public-response-cache";

export async function readNpbExplorerSeason(year: number, request: typeof fetch = publicDataFetch) {
  if (year !== 2026) throw Error("NPB season unavailable");
  const base = import.meta.env.VITE_NPB_DATA_BASE_URL?.trim() || publicAssetBase();
  const response = await request(`${base.replace(/\/$/, "")}/data/npb/season/${year}/latest.json`, { cache: "no-cache" });
  if (!response.ok) throw Error(`Saved season HTTP ${response.status}`);
  const payload = npbSeasonPayloadSchema.parse(await response.json());
  await rememberPublicResponse(response);
  return payload;
}
