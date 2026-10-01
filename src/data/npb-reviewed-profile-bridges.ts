import { verifiedNf3Identities } from "./npb-verified-nf3-identities";
// Manually reviewed P4260 links, not name matching. Source identity provenance:
// docs/npb-safe-data-completion.md. nf3/NPB IDs remain internal.
const reviewedEntities: Record<string, string> = {
  "81285138": "Q58420279", "81085150": "Q130726841", "73975136": "Q52083715",
  "23125136": "Q43426179", "53555153": "Q105259074", "61365136": "Q57314556",
  "31835153": "Q102246615", "13415155": "Q19793652",
};
export const reviewedProfileBridges = [...new Map(verifiedNf3Identities.map(p => {
  const npbId = /\/players\/(\d+)\.html$/.exec(p.officialProfileUrl)?.[1];
  const wikidataId = npbId ? reviewedEntities[npbId] : undefined;
  if (!npbId || !wikidataId) throw Error("Unreviewed external-ID bridge");
  return [p.playerId, { playerId: p.playerId, npbId, wikidataId }];
})).values()];
