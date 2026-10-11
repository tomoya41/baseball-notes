import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { isDeepStrictEqual } from "node:util";
import { chadwickBridge, historicalId, readHistoricalCsv, importHistoricalSeason, type HistoricalGame, type HistoricalSeason } from "../src/data/mlb-historical";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import { battingDailyKeys, pitchingDailyKeys } from "../src/domain/mlb-recent-explorer";
import { battingDisplayRole } from "../src/domain/player-display-role";
import { formIndexSchema, formMonthSchema, type FormIndex, type FormMonth } from "../src/domain/historical-form";

const sha=(b:Uint8Array|string)=>createHash("sha256").update(b).digest("hex");
export function buildFormMonths(input:{game:HistoricalGame;hash:string}[], competitionType:"regular"|"postseason",season:number):FormMonth[] {
  const games=[...input].sort((a,b)=>a.game.id.localeCompare(b.game.id)), fingerprint=sha(games.map(g=>`${g.game.id}:${g.hash}`).join("\n"));
  const players=[...new Set(games.flatMap(g=>[...g.game.batting,...g.game.pitching].map(p=>p.playerId)))].sort(),teams=[...new Set(games.flatMap(g=>[g.game.homeTeamId,g.game.awayTeamId]))].sort();
  const ids=new Map(players.map((v,i)=>[v,i])),teamIds=new Map(teams.map((v,i)=>[v,i]));
  const months=new Map<string,Record<"batting"|"starters"|"relievers"|"unknown",Map<string,(number|null)[]>>>();
  for(const {game} of games) {
    const month=game.date.slice(0,7),data=months.get(month)??{batting:new Map(),starters:new Map(),relievers:new Map(),unknown:new Map()};months.set(month,data);
    for(const kind of ["batting","pitching"] as const) {
      const seen=new Set<string>(), countedGames=new Set<string>();
      for(const fact of game[kind]) {
        const factKey=`${fact.playerId}:${fact.teamId}`;
        if(seen.has(factKey))throw Error("Duplicate canonical Game Fact");seen.add(factKey);
        const category=kind==="batting"?"batting":"role" in fact?fact.role==="starter"?"starters":fact.role==="reliever"?"relievers":"unknown":"unknown";
        const fields=kind==="batting"?["pa","ab","runs","hits","doubles","triples","homeRuns","rbi","bb","hbp","sh","sf","so","sb","cs"]:["role","outsRecorded","bf","hits","homeRuns","bb","hbp","so","runs","er","win","loss","save"];
        const record=fact as unknown as Record<string,unknown>, values=fields.map(f=>f==="role"?record[f]==="unknown"?null:record[f]==="starter"?1:0:typeof record[f]==="boolean"?Number(record[f]):record[f] as number|null);
        // One player can represent both teams in a resumed game. Count the Game once,
        // while retaining every team's actual batting/pitching counting contribution.
        const countKey=`${category}:${fact.playerId}`, gameCount=countedGames.has(countKey)?0:1;countedGames.add(countKey);
        const key=`${game.date}:${fact.playerId}:${fact.teamId}`,next=[Number(game.date.slice(8)),ids.get(fact.playerId)!,teamIds.get(fact.teamId)!,gameCount,...values],old=data[category].get(key);
        if(old)for(let i=3;i<next.length;i++)next[i]=old[i]===null||next[i]===null?null:old[i]!+next[i]!;
        data[category].set(key,next);
      }
    }
  }
  return [...months].sort(([a],[b])=>a.localeCompare(b)).map(([month,m])=>formMonthSchema.parse({schemaVersion:1,league:"MLB",competitionType,season,sourceFingerprint:fingerprint,month,players,teams,batting:[...m.batting.values()],starters:[...m.starters.values()],relievers:[...m.relievers.values()],unknown:[...m.unknown.values()]}));
}

export function buildFormRoles(archive:Uint8Array,season:number,bridge:ReadonlyMap<string,string>,games:HistoricalGame[]):FormIndex["roles"] {
  const knownGames=new Map(games.map(g=>[g.id,g])),ids=new Set(games.flatMap(g=>[...g.batting,...g.pitching].map(p=>p.playerId)));
  const positions=new Map<string,Map<string,string>>(),dhStarts=new Map<string,Set<string>>();
  const canonical=(retro:string)=>{const uuid=bridge.get(retro);if(!uuid)throw Error("Unresolved role identity");return historicalId("player",`chadwick:${uuid}`);};
  const observe=(id:string,position:string,date:string)=>{const proof=positions.get(id)??new Map();if(!proof.has(position)||proof.get(position)!>date)proof.set(position,date);positions.set(id,proof);};
  for(const row of readHistoricalCsv(archive,season,"fielding")) {
    const game=knownGames.get(historicalId("game",row.gid??""));if(!game||row.stattype!=="value")continue;
    const id=canonical(row.id!),p=["","P","C","1B","2B","3B","SS","LF","CF","RF"][Number(row.d_pos)];
    // A pinch runner can have a fielding row but no batting/pitching Fact; not a new identity.
    if(ids.has(id)&&p)observe(id,p,game.date);
  }
  for(const row of readHistoricalCsv(archive,season,"batting")) {
    const game=knownGames.get(historicalId("game",row.gid??""));if(!game||row.stattype!=="value"||row.dh!=="1")continue;
    const id=canonical(row.id!);if(!ids.has(id))throw Error("Unknown DH identity");observe(id,"DH",game.date);
    if(row.b_seq==="1"&&Number(row.b_pa)>=3){const dates=dhStarts.get(id)??new Set();dates.add(game.id);dhStarts.set(id,dates);}
  }
  const chronological=[...games].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  return [...ids].sort().map(playerId=>{
    const positionDates=[...(positions.get(playerId)??new Map())].sort(([a],[b])=>a.localeCompare(b)).map(([position,date])=>({position,date}));
    // Explicit evidence-based product attribute, not MLB's roster designation.
    let outs=0,dh=0,twoWayEvidenceDate:string|null=null;
    for(const game of chronological) {
      const p=game.pitching.find(p=>p.playerId===playerId);outs+=p?.outsRecorded??0;
      if(dhStarts.get(playerId)?.has(game.id))dh++;
      if(outs>=60&&dh>=20){twoWayEvidenceDate=game.date;break;}
    }
    return {playerId,positions:positionDates.map(p=>p.position),positionDates,battingRole:battingDisplayRole(positionDates.map(p=>p.position)),twoWayEvidence:twoWayEvidenceDate!==null,twoWayEvidenceDate} as FormIndex["roles"][number];
  });
}
export async function generateHistoricalForm(root:string,cache:string,download=false) {
  const started=performance.now();let requests=0,bytes=0,files=0,largest=0,sourceGames=0;
  const archive=async(name:string,url:string)=>{try{return await readFile(join(cache,name));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;if(!download)throw Error(`Source archive missing: ${name}`,{cause:e});const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error(`Source HTTP ${response.status}`,{cause:e});requests++;const b=Buffer.from(await response.arrayBuffer());await mkdir(cache,{recursive:true});await writeFile(join(cache,name),b);return b;}};
  const bridge=chadwickBridge(await archive("chadwick-register.zip","https://codeload.github.com/chadwickbureau/register/zip/refs/heads/master"));
  const write=async(path:string,payload:unknown)=>{const b=gzipSync(JSON.stringify(payload),{level:9});await writeFile(path,b);files++;bytes+=b.length;largest=Math.max(largest,b.length);return b.length;};
  for(const competition of ["regular","postseason"] as const) {
    const prefix=competition==="postseason"?"postseason/":"",base=join(root,prefix);
    const read=async<T>(path:string):Promise<T>=>{const raw=await readFile(join(base,path+".gz")),v:unknown=JSON.parse(gunzipSync(raw).toString());if(!validStaticPayload(prefix+path,v))throw Error(`Invalid source ${path}`);return v as T;};
    const manifest=await read<{seasons:{season:number;coverage:string;firstDate:string;lastDate:string;games:number}[]}>("manifest.json");
    const all=new Map<number,{game:HistoricalGame;hash:string}[]>();
    for(const name of (await readdir(join(base,"games"))).sort()){if(!name.endsWith(".json.gz"))continue;const raw=await readFile(join(base,"games",name)),value:unknown=JSON.parse(gunzipSync(raw).toString());if(!validStaticPayload(prefix+`games/${name.slice(0,-3)}`,value))throw Error(`Invalid Game ${name}`);const game=(value as {game:HistoricalGame}).game;const rows=all.get(game.season)??[];rows.push({game,hash:sha(raw)});all.set(game.season,rows);}
    for(const descriptor of manifest.seasons) {
      const games=all.get(descriptor.season)??[];
      if(games.length!==descriptor.games||new Set(games.map(g=>g.game.id)).size!==games.length)throw Error("Form coverage mismatch");
      const zip=await archive(`${descriptor.season}csvs.zip`,`https://www.retrosheet.org/downloads/${descriptor.season}/${descriptor.season}csvs.zip`);
      if (!Number.isInteger(descriptor.season) || descriptor.season < 2016 || descriptor.season > 2025) throw Error("Unsupported form season");
      const parsed=importHistoricalSeason(zip,descriptor.season as HistoricalSeason,bridge,competition),byId=new Map(parsed.games.map(g=>[g.id,g]));
      if(parsed.validationIssueCount||parsed.unresolvedRetrosheetIds.length||parsed.games.length!==games.length)throw Error("Role source failed existing import validation");
      for(const {game} of games) {
        const source=byId.get(game.id);
        const strip=(rows:unknown[])=>rows.map(r=>{const copy={...r as object};Reflect.deleteProperty(copy,"name");return copy;});
        if(!source||source.date!==game.date||source.homeTeamId!==game.homeTeamId||source.awayTeamId!==game.awayTeamId||source.homeRuns!==game.homeRuns||source.awayRuns!==game.awayRuns||!isDeepStrictEqual(source.batting,strip(game.batting))||!isDeepStrictEqual(source.pitching,strip(game.pitching)))throw Error(`Role source differs from immutable Facts: ${game.id}`);
      }
      const months=buildFormMonths(games,competition,descriptor.season),roles=buildFormRoles(zip,descriptor.season,bridge,games.map(g=>g.game));
      const dir=join(base,"exploration","form",String(descriptor.season));await mkdir(dir,{recursive:true});const descriptors=[];
      for(const month of months){descriptors.push({month:month.month,compressedBytes:await write(join(dir,month.month+".json.gz"),month),rows:month.batting.length+month.starters.length+month.relievers.length+month.unknown.length});if(month.batting.some(r=>r.length!==3+battingDailyKeys.length)||[...month.starters,...month.relievers,...month.unknown].some(r=>r.length!==3+pitchingDailyKeys.length))throw Error("Form columns mismatch");}
      const index=formIndexSchema.parse({schemaVersion:1,league:"MLB",competitionType:competition,season:descriptor.season,sourceFingerprint:months[0]!.sourceFingerprint,roleSourceHash:sha(zip),roles,firstDate:descriptor.firstDate,lastDate:descriptor.lastDate,gameCount:games.length,coverage:descriptor.coverage,months:descriptors});
      await write(join(dir,"index.json.gz"),index);sourceGames+=games.length;
    }
  }
  const report={files,compressedBytes:bytes,largestPayload:largest,sourceGames,sourceRequests:requests,canonicalWrites:0,generationMs:Math.round(performance.now()-started)};console.log(JSON.stringify(report));return report;
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("generate-historical-form.ts"))await generateHistoricalForm(process.argv[2]??"dist/data/mlb/historical",process.argv[3]??".data",process.argv.includes("--download"));
