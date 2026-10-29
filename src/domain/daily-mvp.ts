import { scoreGameMvp, selectGameMvp, npbGameMvpInput } from "./game-mvp";
import type {NpbGameDetail} from './npb-game-detail';
import type {GameDateIndex, GameIndexRow} from './npb-game-index';
function matchedGame(index:GameDateIndex,summary:GameIndexRow,details:readonly NpbGameDetail[]) {
 const matched=details.filter(d=>d.gameId===summary.gameId),game=matched[0];
 return summary.date===index.date&&summary.status==='final'&&summary.completeness==='complete'&&summary.battingAvailable&&summary.pitchingAvailable&&summary.detailAvailable&&summary.home.score!==null&&summary.away.score!==null&&matched.length===1&&game?.status==='final'&&game.completeness==='complete'&&game.date===index.date&&game.gameNumber===summary.gameNumber&&game.home.id===summary.home.id&&game.away.id===summary.away.id&&game.home.score===summary.home.score&&game.away.score===summary.away.score?game:null;
}
/** One independently complete Game remains usable when other Games are uncollected. */
export function savedGameMvpInputs(index:GameDateIndex,details:readonly NpbGameDetail[]) {
 if(!['complete','partial'].includes(index.coverage)||index.games.length>12||new Set(index.games.map(g=>g.gameId)).size!==index.games.length)return [];
 return index.games.flatMap(summary=>{
  const game=matchedGame(index,summary,details);if(!game)return [];
  const input=npbGameMvpInput(game);
  return selectGameMvp(input).status==='selected'?[{summary,input}]:[];
 });
}
export type DailyMvpResult={status:'selected';players:{playerId:string;name:string;teamId:string;gameId:string;role:'batting'|'pitching';score:number;reason:string}[];games:number;date:string}|{status:'unavailable';reason:string};
/** A transparent editorial reading of closed, saved game samples; never an official award. */
export function selectDailyMvp(index:GameDateIndex,details:readonly NpbGameDetail[]):DailyMvpResult {
 const unavailable=(reason:string):DailyMvpResult=>({status:'unavailable',reason});
 if(index.games.length>12)return unavailable('対象試合数を確認できません。');
 if(index.coverage==='no_games'&&index.games.every(g=>g.status==='postponed'||g.status==='canceled'))return unavailable('この日は公式戦の試合なしと記録されています。');
 if(index.coverage!=='complete')return unavailable('この日の収録が未完了のため、選出を保留しています。');
 if(index.games.some(g=>!['final','postponed','canceled'].includes(g.status)))return unavailable('未終了・結果未確認の試合があるため、選出を保留しています。');
 const games=index.games.filter(g=>g.status==='final');if(!games.length)return unavailable('選考対象の終了試合はありません。');
 const candidates:Extract<DailyMvpResult,{status:'selected'}>['players']=[];
 for(const summary of games){
  const game=matchedGame(index,summary,details);
  if(!game)return unavailable('選手成績未収録、または試合別成績の照合が未完了です。');
  const scored=scoreGameMvp(npbGameMvpInput(game));
  if(scored.status==='unavailable')return scored;
  candidates.push(...scored.candidates);
 }
 const best=Math.max(...candidates.map(c=>c.score));
 if(best<=0)return unavailable('独自の選考基準に該当する成績はありません。');
 // Co-selections avoid assigning a fake distinction to equal readings.
 const players=candidates.filter(c=>Math.abs(c.score-best)<1e-8).sort((a,b)=>a.playerId.localeCompare(b.playerId)||a.role.localeCompare(b.role));
 return {status:'selected',players,games:games.length,date:index.date};
}
