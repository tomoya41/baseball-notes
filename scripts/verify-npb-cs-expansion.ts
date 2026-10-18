import {readFile,writeFile} from "node:fs/promises";
import {gunzipSync} from "node:zlib";
import {pathToFileURL} from "node:url";
import {createHash} from "node:crypto";
import {isDeepStrictEqual} from "node:util";
import {z} from "zod";
import {npbCsDatasetSchema,type NpbCsDataset} from "../src/domain/npb-cs-observations";
import {sumHistoricalRows} from "../src/domain/npb-historical";
import {npbCompetitionAggregateSchema,type NpbCompetitionAggregate} from "../src/domain/npb-competition";
import {npbPlayerDirectorySchema} from "../src/domain/npb-player-directory";
import {parseWikipediaCs} from "../src/infrastructure/providers/wikipedia-npb-cs";
import {parseWikipediaHistorical} from "../src/infrastructure/providers/wikipedia-npb-historical";
import {assertHistoricalBridge} from "../src/infrastructure/providers/npb-historical-admission";

type Observation={aggregate:NpbCompetitionAggregate;gameId:string};
const aggregateKey=(a:NpbCompetitionAggregate)=>[a.playerId,a.teamId,a.scope.stage,a.role].join(":");
const observationKey=(r:Observation)=>`${aggregateKey(r.aggregate)}:${r.gameId}`;
function verifyObservationProjection(data:NpbCsDataset,observations:readonly Observation[]){
 const seen=new Set<string>(),groups=new Map<string,Observation[]>();
 for(const r of observations){
  const a=npbCompetitionAggregateSchema.parse(r.aggregate),game=data.games.find(g=>g.id===r.gameId);
  if(seen.has(observationKey(r))||!game||a.metrics.G!==1||a.season!==2026||a.scope.temporalScope!=="saved_current"||a.scope.competition!=="postseason"||a.scope.stage!==game.stage||![game.homeTeamId,game.awayTeamId].includes(a.teamId))throw Error("Invalid per-game observation evidence");
  seen.add(observationKey(r));const key=aggregateKey(a);groups.set(key,[...groups.get(key)??[],r]);
 }
 if(groups.size!==data.rows.length)throw Error("Observation evidence does not cover snapshot rows");
 if(data.observations){
  const evidence=new Map(observations.map(r=>[observationKey(r),r.aggregate]));
  if(data.observations.length!==observations.length||data.observations.some(r=>!isDeepStrictEqual(r.aggregate,evidence.get(observationKey(r)))))throw Error("Published per-game observations do not match replayed source evidence");
 }
 for(const row of data.rows){
  const group=groups.get(aggregateKey(row.aggregate));
  if(!group||!isDeepStrictEqual(group.map(r=>r.gameId).sort(),row.gameIds.slice().sort())||!isDeepStrictEqual(sumHistoricalRows(group.map(r=>r.aggregate)).metrics,row.aggregate.metrics))throw Error("Observation totals do not match snapshot");
 }
}

/** Add-only snapshot admission. Corrections require a separately reviewed migration. */
export function verifyCsExpansion(before:NpbCsDataset,after:NpbCsDataset,proof?:{before:readonly Observation[];after:readonly Observation[]}){
 const key=(r:NpbCsDataset["rows"][number])=>[r.aggregate.playerId,r.aggregate.teamId,r.aggregate.scope.stage,r.aggregate.role].join(":");
 const games=new Map(after.games.map(g=>[g.id,g])),rows=new Map(after.rows.map(r=>[key(r),r]));
 if(before.games.some(g=>JSON.stringify(games.get(g.id))!==JSON.stringify(g)))throw Error("Existing CS Game changed or removed");
 const changed=before.rows.filter(r=>JSON.stringify(rows.get(key(r)))!==JSON.stringify(r));
 if(changed.length&&!proof)throw Error("Existing CS aggregate changed or removed");
 if(proof){
  verifyObservationProjection(before,proof.before);verifyObservationProjection(after,proof.after);
  const current=new Map(proof.after.map(r=>[observationKey(r),r]));
  if(proof.before.some(r=>!isDeepStrictEqual(current.get(observationKey(r))?.aggregate,r.aggregate)))throw Error("Existing per-game CS observation changed or removed");
 }
 if(before.players.some(p=>!after.players.some(q=>q.playerId===p.playerId&&q.npbId===p.npbId&&q.wikidataId===p.wikidataId)))throw Error("Existing CS identity changed or removed");
 return {gamesBefore:before.games.length,gamesAfter:after.games.length,rowsBefore:before.rows.length,rowsAfter:after.rows.length,addedGames:after.games.filter(g=>!before.games.some(p=>p.id===g.id)).map(g=>({id:g.id,date:g.date,stage:g.stage,homeTeamId:g.homeTeamId,awayTeamId:g.awayTeamId,homeScore:g.homeScore,awayScore:g.awayScore})),addedRows:after.rows.filter(r=>!before.rows.some(p=>key(p)===key(r))).map(r=>({playerId:r.aggregate.playerId,role:r.aggregate.role,stage:r.aggregate.scope.stage,gameIds:r.gameIds})),unchangedGames:before.games.length,unchangedRows:before.rows.length-changed.length,extendedRows:changed.length,verifiedPriorObservations:proof?.before.length??null,addedObservations:proof?proof.after.length-proof.before.length:null,coverage:after.coverage,canonicalWrites:0};
}
async function main(){
 const [before,after,output]=process.argv.slice(2);if(!before||!after)throw Error("Usage: verify-npb-cs-expansion before.json.gz after.json.gz [report.json]");
 const load=async(file:string)=>npbCsDatasetSchema.parse(JSON.parse(gunzipSync(await readFile(file),{maxOutputLength:500000}).toString()));
 const previous=await load(before),next=await load(after);
 const option=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
 const beforeSource=option("before-source"),afterSource=option("after-source"),identityFile=option("identity-archive"),beforeIdentityFile=option("before-identity-archive"),directoryFile=option("directory");
 let proof:{before:Observation[];after:Observation[]}|undefined;
 if(beforeSource||afterSource||identityFile||beforeIdentityFile||directoryFile){
  if(!beforeSource||!afterSource||!identityFile||!directoryFile)throw Error("Both source archives, identity archive and directory required for observation extension");
  const directory=npbPlayerDirectorySchema.parse(JSON.parse(await readFile(directoryFile,"utf8"))),ids=new Set(directory.players.map(p=>p.playerId));
  const replay=async(file:string,identityPath:string,data:NpbCsDataset,summaryReferences:boolean)=>{
   const identityBytes=await readFile(identityPath),archive=z.object({pages:z.record(z.string(),z.unknown()),titles:z.array(z.object({playerId:z.uuid(),npbId:z.string(),wikidataId:z.string(),title:z.string(),identityScope:z.literal("historical_only").optional(),sourceObservedAt:z.iso.datetime().optional()}))}).parse(JSON.parse(identityBytes.toString()));
   const identities=archive.titles.filter(p=>ids.has(p.playerId)&&!p.identityScope).map(link=>{assertHistoricalBridge(link);const {player}=parseWikipediaHistorical(archive.pages[link.title],link,[]);assertHistoricalBridge(link,player);return player;});
   const bytes=await readFile(file),source=z.object({observedAt:z.iso.datetime(),response:z.object({query:z.object({pages:z.array(z.unknown())})})}).parse(JSON.parse(bytes.toString()));
   if(createHash("sha256").update(bytes).update(identityBytes).digest("hex")!==data.inputSha256||source.observedAt!==data.observedAt)throw Error("Source/identity archive fingerprint mismatch");
   const parsed=source.response.query.pages.map(p=>parseWikipediaCs(p,source.observedAt,identities,{summaryReferences}));
   if(!isDeepStrictEqual(parsed.map(p=>p.source),data.sources)||!isDeepStrictEqual(parsed.flatMap(p=>p.games),data.games))throw Error("Replayed source/game evidence mismatch");
   return parsed.flatMap(p=>p.observations);
  };
  proof={before:await replay(beforeSource,beforeIdentityFile??identityFile,previous,process.argv.includes("--before-summary-references")),after:await replay(afterSource,identityFile,next,true)};
 }
 const report=verifyCsExpansion(previous,next,proof);if(output)await writeFile(output,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
