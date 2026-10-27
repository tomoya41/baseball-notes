import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join,resolve,sep} from "node:path";
import {gunzipSync,gzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import {unzipSync} from "fflate";
import {parse} from "csv-parse/sync";
import {honorsPageSchema,contextManifestSchema,playerHonorBucket,type Honor,type HonorRecipient,type HonorsPage} from "../src/domain/player-honors";
import {inningScorePageSchema,type InningScore} from "../src/domain/inning-score";
import {parseNpbHonors} from "../src/infrastructure/providers/wikipedia-npb-honors";
import {annualMlbHonors,parseLahmanHonors,matchLahmanIdentity,type CsvRecord} from "../src/infrastructure/providers/lahman-honors";
import {parseRetrosheetInnings} from "../src/infrastructure/providers/retrosheet-innings";
import {assertHistoricalBridge} from "../src/infrastructure/providers/npb-historical-admission";
import {historicalId,readHistoricalCsv} from "../src/data/mlb-historical";
import {npbHistoricalDatasetSchema} from "../src/domain/npb-historical";
import historyPin from "../src/data/npb-historical-release.json";
import {npbTeamShortName} from "../src/presentation/npb-team-names";
import {RETROSHEET_ATTRIBUTION} from "../src/data/source-registry";
import csPin from "../src/data/npb-cs-release.json";
import {npbCsDatasetSchema} from "../src/domain/npb-cs-observations";
import {parseWikipediaCs} from "../src/infrastructure/providers/wikipedia-npb-cs";

const root=process.argv[2],output=process.argv[3],observedAt=process.argv[4];
if(!root||!output||!observedAt||![root,output].every(p=>resolve(p).startsWith(resolve(".data")+sep))||!Number.isFinite(Date.parse(observedAt))||Date.parse(observedAt)>Date.now())throw Error("Private input/output and fixed past observation time required");
const load=async(name:string)=>readFile(join(root,name));
const hash=(bytes:string|Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
const csv=(b:Uint8Array)=>parse(b,{columns:true,bom:true,skip_empty_lines:true}) as CsvRecord[];
const json=async(name:string)=>JSON.parse((await load(name)).toString());
const players=new Map<string,HonorRecipient>(),records:Honor[]=[],sources:HonorsPage["sources"]=[],held:unknown[]=[];
const archive=JSON.parse(await readFile(".data/npb-history-phase2/combined-archive.json","utf8")) as {observedAt:string;pages:Record<string,{title:string;pageid:number;pageprops?:{wikibase_item?:string};revisions:{revid:number;timestamp:string;slots:{main:{content:string}}}[]}>;titles:{playerId:string;wikidataId:string;npbId:string;title:string;identityScope?:"historical_only"}[]};
const histZip=await readFile(`.data/npb-history-release/${historyPin.sha256}.gz`);if(hash(histZip)!==historyPin.sha256)throw Error("Historical pin hash mismatch");
// Normalized snapshot supplies year/team context only. Award evidence is the
// separately archived article revision, never an inferred statistical ranking.
const history=npbHistoricalDatasetSchema.parse(JSON.parse(gunzipSync(histZip,{maxOutputLength:10_000_000}).toString()));
if(history.inputSha256!==historyPin.inputSha256)throw Error("Historical source mismatch");
const current=await json("npb-directory.json") as {players:{playerId:string}[]};const npbIds=new Set([...current.players.map(p=>p.playerId),...history.players.map(p=>p.playerId)]);
const npbByQid=new Map<string,HonorRecipient>();
for(const link of archive.titles){
 try{assertHistoricalBridge(link);if(!npbIds.has(link.playerId))throw Error("canonical_profile_unavailable");const p=archive.pages[link.title],r=p?.revisions[0];if(!p||!r||p.pageprops?.wikibase_item!==link.wikidataId||r.timestamp>archive.observedAt||/\{\{\s*(?:著作権侵害|Copyvio|コピペ|転載疑惑)/i.test(r.slots.main.content))throw Error("unverified_article_or_rights");
  const ids=[...r.slots.main.content.matchAll(/npb\.jp\/bis\/players\/(\d+)\.html/g)].map(m=>m[1]);if(ids.length&&!ids.includes(link.npbId))throw Error("independent_npb_id_conflict");
  const id=`npb:${link.npbId}`,sourceId=`wiki:${p.pageid}:${r.revid}`,source={id:sourceId,name:`Wikipedia「${p.title}」の執筆者`,url:`https://ja.wikipedia.org/w/index.php?curid=${p.pageid}&oldid=${r.revid}`,authorsUrl:`https://ja.wikipedia.org/w/index.php?title=${encodeURIComponent(p.title)}&action=history`,license:"CC-BY-SA-4.0" as const,sha256:hash(r.slots.main.content),revision:r.revid};
  const parsed=parseNpbHonors(r.slots.main.content,id,sourceId);held.push(...parsed.issues.map(i=>({recipientId:id,...i})));if(!parsed.rows.length)continue;
  const recipient:HonorRecipient={id,name:p.title,externalIds:{npb:link.npbId,wikidata:link.wikidataId},links:[{league:"NPB",playerId:link.playerId,seasons:[...new Set(history.rows.filter(row=>row.playerId===link.playerId).map(row=>row.season))]}],counts:{}};
  players.set(id,recipient);npbByQid.set(link.wikidataId,recipient);sources.push(source);
  for(const row of parsed.rows){const teams=[...new Set(history.rows.filter(h=>h.playerId===link.playerId&&h.season===row.year).map(h=>h.teamId))];row.seasonTeams=teams.map(id=>({id,name:npbTeamShortName(id)}));const divisions=new Set(teams.map(id=>["giants","tigers","dragons","carp","swallows","baystars"].some(t=>id===`npb:team:${t}`)?"CL":"PL"));row.division=divisions.size===1?[...divisions][0]!:null;records.push(row);}
 }catch(e){held.push({playerId:link.playerId,reason:(e as Error).message});}
}
const awardRows=csv(await load("AwardsPlayers.csv")),people=csv(await load("People.csv")),appearances=csv(await load("Appearances.csv")),teamRows=csv(await load("Teams.csv"));
const wanted=new Set(awardRows.filter(r=>annualMlbHonors[r.awardID??""]).map(r=>r.playerID));const peopleById=new Map(people.map(p=>[p.playerID!,p]));
const bbrefs=new Set([...wanted].map(id=>peopleById.get(id!)?.bbrefID).filter(Boolean)),retros=new Set([...wanted].map(id=>peopleById.get(id!)?.retroID).filter(Boolean));
const identities:CsvRecord[]=[],registryBytes=await readFile(".data/chadwick-register.zip");
for(const content of Object.values(unzipSync(registryBytes,{filter:f=>/\/data\/people-[0-9a-f]\.csv$/.test(f.name)})))for(const r of csv(content))if(bbrefs.has(r.key_bbref)||retros.has(r.key_retro))identities.push(r);
const index=(await json("mlb-players.json") as {players:{id:string;seasons:number[]}[]}).players.concat((await json("mlb-post-players.json") as {players:{id:string;seasons:number[]}[]}).players);const mlbProfiles=new Map(index.map(p=>[p.id,p]));
const recipients=new Map<string,HonorRecipient>();
for(const id of [...wanted].sort()){const p=peopleById.get(id!);if(!p)continue;const identity=matchLahmanIdentity(p,identities);
 const profileId=identity?historicalId("player",`chadwick:${identity.key_uuid}`):null,profile=profileId?mlbProfiles.get(profileId):null;
 const recipient:HonorRecipient={id:`lahman:${id}`,name:[p.nameFirst,p.nameLast].filter(Boolean).join(" "),externalIds:{lahman:id!,...(p.retroID?{retrosheet:p.retroID}:{}),...(p.bbrefID?{bbref:p.bbrefID}:{}),...(identity?.key_wikidata?{wikidata:identity.key_wikidata}:{})},links:profile?[{league:"MLB",playerId:profileId!,seasons:profile.seasons}]:[],counts:{}};
 const npb=identity?.key_wikidata?npbByQid.get(identity.key_wikidata):null;
 if(npb&&(!identity?.key_npb||identity.key_npb===npb.externalIds.npb))recipient.links.push(...npb.links);
 recipients.set(id!,recipient);players.set(recipient.id,recipient);
 if(!identity)held.push({recipientId:recipient.id,reason:"independent_lahman_chadwick_identity_unresolved"});
}
const clubs=new Map(teamRows.map(t=>[`${t.yearID}:${t.lgID}:${t.teamID}`,t]));const seasonTeams=new Map<string,Honor["seasonTeams"]>();
for(const a of appearances){if(!wanted.has(a.playerID))continue;const t=clubs.get(`${a.yearID}:${a.lgID}:${a.teamID}`);if(!t)continue;const key=`${a.playerID}:${a.yearID}:${a.lgID}`,list=seasonTeams.get(key)??[];if(!list.some(r=>r.name===t.name))list.push({name:t.name!,id:null});seasonTeams.set(key,list);}
for(const id of wanted){for(const year of new Set(awardRows.filter(r=>r.playerID===id&&r.lgID==="ML").map(r=>r.yearID))){const list=[...seasonTeams.entries()].filter(([k])=>k.startsWith(`${id}:${year}:`)).flatMap(([,v])=>v);if(list.length)seasonTeams.set(`${id}:${year}:ML`,list);}}
const lahmanId="lahman-awards-2025";sources.push({id:lahmanId,name:"SABR / Sean Lahman · AwardsPlayers (1871–2025)",url:"https://sabr.org/lahman-database/",license:"CC-BY-SA-3.0",sha256:hash((await load("AwardsPlayers.csv")).toString())});
const mlb=parseLahmanHonors(awardRows,recipients,seasonTeams,lahmanId);records.push(...mlb.records);held.push(...mlb.held);
const used=new Set(records.map(r=>r.recipientId));for(const id of players.keys())if(!used.has(id))players.delete(id);
for(const r of records){const p=players.get(r.recipientId)!;p.counts[r.awardId]=(p.counts[r.awardId]??0)+1;}
const ordered=records.sort((a,b)=>a.league.localeCompare(b.league)||a.year-b.year||a.awardId.localeCompare(b.awardId)||a.id.localeCompare(b.id));
const page=(rows:Honor[])=>honorsPageSchema.parse({schemaVersion:1,records:rows,recipients:[...new Set(rows.map(r=>r.recipientId))].map(id=>players.get(id)!),sources:sources.filter(s=>rows.some(r=>r.sourceId===s.id))});
const files:Record<string,unknown>={};
for(const league of["NPB","MLB"] as const)for(const year of new Set(ordered.filter(r=>r.league===league).map(r=>r.year)))files[`honors/years/${league}/${year}.json`]=page(ordered.filter(r=>r.league===league&&r.year===year));
for(const league of["NPB","MLB"] as const)for(const bucket of new Set([...players.values()].flatMap(p=>p.links.filter(l=>l.league===league).map(l=>playerHonorBucket(l.playerId))))){files[`honors/players/${league}/${bucket}.json`]=page(ordered.filter(r=>players.get(r.recipientId)!.links.some(l=>l.league===league&&playerHonorBucket(l.playerId)===bucket)));}
const oldPaths=Object.keys(JSON.parse(await readFile(".data/integrated-batch/protected-all-before.json","utf8")));const admittedGames=new Set(oldPaths.filter(p=>p.includes("/mlb/historical/")&&/\/games\/mlb_game_/.test(p)).map(p=>p.match(/mlb_game_([a-f0-9-]+)\.json/)?.[1]).filter((v):v is string=>!!v).map(v=>`mlb:game:${v}`));
let scoreGames=0;for(let year=2014;year<=2025;year++){
 const bytes=await readFile(`.data/${year}csvs.zip`),id=`retrosheet:${year}`,source={id,name:`Retrosheet ${year} CSV`,url:`https://www.retrosheet.org/downloads/plays/${year}csvs.zip`,license:"Retrosheet-notice",sha256:hash(bytes)};
 const parsed=parseRetrosheetInnings(readHistoricalCsv(bytes,year,"gameinfo"),readHistoricalCsv(bytes,year,"teamstats"),year,id,admittedGames);held.push(...parsed.held);scoreGames+=parsed.games.length;
 for(const competition of["regular","postseason"] as const)for(const month of new Set(parsed.games.filter(g=>g.competition===competition).map(g=>g.date.slice(0,7)))){const games=parsed.games.filter(g=>g.competition===competition&&g.date.startsWith(month));files[`scoreboards/MLB/${month}-${competition}.json`]=inningScorePageSchema.parse({schemaVersion:1,games,sources:[source]});}
}
const csBytes=await readFile(`.data/npb-history-release/${csPin.sha256}.gz`);if(hash(csBytes)!==csPin.sha256)throw Error("CS pin mismatch");
const cs=npbCsDatasetSchema.parse(JSON.parse(gunzipSync(csBytes).toString())),csArchive=JSON.parse(await readFile(".data/npb-integrated-expansion/cs-archive.json","utf8"));
const npbGames:InningScore[]=[],npbSources:{id:string;url:string;name:string;license:string;sha256:string}[]=[];
for(const p of csArchive.response.query.pages){const admitted=cs.sources.find(s=>s.pageId===p.pageid);if(!admitted||p.revisions[0].revid!==admitted.revision||hash(p.revisions[0].slots.main.content)!==admitted.contentSha256)throw Error("CS source revision mismatch");const parsed=parseWikipediaCs(p,csArchive.observedAt,[]);for(const board of parsed.scoreboards){const old=cs.games.find(g=>g.id===board.gameId);if(!old||old.date!==board.date||old.awayTeamId!==board.away.id||old.homeTeamId!==board.home.id||old.awayScore!==board.away.runs||old.homeScore!==board.home.runs)throw Error("CS overlay differs from admitted final");npbGames.push(board);}npbSources.push({id:`wiki:${admitted.pageId}:${admitted.revision}`,url:`https://ja.wikipedia.org/w/index.php?curid=${admitted.pageId}&oldid=${admitted.revision}`,name:`Wikipedia「${admitted.title}」の執筆者`,license:"CC-BY-SA-4.0",sha256:admitted.contentSha256});}
files["scoreboards/NPB/2026-10-postseason.json"]=inningScorePageSchema.parse({schemaVersion:1,games:npbGames,sources:npbSources});
const counts:Record<string,number>={scoreGames};for(const league of["NPB","MLB"] as const){const rows=ordered.filter(r=>r.league===league);counts[`${league}Rows`]=rows.length;counts[`${league}Recipients`]=new Set(rows.map(r=>r.recipientId)).size;counts[`${league}LinkedRows`]=rows.filter(r=>players.get(r.recipientId)!.links.length).length;counts[`${league}UnlinkedRecipients`]=new Set(rows.filter(r=>!players.get(r.recipientId)!.links.length).map(r=>r.recipientId)).size;}
counts.NPBScoreGames=npbGames.length;
const manifest=contextManifestSchema.parse({schemaVersion:1,observedAt,cutoff:2025,coverage:"partial",attribution:`Wikipedia article title/award lists: CC BY-SA4.0; revision/authors and modifications retained. SABR/Sean Lahman copyright1996–2025: CC BY-SA3.0. Chadwick Register identity links: ODC-BY1.0. Separate licensed records, not app-code licenses. Extracted annual award winners; no votes, inferred statistical titles, current membership or 2026 awards. Teams are award-season memberships, not award-day/employment claims. ${RETROSHEET_ATTRIBUTION}`,years:{NPB:[...new Set(ordered.filter(r=>r.league==="NPB").map(r=>r.year))].sort((a,b)=>b-a),MLB:[...new Set(ordered.filter(r=>r.league==="MLB").map(r=>r.year))].sort((a,b)=>b-a)},counts,files:Object.fromEntries(Object.entries(files).map(([p,v])=>{const b=JSON.stringify(v);return[p,{bytes:Buffer.byteLength(b),sha256:hash(b)}];}))});
files["manifest.json"]=manifest;const body=Buffer.from(JSON.stringify({schemaVersion:1,files})),compressed=gzipSync(body,{level:9});await mkdir(output,{recursive:true});await writeFile(join(output,"context.json.gz"),compressed);await writeFile(join(output,"context.json"),body);
await writeFile(join(output,"audit.json"),JSON.stringify({counts,held,files:Object.keys(files).length,publicBytes:Object.values(manifest.files).reduce((n,f)=>n+f.bytes,0),maxPayload:Math.max(...Object.values(manifest.files).map(f=>f.bytes)),bodySha256:hash(body),gzipSha256:hash(compressed),archiveBytes:compressed.length,manifestSha256:hash(JSON.stringify(manifest)),manifestBytes:Buffer.byteLength(JSON.stringify(manifest)),canonicalWrites:0,sourceRequests:0},null,2));
console.log(JSON.stringify({counts,files:Object.keys(files).length,archiveBytes:compressed.length,held:held.length}));
const inputPaths=[...['AwardsPlayers.csv','People.csv','Appearances.csv','Teams.csv','readme2025.txt'].map(n=>join(root,n)),'.data/chadwick-register.zip','.data/npb-history-phase2/combined-archive.json','.data/npb-integrated-expansion/cs-archive.json',...Array.from({length:12},(_,i)=>`.data/${2014+i}csvs.zip`)];
await writeFile(join(output,"inputs.json"),JSON.stringify(Object.fromEntries(await Promise.all(inputPaths.map(async p=>[p,hash(await readFile(p))]))),null,2));
