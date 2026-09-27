import { useEffect,useState } from "react";
import { Link,useSearchParams } from "react-router-dom";
import type { GameSurfaceReader } from "../application/game-surface";
import { shiftGameDate,type GameDateIndex,type GameManifest,type GameIndexRow } from "../domain/npb-game-index";
import type { NpbRecords } from "../domain/npb-records";
import { DataState,LoadingSkeleton,PageHeading,SectionHeader } from "./components";
const statusLabel={final:"試合終了",scheduled:"開始前",postponed:"延期",canceled:"中止",suspended:"中断",unknown:"状態未確認"};
export function GameLinks({games}:{games:readonly GameIndexRow[]}){return <div className="surface-games">{games.map(g=><Link key={g.gameId}
  className="surface-game" to={`/NPB/games/${encodeURIComponent(g.gameId)}`}>
  <span>{g.date} · {statusLabel[g.status]}{g.gameNumber>1?` · 第${g.gameNumber}試合`:""}{g.scheduledTime?` · ${g.scheduledTime} JST`:""}</span>
  <strong>ビジター {g.away.name} <b>{g.away.score??"—"}</b></strong><strong>ホーム {g.home.name} <b>{g.home.score??"—"}</b></strong>
  {g.status==="final"&&g.completeness!=="complete"&&<small>一部データ確認中</small>}<small>試合詳細を見る</small>
</Link>)}</div>;}
export function GameDateView({payload}:{payload:GameDateIndex}){return <>
  {(payload.coverage==="partial"||payload.coverage==="failed")&&<p role="status">一部データ確認中です。保存済みの試合を表示します。</p>}
  {payload.games.length?<GameLinks games={payload.games}/>:<DataState kind="no-data"
    title={payload.coverage==="no_games"?"試合なし":"この日の試合予定を確認できていません"}/>}
</>;}
export function NpbScheduleScreen({repository}:{repository:GameSurfaceReader}){
  const [params,setParams]=useSearchParams(),dateParam=params.get("date");
  const [manifest,setManifest]=useState<GameManifest|null>(null),[payload,setPayload]=useState<GameDateIndex|null>(null);
  const [state,setState]=useState<"loading"|"ready"|"error">("loading");
  const date=dateParam??manifest?.effectiveDate;
  useEffect(()=>{let active=true;void repository.manifest().then(v=>{if(active)setManifest(v);}).catch(()=>{if(active)setState("error");});return()=>{active=false;};},[repository]);
  useEffect(()=>{if(!date||!manifest)return;let active=true;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<manifest.from||date>manifest.to){void Promise.resolve().then(()=>{if(active)setState("error");});return()=>{active=false;};}
    void repository.date(date).then(v=>{if(active){setPayload(v);setState("ready");}}).catch(()=>{if(active)setState("error");});return()=>{active=false;};},[date,manifest,repository]);
  const change=(next:string)=>{setState("loading");setPayload(null);setParams({date:next});};
  return <div className="screen game-schedule"><PageHeading eyebrow="NPB" title="日程・結果" detail="保存済みの試合予定と結果。速報ではありません。"/>
    {manifest&&date&&<div className="surface-date-nav"><button disabled={date<=manifest.from} onClick={()=>change(shiftGameDate(date,-1))}>前日</button>
      <label>試合日<input type="date" aria-label="試合日" min={manifest.from} max={manifest.to} value={date} onChange={e=>{if(e.target.value)change(e.target.value);}}/></label>
      <button disabled={date>=manifest.to} onClick={()=>change(shiftGameDate(date,1))}>翌日</button></div>}
    {state==="loading"&&<LoadingSkeleton/>}{state==="error"&&<DataState kind="source-unavailable" title="日程を読み込めません"/>}
    {state==="ready"&&payload&&payload.date===date&&<GameDateView payload={payload}/>}
  </div>;
}
export function NpbRecentGames({repository}:{repository:GameSurfaceReader}){
  const [games,setGames]=useState<GameIndexRow[]|null>(null),[error,setError]=useState(false);
  useEffect(()=>{let active=true;void repository.recent().then(p=>{if(active)setGames(p.games.slice(0,2));}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[repository]);
  return <section className="home-section"><SectionHeader title="最近の試合" action="日程・結果" to="/NPB/schedule"/>
    {error?<DataState kind="source-unavailable" title="試合結果を読み込めません"/>:games?<GameLinks games={games}/>:<LoadingSkeleton/>}</section>;
}
export function RecordsView({payload}:{payload:NpbRecords}){return <><p>2026シーズン · {payload.effectiveDate}までの保存済み成績</p>
  {payload.readiness!=="ready"?<><DataState kind="unsupported" title="2026年シーズン集計を確認中" detail="確認が完了したカテゴリから表示します。"/>
    <details className="advanced-disclosure"><summary>集計状態の詳細</summary><p>Coverage: {payload.coverage} · 規定ルール: {payload.qualifierStatus}</p>
      <ul>{payload.reasons.map(r=><li key={r}>{r}</li>)}</ul></details></>:
    payload.categories.map(c=><section key={`${c.role}:${c.metric}`}><h2>{c.role==="batting"?"打撃":"投球"} · {c.metric}</h2>
      {c.rows.length?<ol className="row-list">{c.rows.map(r=><li key={r.playerId}><Link className="surface-record" to={`/NPB/players/${encodeURIComponent(r.playerId)}`}>
        <span>{r.rank}位 {r.displayName}</span><strong>{r.value}</strong></Link></li>)}</ol>:<p>表示できる記録はありません</p>}</section>)}
</>;}
export function NpbRecordsScreen({repository}:{repository:GameSurfaceReader}){
  const [payload,setPayload]=useState<NpbRecords|null>(null),[error,setError]=useState(false);
  useEffect(()=>{let active=true;void repository.records().then(v=>{if(active)setPayload(v);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[repository]);
  return <div className="screen"><PageHeading eyebrow="NPB" title="シーズン記録"/>{error?<DataState kind="source-unavailable" title="記録データを読み込めません"/>:
    payload?<RecordsView payload={payload}/>:<LoadingSkeleton/>}</div>;
}
