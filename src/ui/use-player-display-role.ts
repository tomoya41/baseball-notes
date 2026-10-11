import { useMemo } from "react";
import { battingDisplayRole, type BattingDisplayRole } from "../domain/player-display-role";
import type { FormIndex } from "../domain/historical-form";
import { useHistoricalStatic } from "./use-mlb-historical";
export function useSeasonDisplayRoles(season:number|null,asOf?:string) {
  const result=useHistoricalStatic<FormIndex>(season===null?null:`exploration/form/${season}/index.json`);
  const roles=useMemo(()=>new Map<string,BattingDisplayRole>(result.value?.roles?.map(p=>[p.playerId,battingDisplayRole(p.positionDates.filter(d=>d.date<=(asOf??result.value!.lastDate)).map(d=>d.position))])??[]),[result.value,asOf]);
  const pitchers=useMemo(()=>new Set(result.value?.roles?.filter(p=>p.positionDates.some(d=>d.position==="P"&&d.date<=(asOf??result.value!.lastDate))).map(p=>p.playerId)??[]),[result.value,asOf]);
  return {...result,roles,pitchers};
}
