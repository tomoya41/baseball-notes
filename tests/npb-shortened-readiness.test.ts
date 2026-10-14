import { readFileSync } from "node:fs";
import { expect,test,vi } from "vitest";
import { openDataClient,migrateData } from "../src/data/database";
import { auditShortenedCandidates,selectOnlyClient,shortenedTargets } from "../src/data/npb-shortened-readiness";
import { hasPlausibleFinalOuts,validateNpbGameFacts } from "../src/data/npb-game-collector";
import { parseInningsOuts,type NpbGame } from "../src/data/npb-nf3";
import { shortenedFinalEvidenceSchema } from "../src/domain/npb-game-completion";
import { playerGameBattingSchema,playerGamePitchingSchema } from "../src/domain/game-facts";

// Synthetic shapes only. Not observations of any of the six real Games.
const g:NpbGame={id:"synthetic-short-final",date:"2026-04-01",season:2026,homeTeamId:"home",awayTeamId:"away",
 gameNumber:1,venue:null,scheduledTime:null,status:"final",homeScore:1,awayScore:0,sourceKey:"nf3",sourceRecordId:"synthetic",
 sourceUrl:"https://nf3.sakura.ne.jp/synthetic-fixture",collectedAt:"2026-10-14T00:00:00.000Z"};
const evidence=(inning:number,home:number,away:number)=>shortenedFinalEvidenceSchema.parse({gameId:g.id,provider:"nf3",
 observedStatus:"officially_shortened_final",observedFinalInning:inning,homeTeamId:g.homeTeamId,awayTeamId:g.awayTeamId,
 homeScore:g.homeScore,awayScore:g.awayScore,homePitchingOuts:home,awayPitchingOuts:away,sourceUrl:g.sourceUrl,verifiedAt:g.collectedAt});

test.each([[5,15,15],[6,18,18],[7,21,18],[7,21,19],[7,21,20],[7,21,21],[9,25,24],[9,26,24]])(
 "exact independent synthetic ending inning %i / home %i / away %i",(i,h,a)=>{
   const e=evidence(i,h,a);expect(hasPlausibleFinalOuts({...g,completionEvidence:e},h,a)).toBe(true);
   expect(hasPlausibleFinalOuts({...g,completionEvidence:e},h,a+1)).toBe(false);
   expect(hasPlausibleFinalOuts({...g,completionEvidence:{...e,awayTeamId:"other"}},h,a)).toBe(false);
 });
test.each([[7,21,1],[7,21,17],[7,20,19],[7,20,21],[7,18,18],[6,15,15],[9,25,23]])(
 "rejects impossible/ambiguous ending inning %i / home %i / away %i",(i,h,a)=>
 expect(hasPlausibleFinalOuts({...g,completionEvidence:evidence(i,h,a)},h,a)).toBe(false));
test("a later interruption inning is not the last counted inning",()=>{
 expect(hasPlausibleFinalOuts({...g,completionEvidence:evidence(5,15,15)},15,15)).toBe(true);
 expect(hasPlausibleFinalOuts({...g,completionEvidence:evidence(6,15,15)},15,15)).toBe(false);
 // No automatic reversion or decrement from the stopped inning.
 expect(hasPlausibleFinalOuts(g,15,15)).toBe(false);
});
test("zero-out next half needs explicitly paired source evidence, never a guessed inning",()=>{
 for(const [i,h,a]of [[6,15,15],[7,18,18],[7,21,18]]){
  const e={...evidence(i!,h!,a!),endingHalf:(h===a?"top":"bottom") as "top"|"bottom",endingOuts:0};
  expect(hasPlausibleFinalOuts({...g,completionEvidence:e},h!,a!)).toBe(true);
  expect(hasPlausibleFinalOuts({...g,completionEvidence:{...e,endingOuts:1}},h!,a!)).toBe(false);
  expect(shortenedFinalEvidenceSchema.safeParse({...e,endingOuts:undefined}).success).toBe(false);
  expect(shortenedFinalEvidenceSchema.safeParse({...e,endingHalf:undefined}).success).toBe(false);
 }
 expect(hasPlausibleFinalOuts({...g,completionEvidence:{...evidence(5,12,12),endingHalf:"top",endingOuts:0}},12,12)).toBe(false);
});
test("legacy and explicit zero-out evidence survive unchanged scratch repository readback",async()=>{
 const db=openDataClient("file::memory:");try{
  await migrateData(db);const {NpbRepository}=await import("../src/data/npb-repository"),repo=new NpbRepository(db);
  await repo.saveGames([g],g.date,false,true);
  const e={...evidence(6,15,15),endingHalf:"top" as const,endingOuts:0};
  await repo.saveShortenedFinalEvidence(e);expect((await repo.findGamesByDate(g.date))[0]?.completionEvidence).toEqual(e);
 }finally{db.close();}
});
test("normal finals and baseball fractions remain unchanged",()=>{
 expect(hasPlausibleFinalOuts(g,27,24)).toBe(true);expect(hasPlausibleFinalOuts(g,30,29)).toBe(true);
 expect(hasPlausibleFinalOuts({...g,homeScore:0,awayScore:1},27,27)).toBe(true);
 expect(hasPlausibleFinalOuts(g,null,24)).toBe(false);expect(hasPlausibleFinalOuts(g,0,0)).toBe(false);
 expect(parseInningsOuts("6.2")).toBe(20);expect(parseInningsOuts("8.1")).toBe(25);
 expect(()=>parseInningsOuts("6.3")).toThrow();expect(()=>parseInningsOuts("6.20")).toThrow();
});
test("official URL/provider cannot be disguised as nf3 evidence",()=>{
 const e=evidence(7,21,20);
 expect(shortenedFinalEvidenceSchema.safeParse({...e,sourceUrl:"https://npb.jp/scores/2026/"}).success).toBe(false);
 expect(shortenedFinalEvidenceSchema.safeParse({...e,provider:"npb-official"}).success).toBe(false);
});
test("evidence never bypasses score/PA/participant/Facts validation",()=>{
 const game={...g,completionEvidence:evidence(7,21,20)};
 const b=["home","away"].flatMap(teamId=>Array.from({length:9},(_,n)=>playerGameBattingSchema.parse({
  gameId:g.id,playerId:teamId+n,teamId,opponentTeamId:teamId==="home"?"away":"home",battingOrder:n+1,starter:true,
  pa:3,ab:3,runs:teamId==="home"&&n===0?1:0,hits:0,doubles:0,triples:0,homeRuns:0,rbi:0,walks:0,hbp:0,
  sacrificeHits:0,sacrificeFlies:0,strikeouts:0,stolenBases:0,caughtStealing:0,sourceKey:"nf3",sourceRecordId:teamId+n,sourceUrl:g.sourceUrl,collectedAt:g.collectedAt})));
 const p=["home","away"].map(teamId=>playerGamePitchingSchema.parse({id:teamId,gameId:g.id,playerId:teamId+"p",teamId,
  opponentTeamId:teamId==="home"?"away":"home",role:"starter",starter:true,inningsPitchedOuts:teamId==="home"?21:20,
  battersFaced:27,pitches:70,hits:0,homeRuns:0,runs:teamId==="away"?1:0,earnedRuns:0,walks:null,hitBatters:null,
  walksAndHitBatters:0,strikeouts:0,decision:null,appearanceOrder:null,catcherId:null,sourceKey:"nf3",sourceRecordId:teamId,sourceUrl:g.sourceUrl,collectedAt:g.collectedAt}));
 expect(validateNpbGameFacts(game,18,b,2,p,18,2).gameStatus).toBe("complete");
 for(const bad of [[...b.slice(1)],b.map((x,n)=>n===0?{...x,pa:null}:x),b.map((x,n)=>n===0?{...x,runs:0}:x)])
   expect(validateNpbGameFacts(game,18,bad,2,p,18,2).gameStatus).toBe("partial");
 expect(validateNpbGameFacts(game,18,b,2,p.map((x,n)=>n===0?{...x,inningsPitchedOuts:null}:x),18,2).gameStatus).toBe("partial");
});
test("remote SELECT-only facade rejects every mutation interface",async()=>{
 const db=openDataClient("file::memory:");try{await migrateData(db);const ro=selectOnlyClient(db),spy=vi.spyOn(db,"execute");
 await ro.execute("SELECT count(*) FROM npb_games");expect(spy).toHaveBeenCalledTimes(1);
 for(const sql of ["DELETE FROM npb_games","INSERT INTO npb_games VALUES (1)","SELECT 1; DELETE FROM npb_games","PRAGMA writable_schema=ON"])
  await expect(ro.execute(sql)).rejects.toThrow("SELECT only");
 expect(()=>ro.batch([],"write")).toThrow("forbids");expect(()=>ro.transaction("write")).toThrow("forbids");
 expect(()=>ro.executeMultiple("DELETE FROM npb_games")).toThrow("forbids");expect(spy).toHaveBeenCalledTimes(1);
 }finally{db.close();}
});
test("six reviewed identities only, workflow publishes diagnostic not raw exports",()=>{
 expect(shortenedTargets).toHaveLength(6);expect(new Set(shortenedTargets.map(t=>t.id)).size).toBe(6);
 const yaml=readFileSync(".github/workflows/npb-freshness.yml","utf8"),script=readFileSync("scripts/audit-npb-shortened-readiness.ts","utf8");
 expect(yaml).toContain(".data/shortened-readiness/report.json");expect(yaml).not.toContain(".data/shortened-readiness/**");
 expect(script).toContain("selectOnlyClient(openDataClient");expect(script).toContain("httpRequests>=499&&!capturedUrls.has(u)");
 expect(script).toContain('exportNpbBackup(remote,join(privateRoot,"export"),"canonical-read-only")');
 expect(yaml).toContain("NPB_NF3_ENABLED: ${{ vars.NPB_NF3_ENABLED }}");
});
test("disabled nf3 stops before database reads or Source requests",async()=>{
 const db=openDataClient("file::memory:"),request=vi.fn(),read=vi.spyOn(db,"execute");
 try{vi.stubEnv("NPB_NF3_ENABLED","false");await expect(auditShortenedCandidates(db,request)).rejects.toThrow("provider disabled");
 expect(request).not.toHaveBeenCalled();expect(read).not.toHaveBeenCalled();
 }finally{vi.unstubAllEnvs();db.close();}
});
test("EOD backup verifies decrypt equality before uploading ciphertext only",()=>{
 const yaml=readFileSync(".github/workflows/npb-eod-watcher.yml","utf8");
 expect(yaml.indexOf("crypt-npb-backup.ts decrypt")).toBeGreaterThan(yaml.indexOf("crypt-npb-backup.ts encrypt"));
 expect(yaml.indexOf("cmp .data/eod-backup.tar.gz")).toBeLessThan(yaml.indexOf("name: npb-eod-encrypted-backup"));
 expect(yaml).toContain("path: .data/eod-backup.tar.gz.enc");
});
test("emulator reconnect validates default capability without early-exit pipeline",()=>{
 const smoke=readFileSync("scripts/android-emulator-smoke.sh","utf8"),workflow=readFileSync(".github/workflows/android-beta.yml","utf8");
 expect(smoke).toContain("awk -f scripts/android-default-network-validated.awk");
 expect(smoke).not.toContain("| grep -q VALIDATED");
 expect(workflow).toContain("bash scripts/test-android-connectivity-parser.sh");
});
