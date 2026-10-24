// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NpbTeamPlayers } from "../src/ui/npb-team-players";
import { rosterCatalog, rosterSeason } from "./fixtures/npb-team-players";
import { services as defaults } from "../src/app/services";
import { teamPlayerReturnPath } from "../src/presentation/team-player-list";
import { StaticNpbProductRepository } from "../src/infrastructure/providers/static-npb-product-repository";
const readSeason = vi.fn(), readManifest = vi.fn(), readHistory = vi.fn();
vi.mock("../src/application/explorer-readers",()=>({readNpbExplorerSeason:(...args:unknown[])=>readSeason(...args)}));
vi.mock("../src/application/npb-historical-reader",()=>({readNpbHistoricalManifest:()=>readManifest(),readNpbHistoricalSeason:(...args:unknown[])=>readHistory(...args)}));
let host: HTMLDivElement, root: Root;
const catalog = vi.fn(async()=>rosterCatalog);
const product=new StaticNpbProductRepository("https://example.test/",async()=>Response.json(rosterCatalog));
product.catalog=catalog;
function Destination(){const location=useLocation();return <output>{teamPlayerReturnPath(location.state)}</output>;}
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");document.body.append(host);root=createRoot(host);readSeason.mockReset().mockResolvedValue(rosterSeason);readHistory.mockReset();readManifest.mockReset().mockResolvedValue({seasons:[{season:2025}],players:[]});catalog.mockClear();});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
async function mount(query=""){await act(async()=>root.render(<MemoryRouter initialEntries={[`/NPB/teams/npb:team:tigers/players${query}`]}><Routes><Route path="/NPB/teams/:teamId/players" element={<NpbTeamPlayers services={{...defaults,product}}/>}/><Route path="/NPB/players/:playerId" element={<Destination/>}/></Routes></MemoryRouter>));}
async function select(label:string,value:string){const node=[...host.querySelectorAll('label')].find(n=>n.textContent?.startsWith(label))!.querySelector('select')!;await act(async()=>{node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));});}

it("shows dated number order, role defaults, exact innings and a return link preserving selected filters",async()=>{
  await mount();expect(readSeason).toHaveBeenCalledTimes(1);expect(catalog).toHaveBeenCalledTimes(1);
  expect([...host.querySelectorAll('.team-player-list strong')].filter(n=>n.closest('.player-row__body')).map(n=>n.textContent)).toEqual(['架空選手1','架空選手2','架空選手3']);
  expect([...host.querySelectorAll('.roster-number')].map(n=>n.textContent)).toEqual(['0','12','—']);
  await act(async()=>host.querySelectorAll('.segmented button')[2]!.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  expect(host.querySelector('.team-player-list li')?.textContent).toContain('架空選手3');
  expect(host.querySelector('.team-player-list li')?.textContent).toContain('10.2回');
  expect(host.textContent).toContain('一部未確認');expect(readSeason).toHaveBeenCalledTimes(1);
  await act(async()=>host.querySelector<HTMLAnchorElement>('.team-player-list .player-row')!.click());
  expect(host.querySelector('output')?.textContent).toContain('season=2026&role=pitching&sort=innings');
});

it("shows selected past-team stats with original credits, never current numbers, and links to the selected season",async()=>{
  readHistory.mockResolvedValue({players:[{playerId:rosterCatalog.players[0]!.playerId,name:'過去の選手',article:'架空記事',revision:123}],rows:[{playerId:rosterCatalog.players[0]!.playerId,season:2025,teamId:'npb:team:tigers',role:'batting',metrics:{G:40}}]});
  await mount();await select('年度','2025');
  expect(host.querySelector('.team-player-list li')?.textContent).toContain('打 40試合');
  expect(host.querySelector('.roster-number')).toBeNull();expect(host.querySelector('.team-player-list .player-row')?.getAttribute('href')).toContain('/seasons?season=2025&role=batting');
  expect(host.querySelector('a[href*="oldid=123"]')).not.toBeNull();expect(host.textContent).toContain('CC BY-SA 4.0');
  expect(readHistory).toHaveBeenCalledTimes(1);expect(readSeason).toHaveBeenCalledTimes(1);
});

it("retains role-specific ordering when switching past years back to Current despite available numbers",async()=>{
  readHistory.mockResolvedValue({players:[],rows:[]});
  await mount('?season=2025&role=pitching');
  await select('年度','2026');
  expect([...host.querySelectorAll('select')][1]?.value).toBe('innings');
  expect(host.querySelector('.team-player-list li')?.textContent).toContain('架空選手3');
  await act(async()=>host.querySelectorAll('.segmented button')[1]!.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await select('年度','2025');await select('年度','2026');
  expect([...host.querySelectorAll('select')][1]?.value).toBe('games');
  expect(host.querySelector('.team-player-list li')?.textContent).toContain('架空選手3');
});

it("keeps known affiliation on a failed or mismatched Current season, and does not claim past fetch failure is zero players",async()=>{
  readSeason.mockResolvedValue({...rosterSeason,effectiveDate:'2026-10-11'});await mount();
  expect(host.textContent).toContain('年度成績を取得できません');expect(host.querySelectorAll('.team-player-list li')).toHaveLength(3);
  expect(host.textContent).not.toContain('打 0試合');expect(host.textContent).toContain('打 —試合');
  readHistory.mockRejectedValue(Error('offline'));await select('年度','2025');
  expect(host.textContent).toContain('収録人数を確認できません');expect(host.querySelector('.list-heading')?.textContent).not.toContain('0人');
});

it("never reads or displays Regular stats for a requested Postseason or stage",async()=>{
  await mount('?competition=postseason&stage=npb_cs_final');
  expect(host.textContent).toContain('この選手一覧は公式戦が対象です');
  expect(readSeason).not.toHaveBeenCalled();expect(readHistory).not.toHaveBeenCalled();
  expect(host.querySelector('.team-player-list')).toBeNull();
});
