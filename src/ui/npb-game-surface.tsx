import { readinessReasonLabel } from "../presentation/baseball-language";
import { DailyMvp } from "./daily-mvp";
import { useEffect,useState } from "react";
import { Link,useSearchParams } from "react-router-dom";
import { z } from "zod";
import type { GameSurfaceReader } from "../application/game-surface";
import { type GameDateIndex,type GameManifest,type GameIndexRow } from "../domain/npb-game-index";
import type { NpbRecords } from "../domain/npb-records";
import { DataState,LoadingSkeleton,PageHeading } from "./components";
import { DateRibbon, ScoreboardRow } from "./design-system";
import { TeamFavorite, type FavoriteActions } from "./team-favorite";
import { InternationalGameEntry } from "./international-game-entry";
import "./npb-experience.css";
const statusLabel={final:"試合終了",scheduled:"開始前",postponed:"延期",canceled:"中止",suspended:"中断",unknown:"状態未確認"};
const dateSchema = z.iso.date();
function gameDetailLabel(game: GameIndexRow): string {
  if (game.status !== "final") return "試合情報";
  if (!game.detailAvailable || !game.battingAvailable && !game.pitchingAvailable)
    return game.home.score === null && game.away.score === null ? "試合情報のみ収録" : "スコアのみ収録";
  return game.battingAvailable && game.pitchingAvailable && game.completeness === "complete" ? "出場選手・個人成績" : "個人成績は一部収録";
}
export function GameLinks({games}:{games:readonly GameIndexRow[]}){return <div className="scoreboard-list">{games.map(g=><ScoreboardRow key={g.gameId}
  to={`/NPB/games/${encodeURIComponent(g.gameId)}?date=${g.date}`} away={g.away.name} home={g.home.name} awayId={g.away.id} homeId={g.home.id} awayScore={g.away.score} homeScore={g.home.score}
  date={g.date.slice(5).replace("-","/")} status={g.status === "scheduled" && g.scheduledTime ? `${g.scheduledTime} JST` : statusLabel[g.status]}
  gameNumber={g.gameNumber > 1 ? g.gameNumber : undefined} partial={g.status === "final" && g.completeness !== "complete"}
  detailLabel={gameDetailLabel(g)} />)}</div>;}
export function GameDateView({payload}:{payload:GameDateIndex}){return <>
  {(payload.coverage==="partial"||payload.coverage==="failed")&&<p role="status">一部データ確認中です。保存済みの試合を表示します。</p>}
  {payload.games.length?<GameLinks games={payload.games}/>:<DataState kind="no-data"
    title={payload.coverage==="no_games"?"試合なし":"この日の試合予定を確認できていません"}/>}
  <DailyMvp key={payload.date} date={payload.date} index={payload}/>
</>;}
export function NpbScheduleScreen({repository,favorites=[],toggle,saving=false}:{repository:GameSurfaceReader;favorites?:FavoriteActions["favorites"];toggle?:FavoriteActions["toggle"];saving?:boolean}){
  const [params,setParams]=useSearchParams(),dateParam=params.get("date");
  const [manifest,setManifest]=useState<GameManifest|null>(null),[payload,setPayload]=useState<GameDateIndex|null>(null);
  const [state,setState]=useState<"loading"|"ready"|"error">("loading");
  const [attempt,setAttempt]=useState(0),[internationalOpen,setInternationalOpen]=useState(params.get("view")==="international");
  const date=dateParam??manifest?.effectiveDate;
  const outsideRange = Boolean(manifest && date && (!dateSchema.safeParse(date).success || date < manifest.from || date > manifest.to));
  useEffect(()=>{let active=true;void repository.manifest().then(v=>{if(active)setManifest(v);}).catch(()=>{if(active)setState("error");});return()=>{active=false;};},[repository,attempt]);
  useEffect(()=>{if(!date||!manifest||outsideRange)return;let active=true;
    void repository.date(date).then(v=>{if(active){setPayload(v);setState("ready");}}).catch(()=>{if(active)setState("error");});return()=>{active=false;};},[date,manifest,outsideRange,repository]);
  const change=(next:string)=>{if(next===date)return;setState("loading");setPayload(null);setParams(previous=>{const nextParams=new URLSearchParams(previous);nextParams.set("date",next);return nextParams;});};
  const retry=()=>{setManifest(null);setPayload(null);setState("loading");setAttempt(value=>value+1);};
  return <div className="screen game-schedule"><PageHeading eyebrow="NPB" title="日程・結果"/>
    <nav className="profile-tabs game-competition-nav" aria-label="試合の種類"><Link to="/NPB/schedule" aria-current="page">公式戦</Link><Link to="/NPB/postseason">ポストシーズン</Link><button type="button" aria-controls="international-game-entry" aria-expanded={internationalOpen} onClick={()=>setInternationalOpen(open=>!open)}>侍ジャパン</button></nav>
    <InternationalGameEntry expanded={internationalOpen} onToggle={setInternationalOpen}/>
    <p className="game-collection-scope">{manifest ? `${manifest.effectiveDate}までの保存済みデータ` : "保存済みの公式戦を確認"}<Link to="/NPB/preseason">オープン戦 · 未収録</Link></p>
    {manifest&&date&&!outsideRange&&<DateRibbon date={date} min={manifest.from} max={manifest.to} onChange={change} />}
    {outsideRange&&manifest?<><DataState kind="unsupported" title="指定日の試合は収録範囲外です"/><button className="button button--secondary" onClick={()=>change(manifest.effectiveDate)}>保存済みの日付へ</button></>:
      state==="error"?<><DataState kind="source-unavailable" title="日程を読み込めません"/><button className="button button--secondary" onClick={retry}>日程を再読み込み</button></>:
      (state==="loading"||payload?.date!==date)&&<LoadingSkeleton/>}
    {state==="ready"&&payload&&payload.date===date&&<GameDateView payload={payload}/>}
    {state==="ready"&&payload&&payload.date===date&&toggle&&<details><summary>この日の球団をフォロー</summary><div className="row-list">{[...new Map(payload.games.flatMap(g=>[g.away,g.home]).map(t=>[t.id,t])).values()].map(t=><div className="surface-favorite" key={t.id}><Link className="player-row" to={`/NPB/teams/${encodeURIComponent(t.id)}`}>{t.name}</Link><TeamFavorite league="NPB" teamId={t.id} name={t.name} favorites={favorites} toggle={toggle} saving={saving}/></div>)}</div></details>}
  </div>;
}
export function RecordsView({payload}:{payload:NpbRecords}){return <><p>2026シーズン · 保存済み成績 · データ基準日 {payload.effectiveDate}</p>
  {payload.readiness!=="ready"?<><DataState kind="unsupported" title="2026年シーズン集計を確認中" detail="確認が完了したカテゴリから表示します。"/>
    <details className="advanced-disclosure"><summary>集計状態の詳細</summary><p>収録状況: {payload.coverage === "complete" ? "収録完了" : "確認中"} · 規定到達の判定: {payload.qualifierStatus === "verified" ? "確認済み" : "確認中"}</p>
      <ul>{payload.reasons.map(r=><li key={r}>{readinessReasonLabel(r)}</li>)}</ul></details></>:
    payload.categories.map(c=><section key={`${c.role}:${c.metric}`}><h2>{c.role==="batting"?"打撃":"投球"} · {c.metric}</h2>
      {c.rows.length?<ol className="row-list">{c.rows.map(r=><li key={r.playerId}><Link className="surface-record" to={`/NPB/players/${encodeURIComponent(r.playerId)}`}>
        <span>{r.rank}位 {r.displayName}</span><strong>{r.value}</strong></Link></li>)}</ol>:<p>表示できる記録はありません</p>}</section>)}
</>;}
export function NpbRecordsScreen({repository}:{repository:GameSurfaceReader}){
  const [payload,setPayload]=useState<NpbRecords|null>(null),[error,setError]=useState(false);
  useEffect(()=>{let active=true;void repository.records().then(v=>{if(active)setPayload(v);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[repository]);
  return <div className="screen"><PageHeading eyebrow="NPB" title="シーズン記録"/><nav className="profile-tabs" aria-label="記録の種類"><Link to="/NPB/records" aria-current="page">シーズン成績</Link><Link to="/NPB/milestones">達成記録</Link><Link to="/NPB/awards">タイトル・表彰</Link><Link to="/NPB/history?season=2025">過去の成績（一部）</Link></nav>{error?<DataState kind="source-unavailable" title="記録データを読み込めません"/>:
    payload?<RecordsView payload={payload}/>:<LoadingSkeleton/>}</div>;
}
