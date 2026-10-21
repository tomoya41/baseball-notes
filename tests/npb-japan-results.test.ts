import {expect,it} from "vitest";
import {createHash} from "node:crypto";
import {japanFixture,japanResultFixture} from "./fixtures/npb-japan-series";
import {buildWikipediaJapanSeries,fetchJapanSeriesCandidate} from "../src/infrastructure/providers/wikipedia-npb-japan-series";
import {npbJapanSeriesSchema,assertJapanSeriesAdvance} from "../src/domain/npb-japan-series";
import {validateJapanRelease} from "../scripts/stage-npb-japan-series";

const build=(f:ReturnType<typeof japanResultFixture>)=>buildWikipediaJapanSeries(f.archive,f.cs,"b".repeat(64),f.admission,f.review,f.now);
it("accepts separately reviewed final evidence, preserves X and counts only played wins, with repeatable readback",()=>{
  const f=japanResultFixture(),d=build(f),old=japanFixture(),before=buildWikipediaJapanSeries(old.archive,old.cs,"b".repeat(64),old.admission);
  expect(d.results[0]).toMatchObject({homeLastInning:"not_played",durationMinutes:192,sourcePageId:5306035});
  expect(d.series.teams.map(t=>t.playedWins)).toEqual([1,0]);expect(d.series.clinched).toBe(false);expect(d.playerStats).toBe("unavailable");
  expect(d).toEqual(build(f));expect(npbJapanSeriesSchema.parse(JSON.parse(JSON.stringify(d)))).toEqual(d);expect(()=>assertJapanSeriesAdvance(before,d)).not.toThrow();
  expect(()=>assertJapanSeriesAdvance(d,before)).toThrow();const corrected=structuredClone(d);corrected.results[0]!.durationMinutes++;expect(()=>assertJapanSeriesAdvance(d,corrected)).toThrow();
});
it.each(["duration","inning","score","date","team","review","duplicate","future"])("fails closed on missing/mismatched %s",kind=>{
  const f=japanResultFixture();let changed=f.block;
  if(kind==="duration")changed=changed.replace("3時間12分","時間分");if(kind==="inning")changed=changed.replace("|R5=0","");
  if(kind==="score")changed=changed.replace("|HR=1","|HR=2");if(kind==="date")changed=changed.replace("10月24日","10月26日");if(kind==="team")changed=changed.replace("|Home=DeNA","|Home=巨人");
  f.archive.response.query.pages[0]!.revisions[0]!.slots.main.content=f.archive.response.query.pages[0]!.revisions[0]!.slots.main.content.replace(f.block,changed);
  f.review.games[0]!.linescore=changed;f.admission[0]!.contentSha256=createHash("sha256").update(f.archive.response.query.pages[0]!.revisions[0]!.slots.main.content).digest("hex");
  if(kind==="review")f.review.reviewedAt="2026-10-24T00:00:00Z";if(kind==="duplicate")f.review.games.push(f.review.games[0]!);if(kind==="future")f.now=Date.parse("2026-10-24T00:00:00Z");
  expect(()=>build(f)).toThrow();
});
it("keeps a twelfth-inning tie distinct from a win, and rejects a ninth-inning tie or invalid X",()=>{
  const tie=japanResultFixture("0",0,0,12);expect(build(tie).series.teams.map(t=>t.playedWins)).toEqual([0,0]);
  expect(()=>build(japanResultFixture("0",0,0,9))).toThrow();expect(()=>build(japanResultFixture("X",0,1))).toThrow();
  expect(()=>build(japanResultFixture("0",1,0))).toThrow("Home win requires");
  const walk=japanResultFixture("1x",0,0);walk.archive.response.query.pages[1]!.revisions[0]!.slots.main.content=walk.archive.response.query.pages[1]!.revisions[0]!.slots.main.content.replace("0 - 0","0 - 1");
  const page=walk.archive.response.query.pages[0]!,newBlock=walk.block.replace("|HR=0","|HR=1");page.revisions[0]!.slots.main.content=page.revisions[0]!.slots.main.content.replace(walk.block,newBlock);walk.review.games[0]!.linescore=newBlock;
  for(const p of walk.archive.response.query.pages)walk.admission.find(a=>a.pageId===p.pageid)!.contentSha256=createHash("sha256").update(p.revisions[0]!.slots.main.content).digest("hex");
  expect(build(walk).results[0]!.homeLastInning).toBe("walk_off");
});
it("retains an immutable Japan release against its own CS generation while validating the active join",()=>{
  const f=japanFixture(),csBody=Buffer.from(JSON.stringify(f.cs)),csHash=createHash("sha256").update(csBody).digest("hex"),d=buildWikipediaJapanSeries(f.archive,f.cs,csHash,f.admission),body=Buffer.from(JSON.stringify(d));
  const release={assetUrl:"https://example.test/retained",sha256:"a".repeat(64),bodySha256:createHash("sha256").update(body).digest("hex"),bytes:body.length,csSeriesBodySha256:csHash,seriesId:d.series.id,gameIds:d.series.games.map(g=>g.gameId)};
  expect(validateJapanRelease(body,release)).toEqual(d);expect(validateJapanRelease(body,release,csBody)).toEqual(d);
  expect(()=>validateJapanRelease(body,release,Buffer.from("different current generation"))).toThrow("active CS");expect(()=>validateJapanRelease(body,{...release,csSeriesBodySha256:"c".repeat(64)})).toThrow("identity");
});
it("fetches only admitted article identities once, bounds bytes, and never admits candidates",async()=>{
  let calls=0;await expect(fetchJapanSeriesCandidate(async(input,init)=>{calls++;expect(String(input)).toContain("pageids=5306035%7C5307595");expect(init?.headers).toHaveProperty("User-Agent");return new Response("x".repeat(500001));})).rejects.toThrow("byte budget");expect(calls).toBe(1);
  await expect(fetchJapanSeriesCandidate(async()=>new Response(JSON.stringify({query:{pages:[]}})))).rejects.toThrow();
});
