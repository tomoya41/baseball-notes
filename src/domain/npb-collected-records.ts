import { sumHistoricalRows, type NpbHistoricalRow } from "./npb-historical";
import { historicalProgression } from "./npb-player-progression";

const steps = { batting: { H:500, HR:100, SB:100 }, pitching: { W:50, SO:500, outsRecorded:3000 } } as const;
/** Checkpoints of the selected recorded rows, never certified career milestones or dates. */
export function collectedRecordCheckpoints(rows:readonly NpbHistoricalRow[]) {
  if(!rows.length)return [];
  if(rows.some(r=>"scope" in r||r.season>2025))throw Error("Historical Regular rows only; do not mix competitions or Current");
  historicalProgression(rows,[...new Set(rows.map(r=>r.season))]);
  const total=sumHistoricalRows(rows);
  return Object.entries(steps[rows[0]!.role]).map(([metric,step])=>{
    const value=total.metrics[metric]??null;
    const next=value===null?null:(Math.floor(value/step)+1)*step;
    return {metric,value,next,remaining:value===null?null:next!-value,lastRecorded:value!==null&&value>=step?Math.floor(value/step)*step:null,seasons:total.seasons};
  });
}
