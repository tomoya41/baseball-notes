import { describe,expect,it,vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { gameDateIndexSchema,orderGames,shiftGameDate,type GameIndexRow } from "../src/domain/npb-game-index";
import { recordsSchema } from "../src/domain/npb-records";
import { GameDateView,RecordsView } from "../src/ui/npb-game-surface";
import { StaticGameSurfaceRepository } from "../src/infrastructure/providers/static-game-surface-repository";
import { Favorites } from "../src/application/favorites";
import { migrateData,openDataClient,type DataClient } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { readNpbGameIndex } from "../src/data/npb-game-index-repository";
const row=(id="one",status:GameIndexRow["status"]="final",number=1):GameIndexRow=>({gameId:`npb:game:${id}`,date:"2026-09-25",gameNumber:number,
  status,scheduledTime:"18:00",home:{id:"npb:team:tigers",name:"阪神",score:status==="final"?1:null},
  away:{id:"npb:team:baystars",name:"DeNA",score:status==="final"?2:null},completeness:status==="final"?"partial":null,
  battingAvailable:false,pitchingAvailable:false,detailAvailable:true});
const date=(games:GameIndexRow[],coverage:"complete"|"partial"|"no_games"|"unknown"="partial")=>gameDateIndexSchema.parse({schemaVersion:1,
  league:"NPB",date:"2026-09-25",generatedAt:"2026-09-27T00:00:00Z",coverage,games});
const html=(element:React.ReactNode)=>renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
const records=(ready=false)=>recordsSchema.parse({schemaVersion:1,league:"NPB",season:2026,effectiveDate:"2026-09-26",
  readiness:ready?"ready":"not_ready",coverage:ready?"complete":"partial",qualifierStatus:"verified",reasons:ready?[]:["season_coverage_not_complete"],
  categories:[{role:"batting",metric:"HR",rows:ready?[{playerId:"canonical",displayName:"実選手",rank:1,value:20}]:[]}]});
describe("canonical dated Game surface",()=>{
  it("lists partial Game headers with safe canonical detail links",()=>{const text=html(<GameDateView payload={date([row()])}/>);
    expect(text).toContain("一部データ確認中");expect(text).toContain("npb%3Agame%3Aone");expect(text).toContain("ホーム 阪神");expect(text).toContain("ビジター DeNA");});
  it("distinguishes confirmed no-games from unavailable schedule",()=>{
    expect(html(<GameDateView payload={date([],"no_games")}/>)).toContain("試合なし");
    expect(html(<GameDateView payload={date([],"unknown")}/>)).toContain("確認できていません");});
  it("keeps doubleheaders with stable clock/game/id ordering",()=>{const rows=[row("b","scheduled",2),row("a","scheduled",1)];
    expect(orderGames(rows).map(g=>g.gameId)).toEqual(["npb:game:a","npb:game:b"]);expect(orderGames(rows)).toHaveLength(2);
    expect(html(<GameDateView payload={date(rows)}/>)).toContain("第2試合");});
  it("supports date boundary navigation and rejects malformed dates",()=>{
    expect(shiftGameDate("2026-09-30",1)).toBe("2026-10-01");expect(shiftGameDate("2026-03-01",-1)).toBe("2026-02-28");
    expect(()=>shiftGameDate("2026-02-30",1)).toThrow();});
  it("rejects duplicate Game IDs and mismatched payload dates",()=>{
    expect(()=>date([row(),row()])).toThrow();expect(()=>date([{...row(),date:"2026-09-24"}])).toThrow();});
  it("rejects source/debug fields and no-games with final Games",()=>{
    expect(()=>gameDateIndexSchema.parse({...date([row()]),rawUrl:"https://nf3.sakura.ne.jp/"})).toThrow();expect(()=>date([row()],"no_games")).toThrow();});
  it("loads only selected date, validates HTTP and payload",async()=>{const request=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify(date([row()]))));
    const repo=new StaticGameSurfaceRepository("https://example.test/app/",request as typeof fetch);
    expect((await repo.date("2026-09-25")).games).toHaveLength(1);expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toContain("games/dates/2026-09-25.json");
    await expect(new StaticGameSurfaceRepository("/",async()=>new Response("",{status:500})).date("2026-09-25")).rejects.toThrow();});
  it("uses five fixed SELECTs across any number of Games, preserving scheduled nullable scores",async()=>{
    const client=openDataClient("file::memory:");try{await migrateData(client);await new NpbRepository(client).syncTeamMappings("2026-09-25T00:00:00Z");
      for(const [id,status] of [["one","final"],["two","scheduled"]])await client.execute({sql:`INSERT INTO npb_games
        (game_id,season,game_date,game_number,home_team_id,away_team_id,status,source_key,source_record_id,source_url,collected_at,content_hash)
        VALUES (?,2026,'2026-09-25',?,'npb:team:tigers','npb:team:baystars',?,'test',?,'https://example.test/','2026-09-25T00:00:00Z','h')`,args:[`npb:game:${id}`,id==="one"?1:2,status!,id!]});
      const execute=vi.fn((s:Parameters<DataClient["execute"]>[0])=>client.execute(s));
      const p=await readNpbGameIndex({execute} as unknown as DataClient,"2026-09-26");expect(execute).toHaveBeenCalledTimes(5);
      expect(p.days.find(d=>d.date==="2026-09-25")?.games).toHaveLength(2);
      expect(p.days.find(d=>d.date==="2026-09-25")?.games[1]?.home.score).toBeNull();
      expect(p.days.find(d=>d.date==="2026-10-01")?.coverage).toBe("unknown");
    }finally{client.close();}});
});
describe("Records capability",()=>{
  it("does not leak provisional candidates when closed",()=>{const p=records();expect(html(<RecordsView payload={p}/>)).toContain("集計を確認中");
    expect(()=>recordsSchema.parse({...p,categories:records(true).categories})).toThrow();});
  it("requires complete coverage and verified qualifiers",()=>{expect(()=>recordsSchema.parse({...records(true),coverage:"partial"})).toThrow();
    expect(()=>recordsSchema.parse({...records(true),qualifierStatus:"pending"})).toThrow();});
  it("renders ready canonical records without a UI change",()=>{const text=html(<RecordsView payload={records(true)}/>);
    expect(text).toContain("実選手");expect(text).toContain("/NPB/players/canonical");expect(text).not.toContain("確認中");});
});
describe("local canonical Favorites",()=>{
  it("idempotent add, reload and remove have zero fetches",async()=>{const values=new Map<string,string>();
    const storage={get:async(k:string)=>values.get(k)??null,set:async(k:string,v:string)=>{values.set(k,v);}};
    const target={league:"NPB" as const,kind:"player" as const,entityId:"a66dfd52-1ae2-4245-b849-558f263e6422"};
    const fetch=vi.spyOn(globalThis,"fetch");try{const f=new Favorites(storage);await Promise.all([f.add(target),f.add(target)]);
      expect(await new Favorites(storage).list()).toHaveLength(1);expect(fetch).not.toHaveBeenCalled();await f.remove(target);expect(await f.list()).toHaveLength(0);
    }finally{fetch.mockRestore();}});
  it("preserves unresolved stored IDs without requiring profile data",async()=>{const item={entityId:"broken-id",kind:"player",league:"NPB",addedAt:"2026-09-27T00:00:00Z"};
    expect(await new Favorites({get:async()=>JSON.stringify({version:1,items:[item]}),set:async()=>{}}).list()).toEqual([item]);});
});
