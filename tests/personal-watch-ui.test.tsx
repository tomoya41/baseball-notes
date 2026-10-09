// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { PersonalWatch, PERSONAL_WATCH_KEY } from "../src/application/personal-watch";
import { PersonalLibrary } from "../src/application/personal-library";

import { PersonalLibraryProvider } from "../src/ui/library-provider";
import { WatchCenter } from "../src/ui/personal-watch";
import { PersonalWatchProvider, WatchSummary } from "../src/ui/watch-shell";
import { services } from "../src/app/services";
import type { WatchObservation } from "../src/domain/personal-watch";
const mocks=vi.hoisted(()=>({read:vi.fn(),online:true,revision:0}));
vi.mock("../src/application/watch-observations",async()=>({...await vi.importActual("../src/application/watch-observations"),readWatchObservations:mocks.read}));
vi.mock("../src/app/mobile-services",()=>({publicNetworkOnline:()=>mocks.online,publicFallbackRevision:()=>mocks.revision}));
const id="00000000-0000-4000-8000-000000000001",game="npb:game:01234567890123456789",date="2026-10-07",now=Date.parse("2026-10-08T01:00:00Z");
const observation=(hits=1):WatchObservation=>({key:"game",league:"NPB",kind:"player",entityId:id,name:"非常に長い外国人選手の登録名",rule:"result",season:2026,competition:"regular",effectiveDate:date,generatedAt:null,eventDate:date,coverage:"partial",path:`/NPB/games/${game}`,metric:"Game",values:{gameId:game,gameNumber:1,H:hits},collectionOnly:false,observedAt:now});
let div:HTMLDivElement,root:Root,data:Map<string,string>,store:PersonalWatch,library:PersonalLibrary;
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);mocks.online=true;mocks.revision=0;mocks.read.mockReset().mockResolvedValue({observations:[],activeEntities:[],notes:[],fetches:0,targets:0,elapsedMs:1});data=new Map();const storage={get:async(k:string)=>data.get(k)??null,set:async(k:string,v:string)=>{data.set(k,v);}};store=new PersonalWatch(storage,()=>now);library=new PersonalLibrary(storage);div=document.createElement("div");document.body.append(div);root=createRoot(div);});
afterEach(async()=>{await act(async()=>root.unmount());div.remove();vi.unstubAllGlobals();});
const mount=async(child:ReactNode)=>(()=>act(async()=>root.render(<MemoryRouter initialEntries={["/NPB/watch-center"]}><PersonalLibraryProvider store={library}><PersonalWatchProvider store={store}>{child}</PersonalWatchProvider></PersonalLibraryProvider></MemoryRouter>)))();
const screen=()=> <WatchCenter league="NPB" services={services} favorites={[]} ready />;
const click=async(text:string)=>{const b=[...div.querySelectorAll("button")].find(b=>b.textContent===text)!;expect(b).toBeTruthy();await act(async()=>b.dispatchEvent(new MouseEvent("click",{bubbles:true})));};
describe("Watch Center interaction",()=>{
  it("keeps Home summary local, links to Watch without any payload acquisition",async()=>{await mount(<WatchSummary league="NPB"/>);expect(mocks.read).not.toHaveBeenCalled();expect(div.textContent).toContain("0 未読");expect(div.querySelector("a")?.href).toContain("/NPB/watch-center");});
  it("shows initial baseline/empty state rather than fabricated alerts",async()=>{mocks.read.mockResolvedValue({observations:[observation()],activeEntities:[`player:${id}`],notes:["Coverage partial"],fetches:2,targets:1,elapsedMs:3});await mount(screen());expect(div.textContent).toContain("確認差分はありません");expect((await store.read()).alerts).toEqual([]);expect(div.textContent).toContain("リアルタイム・バックグラウンド通知ではありません");});
  it("shows Since Last Visit evidence, marks read and dismisses without losing dedup on reload",async()=>{await store.observe([observation()]);mocks.read.mockResolvedValue({observations:[observation(2)],activeEntities:[`player:${id}`],notes:[],fetches:2,targets:1,elapsedMs:3});await mount(screen());expect(div.textContent).toContain("1 未読");expect(div.textContent).toContain("数値が変化");expect(div.textContent).toContain("前回 1");expect(div.querySelector<HTMLAnchorElement>('.watch-alert a')?.href).toContain(game);await click("すべて既読");expect((await store.read()).alerts[0]?.read).toBe(true);await click("非表示");expect(div.querySelector('.watch-alert')).toBeNull();await click("データを確認");expect((await store.read()).alerts).toHaveLength(1);});
  it("does not advance observation state during offline start or a saved-response fallback",async()=>{await store.observe([observation()]);const before=data.get(PERSONAL_WATCH_KEY);mocks.online=false;await mount(screen());expect(mocks.read).not.toHaveBeenCalled();expect(data.get(PERSONAL_WATCH_KEY)).toBe(before);mocks.online=true;mocks.read.mockImplementation(async()=>{mocks.revision++;return{observations:[observation(3)],activeEntities:[`player:${id}`],notes:[],fetches:1,targets:1,elapsedMs:1};});await click("データを確認");expect(div.textContent).toContain("判定を保留");expect(data.get(PERSONAL_WATCH_KEY)).toBe(before);});
  it("allows an explicit Watch-only reset after corrupt storage",async()=>{data.set(PERSONAL_WATCH_KEY,"broken");data.set("baseball:favorites:v1","keep");await mount(screen());expect(div.querySelector('[role="alert"]')).not.toBeNull();await act(async()=>div.querySelector('.library-reset input')!.dispatchEvent(new MouseEvent("click",{bubbles:true})));await click("Watchのみリセット");expect((await store.read()).alerts).toEqual([]);expect(data.get("baseball:favorites:v1")).toBe("keep");});
  it("updates simple preferences without a browser permission request",async()=>{await mount(screen());const input=div.querySelectorAll('.watch-preferences input')[2]!;await act(async()=>input.dispatchEvent(new MouseEvent("click",{bubbles:true})));expect((await store.read()).preferences.recent).toBe(true);expect(div.querySelector('.watch-preferences')?.textContent).toContain("通知許可は不要");});
});

