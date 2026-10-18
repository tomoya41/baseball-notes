import {expect,it} from "vitest";
import {collectedRecordCheckpoints} from "../src/domain/npb-collected-records";
import {cohortFixture} from "./fixtures/npb-cohort";

it("uses only selected recorded rows, exact outs and a strictly next checkpoint",()=>{
 const {data}=cohortFixture(),row=data.rows[0]!;
 const rows=[{...row,season:2024,metrics:{...row.metrics,H:1990,HR:99,SB:0}},{...row,metrics:{...row.metrics,H:10,HR:1,SB:1}}];
 expect(collectedRecordCheckpoints(rows).find(c=>c.metric==="H")).toMatchObject({value:2000,next:2500,remaining:500,lastRecorded:2000,seasons:[2024,2025]});
 expect(collectedRecordCheckpoints(rows).find(c=>c.metric==="HR")).toMatchObject({value:100,next:200,remaining:100});
 const p={...data.rows.at(-1)!,metrics:{...data.rows.at(-1)!.metrics,outsRecorded:2999,SO:0,W:0}};
 expect(collectedRecordCheckpoints([p]).find(c=>c.metric==="outsRecorded")).toMatchObject({value:2999,next:3000,remaining:1});
});
it("never converts a missing component or empty rowset to zero, and rejects duplicate/mixed observations",()=>{
 const row=cohortFixture().data.rows[0]!;
 expect(collectedRecordCheckpoints([{...row,metrics:{...row.metrics,HR:null}}]).find(c=>c.metric==="HR")).toMatchObject({value:null,next:null,remaining:null,lastRecorded:null});
 expect(collectedRecordCheckpoints([])).toEqual([]);
 expect(()=>collectedRecordCheckpoints([row,row])).toThrow(/Duplicate/);
 expect(()=>collectedRecordCheckpoints([row,{...row,playerId:"different"}])).toThrow(/One player/);
 expect(()=>collectedRecordCheckpoints([{...row,season:2026}])).toThrow(/Historical Regular/);
 expect(()=>collectedRecordCheckpoints([Object.assign({},row,{scope:{competition:"postseason"}})])).toThrow(/Historical Regular/);
});
