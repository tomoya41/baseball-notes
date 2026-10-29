// @vitest-environment jsdom
import {act} from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {afterEach,expect,it,vi} from 'vitest';
import {DailyMvp} from '../src/ui/daily-mvp';import {readCachedMvpGames} from '../src/application/daily-mvp';import {mvpFixture} from './fixtures/daily-mvp';import type {NpbGameDetail} from '../src/domain/npb-game-detail';
vi.mock('../src/application/daily-mvp',()=>({readCachedMvpGames:vi.fn()}));
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();});
it('keeps game selections lazy and distinct from a held day selection, with canonical Game/player links',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const {game,index}=mvpFixture();
 const day={...index,coverage:'partial' as const,games:[...index.games,{...index.games[0]!,gameId:'npb:game:bbbbbbbbbbbbbbbbbbbb',completeness:'partial' as const}]};
 vi.mocked(readCachedMvpGames).mockResolvedValue([game]);const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
 try{
  await act(async()=>root.render(<MemoryRouter><DailyMvp date={day.date} index={day}/></MemoryRouter>));
  expect(readCachedMvpGames).not.toHaveBeenCalled();expect(host.querySelector('.game-mvp')).toBeNull();
  await act(async()=>host.querySelector('summary')!.click());await act(async()=>host.querySelector('details')!.dispatchEvent(new Event('toggle')));
  expect(host.textContent).toContain('この日の収録が未完了');expect(host.textContent).toContain('試合ごとのMVP（1試合）');
  expect(host.textContent).toContain('保存済みの選手成績／更新未確認');
  expect(host.querySelector('.game-mvp__player a')?.getAttribute('href')).toBe('/NPB/players/00000000-0000-4000-8000-000000000001');
  expect(host.querySelector('.saved-game-mvps a')?.getAttribute('href')).toContain(`games/${encodeURIComponent(game.gameId)}?date=${game.date}`);
  expect(readCachedMvpGames).toHaveBeenCalledTimes(1);expect(readCachedMvpGames).toHaveBeenCalledWith(day.games.map(g=>g.gameId),undefined);
  expect(host.querySelector('.saved-game-mvps')?.hasAttribute('open')).toBe(false);
  await act(async()=>host.querySelector('.saved-game-mvps summary')!.dispatchEvent(new Event('toggle',{bubbles:true})));
  expect(readCachedMvpGames).toHaveBeenCalledTimes(1);
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('does not manufacture a game selection when no complete player box is saved',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const {index}=mvpFixture();vi.mocked(readCachedMvpGames).mockResolvedValue([]);
 const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
 try{await act(async()=>root.render(<MemoryRouter><DailyMvp date={index.date} index={index}/></MemoryRouter>));await act(async()=>host.querySelector('summary')!.click());await act(async()=>host.querySelector('details')!.dispatchEvent(new Event('toggle')));
  expect(host.querySelector('.saved-game-mvps')).toBeNull();expect(host.querySelector('.game-mvp__player')).toBeNull();expect(host.textContent).toContain('選手成績未収録');
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('does not show the previous date MVP while a different date/snapshot is being checked',async()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const {game,index}=mvpFixture();vi.mocked(readCachedMvpGames).mockResolvedValue([game]);const host=document.createElement('div'),root=createRoot(host);document.body.append(host);const render=(i:typeof index)=>root.render(<MemoryRouter><DailyMvp date={i.date} index={i}/></MemoryRouter>);try{await act(async()=>render(index));const summary=host.querySelector('summary')!;await act(async()=>summary.click());await act(async()=>{host.querySelector('details')!.dispatchEvent(new Event('toggle'));});expect(host.textContent).toContain('架空打者0');let resolve!:(games:NpbGameDetail[])=>void;vi.mocked(readCachedMvpGames).mockReturnValue(new Promise(r=>{resolve=r;}));const next={...index,date:'2026-09-26',generatedAt:'2026-09-27T00:00:00Z',coverage:'partial' as const,games:[]};await act(async()=>render(next));expect(host.textContent).not.toContain('架空打者0');expect(host.textContent).toContain('確認中');await act(async()=>resolve([]));expect(host.textContent).toContain('収録が未完了');expect(host.textContent).not.toContain('架空打者0');}finally{await act(async()=>root.unmount());host.remove();}});
