import bridges from "../../data/npb-free-profile-identities.json";
import { reviewedProfileBridges } from "../../data/npb-reviewed-profile-bridges";
import registry from "../../data/npb-historical-only-identities.json";
import { historicalIdentityId, historicalIdentitySchema } from "./wikipedia-npb-historical-identity";
import type { HistoricalBridge } from "./wikipedia-npb-historical";

// Build/import only: never bundle the full identity bridge into the browser.
// Reuse independently reviewed nf3 -> NPB-ID -> QID links as well as the
// profile archive. Registered abbreviations are never matched by name here.
export const historicalCurrentBridges = [...bridges.map(({playerId,npbId,wikidataId})=>({playerId,npbId,wikidataId}))];
for (const b of reviewedProfileBridges) {
  const matches=historicalCurrentBridges.filter(p=>p.playerId===b.playerId||p.npbId===b.npbId||p.wikidataId===b.wikidataId);
  if(matches.length && (matches.length!==1||matches[0]!.playerId!==b.playerId||matches[0]!.npbId!==b.npbId||matches[0]!.wikidataId!==b.wikidataId)) throw Error("Conflicting reviewed current bridge");
  if(!matches.length) historicalCurrentBridges.push(b);
}
const historical = registry.players.map(p=>historicalIdentitySchema.parse(p));
for (const key of ["playerId","npbId","wikidataId"] as const) {
  const ids=[...historicalCurrentBridges,...historical].map(p=>p[key]);
  if(new Set(ids).size!==ids.length)throw Error(`Conflicting historical registry ${key}`);
}
if(historical.some(p=>p.playerId!==historicalIdentityId(p.npbId)))throw Error("Historical namespace mismatch");
export function assertHistoricalBridge(link:HistoricalBridge, source?:{article:string;revision:number}) {
  const existing=historicalCurrentBridges.find(b=>b.playerId===link.playerId&&b.npbId===link.npbId&&b.wikidataId===link.wikidataId);
  const added=historical.find(b=>b.playerId===link.playerId&&b.npbId===link.npbId&&b.wikidataId===link.wikidataId);
  if(existing&&!link.identityScope)return;
  if(added&&link.identityScope==="historical_only"&&(!source||(added.article===source.article&&added.revision===source.revision)))return;
  throw Error("Unverified cross-season canonical bridge");
}
