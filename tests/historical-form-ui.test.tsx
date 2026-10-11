// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach,beforeEach,describe,it,expect,vi } from "vitest";
import { HistoricalFormScreen } from "../src/ui/historical-form";
import { HistoricalCompetitionContext } from "../src/ui/historical-competition-context";
import type { FormIndex } from "../src/domain/historical-form";
const fixtures=vi.hoisted(()=>({status:"ready",index:null as FormIndex|null,result:null as unknown,reader:vi.fn()}));
vi.mock("../src/ui/use-mlb-historical",()=>({useHistoricalStatic:()=>({status:fixtures.status,value:fixtures.index,retry:vi.fn()}),useHistoricalDirectory:()=>({status:"ready",value:directory,retry:vi.fn()})}));
vi.mock("../src/application/historical-form",()=>({readHistoricalForm:(input:unknown)=>{fixtures.reader(input);return Promise.resolve(fixtures.result);}}));
const pid="mlb:player:00000000-0000-4000-8000-000000000001",tid="mlb:team:00000000-0000-4000-8000-000000000002";
const directory={players:[{id:pid,name:"非常に長いカタカナ表記の選手名",seasons:[2024]}]};
const manifest={seasons:[{season:2024,firstDate:"2024-03-20",lastDate:"2024-09-29",coverage:"complete"}],teams:[{id:tid,name:"球団名"}]};
let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);fixtures.status="ready";fixtures.reader.mockClear();fixtures.index={schemaVersion:1,league:"MLB",competitionType:"regular",season:2024,sourceFingerprint:"a".repeat(64),roleSourceHash:"b".repeat(64),firstDate:"2024-03-20",lastDate:"2024-09-29",coverage:"complete",gameCount:1,roles:[],months:[]};fixtures.result={entries:[{playerId:pid,name:directory.players[0]!.name,teamIds:[tid],rank:1,metrics:{OPS:{value:1.02},PA:{value:28},HR:{value:2},H:{value:10}},reason:"OPS 1.020 · 28打席",change:"rising",previous:.7,delta:.32}],from:"2024-08-14",to:"2024-08-20",previous:{from:"2024-08-07",to:"2024-08-13"},minimum:20,coverage:"complete",monthlyComplete:false};container=document.createElement("div");document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
async function render(query="mode=hot&period=7&asOfDate=2024-08-20",scope:"regular"|"postseason"="regular"){await act(async()=>root.render(<MemoryRouter key={query+scope} initialEntries={[`/MLB/form?season=2024&${query}`]}><HistoricalCompetitionContext.Provider value={scope}><HistoricalFormScreen manifest={manifest} favorites={[]} toggle={()=>undefined} saving={false} /></HistoricalCompetitionContext.Provider></MemoryRouter>));}
describe("Historical HOT/MVP UI",()=>{
  it("discloses historical scope, samples and independent evaluation; retains period Compare URL",async()=>{await render();expect(container.textContent).toContain("2024 Regular · 2024-08-20時点");expect(container.textContent).toContain("公式");expect(container.textContent).toContain("28");const compare=Array.from(container.querySelectorAll("a")).find(a=>a.textContent==="期間比較")!;expect(compare.getAttribute("href")).toContain("condition=total");expect(compare.getAttribute("href")).toContain("period=7d");expect(container.querySelector("details.form-method")?.textContent).toContain("最低母数");});
  it("labels an incomplete calendar month and does not pass it to a 7-day aggregate",async()=>{await render("mode=monthly&asOfDate=2024-08-20");expect(container.textContent).toContain("月途中時点");expect(container.textContent).not.toContain("期間成績を掘る");expect(container.textContent).toContain("シーズン比較");});
  it("keeps partial and missing releases unavailable instead of rendering a leaderboard",async()=>{fixtures.result={...(fixtures.result as object),coverage:"partial"};await render();expect(container.querySelectorAll(".form-entry")).toHaveLength(0);expect(container.textContent).toContain("候補を表示しません");fixtures.status="missing";fixtures.index=null;await render();expect(container.textContent).toContain("未公開");});
  it("rejects invalid as-of, cross-generation metadata and Postseason monthly candidates",async()=>{await render("asOfDate=2026-08-20");expect(fixtures.reader).not.toHaveBeenCalled();expect(container.textContent).toContain("収録済み期間内");fixtures.index!.gameCount=2;fixtures.index!.lastDate="2024-09-28";await render();expect(container.textContent).toContain("公開状態が一致しません");await render("mode=monthly&competition=postseason&asOfDate=2024-08-20","postseason");expect(container.textContent).toContain("評価対象外");});
});
