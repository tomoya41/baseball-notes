import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { auditHistoricalPostseason } from "../scripts/lib/mlb-postseason-audit";
import { historicalId, historicalTeamId } from "../src/data/mlb-historical";
import { generateHistoricalTeamHubs } from "../scripts/generate-historical-team-hubs";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { buildMlbRecentMonths } from "../scripts/generate-mlb-recent-explorer";
import { createHash } from "node:crypto";

async function fixture(root: string) {
  const id = historicalId("player", "audit"), home = historicalTeamId("ATL"), away = historicalTeamId("HOU"), years = [2020,2021,2022,2023,2024,2025];
  const player = { id, name:"Player", positions:[], seasons:years, teamIds:[home], bats:null, throws:null };
  const slug = id.replaceAll(":", "_"), totals = { batting:null, pitching:null };
  async function put(path: string, data: object, regular = false) {
    const file = join(root, regular ? path : `postseason/${path}`);
    await mkdir(dirname(file),{recursive:true});
    await writeFile(`${file}.gz`,gzipSync(JSON.stringify({schemaVersion:1,league:"MLB",...(!regular ? {competitionType:"postseason"} : {}),...data})));
  }
  await put("players/index.json",{players:[player]},true);
  await put("players/index.json",{players:[player]});
  await put(`players/${slug}.json`,{player,collectedRange:"2020–2025",collectedRangeTotals:totals,seasonTotals:Object.fromEntries(years.map(s => [s,totals])),batting:[],pitching:[]});
  const advanced = {directBvp:"ready",situations:"ready"};
  await put("advanced/capabilities.json",{...advanced,scope:"2020–2025",rawPaPublic:false,unknownContexts:[],timesThroughOrder:"evaluate",count:"evaluate",statcast:"unavailable"});
  for(const scope of ["range",...years.map(String)]) await put(`advanced/${scope}/${slug}.json`,{...advanced,scope,playerId:id,batting:{opponents:[],splits:[]},pitching:{opponents:[],splits:[]}});
  const seasons = [];
  for(const season of years) {
    const date = `${season}-10-01`, gameId = historicalId("game",String(season));
    const game = {id:gameId,season,date,homeTeamId:home,awayTeamId:away,homeRuns:1,awayRuns:0,number:0,innings:9,batting:[],pitching:[],validationIssues:[],competitionType:"postseason"};
    await put(`games/${gameId.replaceAll(":","_")}.json`,{game});
    await put(`schedule/${season}/${date}.json`,{season,date,games:[{...game,status:"final",complete:true}]});
    await put(`seasons/${season}.json`,{season,coverage:"complete",firstDate:date,lastDate:date,gameCount:1,players:[{playerId:id,...totals}]});
    await put(`records/${season}.json`,{season,coverage:"complete",counting:"ready",rate:"not_ready",records:[]});
    await put(`hub/${season}.json`,{season,coverage:"complete",effectiveDate:date,generatedAt:"2026-10-01T00:00:00.000Z",games:1,battingFacts:0,pitchingFacts:0,
      playerStats:{status:"available",reason:null},analysis:{status:"available",reason:null},provenance:{provider:"Retrosheet",archiveSha256:"a".repeat(64),verifiedAt:"2026-10-01T00:00:00.000Z"},
      series:[{id:historicalId("series",String(season)),league:"MLB",season,competitionType:"postseason",round:"world_series",name:"Test",bestOf:1,winsRequired:1,
        teams:[{teamId:home,playedWins:1,advantageWins:0,seriesTotal:1},{teamId:away,playedWins:0,advantageWins:0,seriesTotal:0}],
        games:[{gameId,date,gameNumber:1,homeTeamId:home,awayTeamId:away,homeRuns:1,awayRuns:0,status:"final",scheduledAt:null,winnerId:home}],
        status:"complete",winnerId:home,clinched:true,advancesToSeriesId:null,effectiveDate:date}]});
    seasons.push({season,firstDate:date,lastDate:date,games:1,coverage:"complete",playerCount:1});
  }
  await put("manifest.json",{current2026:"unavailable",seasons,teams:[{id:home,name:"Home"},{id:away,name:"Away"}],features:{directBvp:"available",situationalAnalysis:"available"}});
  return slug;
}

describe("complete advertised Postseason artifact", () => {
  it("audits the additive Recent family and rejects altered or partially published shards", async () => {
    const root = await mkdtemp(join(tmpdir(), "postseason-recent-audit-"));
    try {
      await fixture(root);
      for (const season of [2020,2021,2022,2023,2024,2025]) {
        const raw=await readFile(join(root,`postseason/games/${historicalId("game",String(season)).replaceAll(":","_")}.json.gz`));
        const months=buildMlbRecentMonths([{game:JSON.parse(gunzipSync(raw).toString()).game,hash:createHash("sha256").update(raw).digest("hex")}],"postseason",season);
        const dir=join(root,`postseason/exploration/recent/${season}`);await mkdir(dir,{recursive:true});
        const descriptors=[];
        for(const month of months){const bytes=gzipSync(JSON.stringify(month));await writeFile(join(dir,`${month.month}.json.gz`),bytes);descriptors.push({month:month.month,compressedBytes:bytes.length,rows:0});}
        await writeFile(join(dir,"index.json.gz"),gzipSync(JSON.stringify({schemaVersion:1,league:"MLB",competitionType:"postseason",season,sourceFingerprint:months[0]!.sourceFingerprint,firstDate:`${season}-10-01`,lastDate:`${season}-10-01`,coverage:"complete",gameCount:1,months:descriptors})));
      }
      expect((await auditHistoricalPostseason(root, root)).report.result).toBe("PASS");
      const file = join(root,"postseason/exploration/recent/2025/index.json.gz");
      const original=await readFile(file),index=JSON.parse(gunzipSync(original).toString()); index.gameCount++;
      await writeFile(file,gzipSync(JSON.stringify(index)));
      await expect(auditHistoricalPostseason(root,root)).rejects.toThrow("Recent index/detail mismatch");
      await writeFile(file,original);
      await rm(join(root,"postseason/exploration/recent/2025/2025-10.json.gz"));
      await expect(auditHistoricalPostseason(root,root)).rejects.toThrow("Missing advertised");
    } finally { await rm(root,{recursive:true,force:true}); }
  });
  it("requires the whole derived family at final publication while accepting legacy input archives", async () => {
    const root = await mkdtemp(join(tmpdir(), "postseason-product-required-"));
    try {
      await fixture(root);
      expect((await auditHistoricalPostseason(root, root)).report.result).toBe("PASS");
      await expect(auditHistoricalPostseason(root, root, { requireDerivedProducts: true })).rejects.toThrow("Missing advertised postseason payload: chronology/");
      await generateHistoricalTeamHubs(root);
      expect((await auditHistoricalPostseason(root, root, { requireDerivedProducts: true })).report.result).toBe("PASS");
      await rm(join(root, "postseason/teams"), { recursive: true });
      await rm(join(root, "postseason/chronology"), { recursive: true });
      await expect(auditHistoricalPostseason(root, root, { requireDerivedProducts: true })).rejects.toThrow("Missing advertised");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("accepts complete derived products but rejects partial publication and altered results", async () => {
    const root = await mkdtemp(join(tmpdir(), "postseason-product-audit-"));
    try {
      await fixture(root);
      await generateHistoricalTeamHubs(root);
      expect((await auditHistoricalPostseason(root, root)).report.result).toBe("PASS");
      const file = join(root, `postseason/teams/2025/${historicalTeamId("ATL").replaceAll(":", "_")}.json.gz`);
      const data = JSON.parse(gunzipSync(await readFile(file)).toString());
      data.runsFor++;
      await writeFile(file, gzipSync(JSON.stringify(data)));
      await expect(auditHistoricalPostseason(root, root)).rejects.toThrow("Derived Team/detail mismatch");
      await generateHistoricalTeamHubs(root);
      await rm(file);
      await expect(auditHistoricalPostseason(root, root)).rejects.toThrow("Missing advertised");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it.each(["schedule","records","seasons","advanced","profile","advanced-year","advanced-range","hub","manifest"]) ("rejects missing %s even when surviving Game/Hub counts agree", async missing => {
    const root = await mkdtemp(join(tmpdir(),"postseason-audit-"));
    try {
      const slug = await fixture(root);
      expect((await auditHistoricalPostseason(root,root)).report.result).toBe("PASS");
      const path = missing === "profile" ? `players/${slug}.json.gz` : missing === "advanced-year" ? `advanced/2025/${slug}.json.gz` : missing === "advanced-range" ? `advanced/range/${slug}.json.gz` : missing === "hub" ? "hub/2025.json.gz" : missing === "manifest" ? "manifest.json.gz" : missing;
      await rm(join(root,"postseason",path),{recursive:true});
      await expect(auditHistoricalPostseason(root,root)).rejects.toThrow("Missing advertised");
    } finally { await rm(root,{recursive:true,force:true}); }
  });
  it("rejects a surviving schedule that omits an advertised Game",async () => {
    const root = await mkdtemp(join(tmpdir(),"postseason-audit-"));
    try {
      await fixture(root);
      await writeFile(join(root,"postseason/schedule/2025/2025-10-01.json.gz"),gzipSync(JSON.stringify({schemaVersion:1,league:"MLB",competitionType:"postseason",season:2025,date:"2025-10-01",games:[]})));
      await expect(auditHistoricalPostseason(root,root)).rejects.toThrow("Schedule/detail mismatch");
    } finally { await rm(root,{recursive:true,force:true}); }
  });
});
