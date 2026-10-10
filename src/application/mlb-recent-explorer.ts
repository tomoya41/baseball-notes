import { readHistoricalProduct } from "../infrastructure/providers/historical-product-reader";
import { foldRecent, recentMonths, type RecentIndex, type RecentMonth } from "../domain/mlb-recent-explorer";
import type { HistoricalDirectoryPlayer } from "../domain/historical-directory";

export async function readMlbAllRecent(season:number, competition:"regular"|"postseason", asOf:string, days:7|14|30, directory:readonly HistoricalDirectoryPlayer[], descriptor:{firstDate:string;lastDate:string;coverage:string}, teamId="", read=readHistoricalProduct) {
  const base=`${competition==="postseason"?"postseason/":""}exploration/recent/${season}/`;
  const index=await read<RecentIndex>(`${base}index.json`);
  if(index.season!==season || index.competitionType!==competition || index.firstDate!==descriptor.firstDate || index.lastDate!==descriptor.lastDate || index.coverage!==descriptor.coverage)throw Error("Historical Recent publication mismatch");
  const needed=recentMonths(index,asOf,days);
  if(needed.length>3)throw Error("Historical Recent read budget exceeded");
  const months=await Promise.all(needed.map(m=>read<RecentMonth>(`${base}${m}.json`)));
  const names=new Map(directory.filter(p=>p.seasons.includes(season)).map(p=>[p.id,p.name]));
  return {values:foldRecent(index,months,names,asOf,days,teamId).map(row=>({...row,coverage:index.coverage})),failed:[],coverage:index.coverage};
}
