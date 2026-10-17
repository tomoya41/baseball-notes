import {readFile,writeFile} from "node:fs/promises";
import {gunzipSync} from "node:zlib";
import {pathToFileURL} from "node:url";
import {npbCsDatasetSchema,type NpbCsDataset} from "../src/domain/npb-cs-observations";

/** Add-only snapshot admission. Corrections require a separately reviewed migration. */
export function verifyCsExpansion(before:NpbCsDataset,after:NpbCsDataset){
 const key=(r:NpbCsDataset["rows"][number])=>[r.aggregate.playerId,r.aggregate.teamId,r.aggregate.scope.stage,r.aggregate.role].join(":");
 const games=new Map(after.games.map(g=>[g.id,g])),rows=new Map(after.rows.map(r=>[key(r),r]));
 if(before.games.some(g=>JSON.stringify(games.get(g.id))!==JSON.stringify(g)))throw Error("Existing CS Game changed or removed");
 if(before.rows.some(r=>JSON.stringify(rows.get(key(r)))!==JSON.stringify(r)))throw Error("Existing CS aggregate changed or removed");
 if(before.players.some(p=>!after.players.some(q=>q.playerId===p.playerId&&q.npbId===p.npbId&&q.wikidataId===p.wikidataId)))throw Error("Existing CS identity changed or removed");
 return {gamesBefore:before.games.length,gamesAfter:after.games.length,rowsBefore:before.rows.length,rowsAfter:after.rows.length,addedGames:after.games.filter(g=>!before.games.some(p=>p.id===g.id)).map(g=>({id:g.id,date:g.date,stage:g.stage,homeTeamId:g.homeTeamId,awayTeamId:g.awayTeamId,homeScore:g.homeScore,awayScore:g.awayScore})),addedRows:after.rows.filter(r=>!before.rows.some(p=>key(p)===key(r))).map(r=>({playerId:r.aggregate.playerId,role:r.aggregate.role,stage:r.aggregate.scope.stage,gameIds:r.gameIds})),unchangedGames:before.games.length,unchangedRows:before.rows.length,coverage:after.coverage,canonicalWrites:0};
}
async function main(){
 const [before,after,output]=process.argv.slice(2);if(!before||!after)throw Error("Usage: verify-npb-cs-expansion before.json.gz after.json.gz [report.json]");
 const load=async(file:string)=>npbCsDatasetSchema.parse(JSON.parse(gunzipSync(await readFile(file),{maxOutputLength:500000}).toString()));
 const report=verifyCsExpansion(await load(before),await load(after));if(output)await writeFile(output,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
