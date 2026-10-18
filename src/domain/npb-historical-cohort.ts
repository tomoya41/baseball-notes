import { sumHistoricalRows, type NpbHistoricalDataset } from "./npb-historical";
import type { NpbCatalog } from "./npb-product-contract";

export type HistoricalCohortKind = "birthYear" | "draftYear" | "schoolYear";
/** Japanese grade grouping: April 2 through April 1 of the next year. DOB is validated by Catalog. */
export function japaneseSchoolCohort(birthDate: string | null): number | null {
  return birthDate ? Number(birthDate.slice(0,4)) - Number(birthDate.slice(5) < "04-02") : null;
}
/** Same immutable birth year or explicit draft year; never rookie/current-roster evidence. */
export function historicalCohort(data: NpbHistoricalDataset, catalog: NpbCatalog, referenceId: string, kind: HistoricalCohortKind, role: "batting" | "pitching") {
  if(new Set(data.rows.map(r=>r.season)).size!==1)throw Error("Cohort requires one Historical season");
  const reference=catalog.players.find(p=>p.playerId===referenceId);
  const value=(p:NpbCatalog["players"][number])=>kind==="schoolYear"?japaneseSchoolCohort(p.profile.birthDate):kind==="birthYear"?(p.profile.birthDate?Number(p.profile.birthDate.slice(0,4)):null):p.profile.draftYear;
  const year=reference?value(reference):null;
  if(year===null)return {year:null,reference,members:[]};
  const rowsById=new Map<string,NpbHistoricalDataset["rows"]>();
  for(const row of data.rows)if(row.role===role){const rows=rowsById.get(row.playerId)??[];rows.push(row);rowsById.set(row.playerId,rows);}
  const members=catalog.players.filter(p=>value(p)===year&&rowsById.has(p.playerId)).map(player=>{
    const rows=rowsById.get(player.playerId)!;
    const source=data.players.find(p=>p.playerId===player.playerId);
    if(!source)throw Error("Cohort source identity missing");
    return {player,source,teams:[...new Set(rows.map(r=>r.teamId))],...sumHistoricalRows(rows)};
  }).sort((a,b)=>a.player.displayName.localeCompare(b.player.displayName,"ja")||a.player.playerId.localeCompare(b.player.playerId));
  return {year,reference,members};
}
