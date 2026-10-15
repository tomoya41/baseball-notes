import bridges from "../../data/npb-free-profile-identities.json";
import registry from "../../data/npb-historical-only-identities.json";
import { historicalIdentityId, historicalIdentitySchema } from "./wikipedia-npb-historical-identity";
import type { HistoricalBridge } from "./wikipedia-npb-historical";

// Build/import only: never bundle the full identity bridge into the browser.
const historical = registry.players.map(p=>historicalIdentitySchema.parse(p));
for (const key of ["playerId","npbId","wikidataId"] as const) {
  const ids=[...bridges,...historical].map(p=>p[key]);
  if(new Set(ids).size!==ids.length)throw Error(`Conflicting historical registry ${key}`);
}
if(historical.some(p=>p.playerId!==historicalIdentityId(p.npbId)))throw Error("Historical namespace mismatch");
export function assertHistoricalBridge(link:HistoricalBridge, source?:{article:string;revision:number}) {
  const existing=bridges.find(b=>b.playerId===link.playerId&&b.npbId===link.npbId&&b.wikidataId===link.wikidataId);
  const added=historical.find(b=>b.playerId===link.playerId&&b.npbId===link.npbId&&b.wikidataId===link.wikidataId);
  if(existing&&!link.identityScope)return;
  if(added&&link.identityScope==="historical_only"&&(!source||(added.article===source.article&&added.revision===source.revision)))return;
  throw Error("Unverified cross-season canonical bridge");
}
