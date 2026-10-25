import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import type {GameDateIndex} from '../domain/npb-game-index';
import type {NpbGameDetail} from '../domain/npb-game-detail';
import {selectDailyMvp,type DailyMvpResult} from '../domain/daily-mvp';
import {readCachedMvpGames} from '../application/daily-mvp';
import type {GameSurfaceReader} from '../application/game-surface';
import {LicensedPlayerPhoto} from './licensed-player-photo';
export function UnavailableDailyMvp({reason='選手成績未収録のため、選出していません。'}:{reason?:string}){return <section className="daily-mvp"><h2>この日のMVP <small>アプリ独自選出</small></h2><p>{reason}</p><p className="inline-note">公式表彰とは異なります。</p></section>;}
export function DailyMvp({date,index,repository,current}:{date:string;index?:GameDateIndex;repository?:GameSurfaceReader|undefined;current?:NpbGameDetail}){
 const [open,setOpen]=useState(false),[result,setResult]=useState<DailyMvpResult|null>(null);
 useEffect(()=>{if(!open)return;let active=true;void(async()=>{const day=index??await repository?.date(date);if(!day||day.date!==date)throw Error('Day unavailable');const details=await readCachedMvpGames(day.games.filter(g=>g.status==='final').map(g=>g.gameId),current);return selectDailyMvp(day,details);})().then(r=>{if(active)setResult(r);}).catch(()=>{if(active)setResult({status:'unavailable',reason:'この日の試合別成績を確認できません。'});});return()=>{active=false;};},[open,date,index,repository,current]);
 return <section className="daily-mvp"><details onToggle={e=>setOpen(e.currentTarget.open)}><summary>この日のMVP（アプリ独自選出）</summary><p>{date} · 公式戦 · 公式表彰とは異なります。</p>{!result?<p role="status">保存済みの試合別成績を確認中</p>:result.status==='unavailable'?<p role="status">{result.reason}</p>:<><p>収録時点の{result.games}試合から独自選出。同点の場合は併記。</p>{result.players.map(p=><article key={`${p.gameId}:${p.playerId}:${p.role}`}><Link to={`/NPB/players/${encodeURIComponent(p.playerId)}`}>{p.name}</Link><p>{p.reason}</p><LicensedPlayerPhoto playerId={p.playerId} season={2026}/><Link to={`/NPB/games/${encodeURIComponent(p.gameId)}?date=${date}`}>選考対象の試合詳細 →</Link></article>)}</>}
 <details><summary>選考方法・収録範囲</summary><p>この日に終了した全試合の、保存済み試合別成績が揃う場合のみ選出します。未終了・未確認・欠損があれば保留。試合詳細で確認済みの保存データを使い、新しい成績取得は行いません。訂正・最新結果は未確認です。</p><p>打者は安打＋本塁打×3＋打点、投手は投球アウト数÷3＋奪三振÷2−失点×2という独自の目安を使用。率の順位や勝利貢献度ではありません。守備・走塁・打席の重要度は未評価。公式戦のみを対象に、CS・日本シリーズと合算しません。</p><p>出典：既存の保存済みnf3試合別成績。日付・球団・スコアと照合し、収録が未完了の試合は選考しません。</p></details><Link to={`/NPB/schedule?date=${date}`}>この日の試合結果 →</Link></details></section>;
}
