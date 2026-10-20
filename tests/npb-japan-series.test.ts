import { expect,it } from "vitest";
import { japanFixture } from "./fixtures/npb-japan-series";
import { buildWikipediaJapanSeries, japanGameId } from "../src/infrastructure/providers/wikipedia-npb-japan-series";
import { npbJapanSeriesSchema, assertJapanSeriesAdvancement } from "../src/domain/npb-japan-series";
it("normalizes seven explicit scheduled Games/venue rowspans, excludes template zeroes, keeps identities independent of dates/revisions",()=>{
  const f=japanFixture(),data=buildWikipediaJapanSeries(f.archive,f.cs,"b".repeat(64));
  expect(data.series.games).toHaveLength(7);expect(data.results).toEqual([]);expect(data.playerStats).toBe("unavailable");
  expect(data.series.games.every(g=>g.homeRuns===null&&g.awayRuns===null&&g.winnerId===null&&g.scheduledAt===null)).toBe(true);
  expect(data.venues[japanGameId(2)]).toBe("横浜スタジアム");expect(data.venues[japanGameId(5)]).toBe("みずほPayPayドーム福岡");
  f.archive.response.query.pages[0]!.revisions[0]!.revid++;expect(buildWikipediaJapanSeries(f.archive,f.cs,"b".repeat(64)).series.id).toBe(data.series.id);
  const wrong=structuredClone(f.cs);wrong.series.find(s=>s.round==="npb_cs_final")!.winnerId="npb:team:lions";expect(()=>assertJapanSeriesAdvancement(data,wrong)).toThrow("identity");
});
it.each(["team","score","venue","rowspan","past","source","copyright"])("rejects unverified source/identity/meaning: %s",kind=>{
  const f=japanFixture(),pages=f.archive.response.query.pages,schedule=pages[1]!.revisions[0]!.slots.main;
  if(kind==="team")schedule.content=schedule.content.replace("福岡ソフトバンクホークス","ホークス");
  if(kind==="score")schedule.content=schedule.content.replace("|| - ||","|| 0 - 0 ||");
  if(kind==="venue")schedule.content=schedule.content.replace("[[横浜スタジアム]]","不明球場");
  if(kind==="rowspan")schedule.content=schedule.content.replace('rowspan="2"','rowspan="3"');
  if(kind==="past")f.archive.observedAt="2026-10-25T10:00:00Z";
  if(kind==="source")pages[0]!.pageid=123;
  if(kind==="copyright")pages[0]!.revisions[0]!.slots.main.content+="{{著作権侵害}}";
  expect(()=>buildWikipediaJapanSeries(f.archive,f.cs,"b".repeat(64))).toThrow();
});
it("keeps final/tie arithmetic separate, rejects unsupported final or nonfinal zeroes, never credits CS advantage",()=>{
  const f=japanFixture(),d=buildWikipediaJapanSeries(f.archive,f.cs,"b".repeat(64));
  const future=structuredClone(d);future.series.games[0]!.homeRuns=0;expect(npbJapanSeriesSchema.safeParse(future).success).toBe(false);
  d.observedAt="2026-10-25T10:00:00Z";const g=d.series.games[0]!;g.status="final";g.homeRuns=0;g.awayRuns=0;
  expect(npbJapanSeriesSchema.safeParse(d).success).toBe(false);
  d.results.push({gameId:g.gameId,homeInnings:Array(12).fill(0),awayInnings:Array(12).fill(0),durationMinutes:240});
  expect(npbJapanSeriesSchema.safeParse(d).success).toBe(true);
  d.series.teams[0]!.advantageWins=1;d.series.teams[0]!.seriesTotal=1;expect(npbJapanSeriesSchema.safeParse(d).success).toBe(false);
});
