import { mkdir } from "node:fs/promises";
import { stageNpbCs } from "./stage-npb-cs";
import { stageNpbSeries } from "./stage-npb-series";
import { stageNpbJapanSeries } from "./stage-npb-japan-series";

/** A fresh runner needs the reviewed CS base before either dependent snapshot. */
export async function stageNpbAiInputs(destination="dist/data/npb/competitions",cache=".data/npb-history-release",
  stages:{cs:(root:string)=>Promise<unknown>;series:(root:string)=>Promise<unknown>;japan:(root:string)=>Promise<unknown>}=
    {cs:stageNpbCs,series:stageNpbSeries,japan:stageNpbJapanSeries}){
  await mkdir(cache,{recursive:true});
  await stages.cs(destination);
  await stages.series(destination);
  await stages.japan(destination);
}
