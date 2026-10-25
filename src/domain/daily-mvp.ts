import {z} from "zod";
import type {NpbGameDetail} from './npb-game-detail';
import type {GameDateIndex} from './npb-game-index';
export type DailyMvpResult={status:'selected';players:{playerId:string;name:string;teamId:string;gameId:string;role:'batting'|'pitching';score:number;reason:string}[];games:number;date:string}|{status:'unavailable';reason:string};
const outs=(n:number)=>`${Math.floor(n/3)}回${n%3?` ${n%3}/3`:''}`;
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
  const matched=details.filter(d=>d.gameId===summary.gameId),game=matched[0];
  if(summary.completeness!=='complete'||!summary.battingAvailable||!summary.pitchingAvailable||!summary.detailAvailable||summary.home.score===null||summary.away.score===null||matched.length!==1||!game||game.status!=='final'||game.completeness!=='complete'||game.date!==index.date||game.gameNumber!==summary.gameNumber||game.home.id!==summary.home.id||game.away.id!==summary.away.id||game.home.score!==summary.home.score||game.away.score!==summary.away.score)return unavailable('選手成績未収録、または試合別成績の照合が未完了です。');
  for(const side of ['home','away'] as const){
   const bats=game.batting[side],pitches=game.pitching[side];
   if(!bats.length||!pitches.length||new Set(bats.map(p=>p.playerId)).size!==bats.length||new Set(pitches.map(p=>p.playerId)).size!==pitches.length)return unavailable('選手成績の収録範囲を確認できません。');
   for(const b of bats){
    if(!z.uuid().safeParse(b.playerId).success||!b.name.trim()||b.teamId!==game[side].id||![b.ab,b.hits,b.homeRuns,b.rbi].every(v=>v!==null&&Number.isInteger(v)&&v>=0)||b.hits!>b.ab!||b.homeRuns!>b.hits!)return unavailable('選考に必要な打撃成績が一部未収録です。');
    candidates.push({playerId:b.playerId,name:b.name,teamId:b.teamId,gameId:game.gameId,role:'batting',score:b.hits!+3*b.homeRuns!+b.rbi!,reason:`${b.ab}打数${b.hits}安打・${b.homeRuns}本塁打・${b.rbi}打点`});
   }
   for(const p of pitches){
    if(!z.uuid().safeParse(p.playerId).success||!p.name.trim()||p.teamId!==game[side].id||![p.outsRecorded,p.strikeouts,p.runs,p.earnedRuns].every(v=>v!==null&&Number.isInteger(v)&&v>=0)||p.earnedRuns!>p.runs!)return unavailable('選考に必要な投手成績が一部未収録です。');
    candidates.push({playerId:p.playerId,name:p.name,teamId:p.teamId,gameId:game.gameId,role:'pitching',score:p.outsRecorded!/3+p.strikeouts!/2-2*p.runs!,reason:`${outs(p.outsRecorded!)}・${p.strikeouts}奪三振・${p.runs}失点（自責点${p.earnedRuns}）`});
   }
  }
 }
 const best=Math.max(...candidates.map(c=>c.score));
 if(best<=0)return unavailable('独自の選考基準に該当する成績はありません。');
 // Co-selections avoid assigning a fake distinction to equal readings.
 const players=candidates.filter(c=>Math.abs(c.score-best)<1e-8).sort((a,b)=>a.playerId.localeCompare(b.playerId)||a.role.localeCompare(b.role));
 return {status:'selected',players,games:games.length,date:index.date};
}
