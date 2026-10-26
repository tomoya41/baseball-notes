/** UI readiness is not official calendar metadata or production evidence. */
export const npbSeasonChoices=[2026,2027] as const;
export function npbSeasonEntry(season:number) {
  if(season===2026)return {season,status:"saved_snapshot" as const,schedule:"saved" as const,results:"saved" as const};
  if(season===2027)return {season,status:"awaiting_verified_dataset" as const,schedule:"unregistered" as const,results:"uncollected" as const};
  return {season,status:"unsupported" as const,schedule:"unknown" as const,results:"unknown" as const};
}
const annual=new Set(["home","schedule","weekly","monthly","records","ranking","data","search","players","teams","compare","team-compare","cs","postseason","preseason","moves","talent"]);
export function needsNpbSeasonEntry(pathname:string,search:URLSearchParams) {
  const raw=search.get("season");
  return pathname.startsWith("/NPB/")&&raw!==null&&/^\d{4}$/.test(raw)&&Number(raw)>2026&&annual.has(pathname.split("/")[2]??"");
}
export function savedNpbSnapshotRoute(pathname:string,search:URLSearchParams) {
  const params=new URLSearchParams(search);params.set("season","2026");
  for(const key of ["date","week","month","asOfDate"])params.delete(key);
  return `${pathname}?${params}`;
}
