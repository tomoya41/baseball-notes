import { npbSeasonPayloadSchema } from "./npb-season-payload";
import { publicAssetBase } from "../app/platform";
import { publicDataFetch, rememberPublicResponse } from "../infrastructure/public-response-cache";
import { npbRecentExplorerSchema } from "./npb-recent-explorer";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";

export async function readNpbExplorerSeason(year: number, request: typeof fetch = publicDataFetch) {
  if (year !== 2026) throw Error("NPB season unavailable");
  const base = import.meta.env.VITE_NPB_DATA_BASE_URL?.trim() || publicAssetBase();
  const response = await request(`${base.replace(/\/$/, "")}/data/npb/season/${year}/latest.json`, { cache: "no-cache" });
  if (!response.ok) throw Error(`Saved season HTTP ${response.status}`);
  const payload = npbSeasonPayloadSchema.parse(await response.json());
  await rememberPublicResponse(response);
  return payload;
}
export async function readNpbRecentExplorer(days: 7 | 14 | 30, directory: NpbPlayerDirectory, request: typeof fetch = publicDataFetch) {
  const base = import.meta.env.VITE_NPB_DATA_BASE_URL?.trim() || publicAssetBase();
  const response = await request(`${base.replace(/\/$/, "")}/data/npb/explorer/recent/${days}.json`, { cache: "no-cache" });
  if (!response.ok) throw Error(`Recent projection HTTP ${response.status}`);
  const p = npbRecentExplorerSchema.parse(await response.json());
  if (p.days !== days || p.effectiveDate !== directory.effectiveDate) throw Error("Recent projection generation differs");
  const players = new Map(directory.players.map(player => [player.playerId, player]));
  if (p.players.some(row => {
    const player = players.get(row.playerId);
    return !player || row.displayName !== player.displayName || row.teamId !== player.teamId;
  })) throw Error("Recent projection identity differs");
  await rememberPublicResponse(response); return p;
}
