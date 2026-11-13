import { DailyMvp } from "./daily-mvp";
import { useEffect,useState } from "react";
import { Link,useSearchParams } from "react-router-dom";
import { z } from "zod";
import { readGameDateForManifest, type GameSurfaceReader } from "../application/game-surface";
import { type GameDateIndex,type GameManifest,type GameIndexRow } from "../domain/npb-game-index";
import { npbScheduleTeam } from "../domain/npb-game-navigation";
import { npbTeamShortName } from "../presentation/npb-team-names";
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
export function GameLinks({games,team}:{games:readonly GameIndexRow[];team?:string | undefined}){return <div className="scoreboard-list">{games.map(g=><ScoreboardRow key={g.gameId}
  to={`/NPB/games/${encodeURIComponent(g.gameId)}?${new URLSearchParams({date:g.date,...(team?{team}:{})})}`} away={g.away.name} home={g.home.name} awayId={g.away.id} homeId={g.home.id} awayScore={g.away.score} homeScore={g.home.score}
  date={g.date.slice(5).replace("-","/")} status={g.status === "scheduled" && g.scheduledTime ? `${g.scheduledTime} JST` : statusLabel[g.status]}
  gameNumber={g.gameNumber > 1 ? g.gameNumber : undefined} partial={g.status === "final" && g.completeness !== "complete"}
  detailLabel={gameDetailLabel(g)} />)}</div>;}
export function GameDateView({payload,team}:{payload:GameDateIndex;team?:string | undefined}){
  const games = team ? payload.games.filter(g => g.home.id === team || g.away.id === team) : payload.games;
  return <>
  {(payload.coverage==="partial"||payload.coverage==="failed")&&<p role="status">一部データ確認中です。保存済みの試合を表示します。</p>}
  {games.length?<GameLinks games={games} team={team}/>:<DataState kind="no-data"
    title={payload.coverage==="no_games"?"試合なし":team?"この球団の収録試合はありません":"この日の試合予定を確認できていません"}/>}
  {!team&&<DailyMvp key={payload.date} date={payload.date} index={payload}/>}
</>;}
export function NpbScheduleScreen({repository,favorites=[],toggle,saving=false}:{repository:GameSurfaceReader;favorites?:FavoriteActions["favorites"];toggle?:FavoriteActions["toggle"];saving?:boolean}){
  const [params,setParams]=useSearchParams(),dateParam=params.get("date");
  const team = npbScheduleTeam(params);
  const unfiltered = new URLSearchParams(params);
  unfiltered.delete("team");
  const [manifest,setManifest]=useState<GameManifest|null>(null),[loadedDay,setPayload]=useState<GameDateIndex|null>(null);
  const [state,setState]=useState<"loading"|"ready"|"error">("loading");
  const [attempt,setAttempt]=useState(0),[internationalOpen,setInternationalOpen]=useState(params.get("view")==="international");
  const date=dateParam??manifest?.effectiveDate;
  const payload = loadedDay && loadedDay.generatedAt === manifest?.generatedAt ? loadedDay : null;
  const outsideRange = Boolean(manifest && date && (!dateSchema.safeParse(date).success || date < manifest.from || date > manifest.to));
  useEffect(()=>{let active=true;void repository.manifest().then(v=>{if(active)setManifest(v);}).catch(()=>{if(active)setState("error");});return()=>{active=false;};},[repository,attempt]);
  useEffect(()=>{if(!date||!manifest||outsideRange)return;let active=true;
    void readGameDateForManifest(repository,manifest,date).then(v=>{if(active){setPayload(v);setState("ready");}}).catch(()=>{if(active)setState("error");});return()=>{active=false;};},[date,manifest,outsideRange,repository]);
  const change=(next:string)=>{if(next===date)return;setState("loading");setPayload(null);setParams(previous=>{const nextParams=new URLSearchParams(previous);nextParams.set("date",next);return nextParams;});};
  const retry=()=>{setManifest(null);setPayload(null);setState("loading");setAttempt(value=>value+1);};
  return <div className="screen game-schedule"><PageHeading eyebrow="NPB" title="日程・結果"/>
    <nav className="profile-tabs game-competition-nav" aria-label="試合の種類"><Link to="/NPB/schedule" aria-current="page">公式戦</Link><Link to="/NPB/postseason">ポストシーズン</Link><button type="button" aria-controls="international-game-entry" aria-expanded={internationalOpen} onClick={()=>setInternationalOpen(open=>!open)}>侍ジャパン</button></nav>
    <InternationalGameEntry expanded={internationalOpen} onToggle={setInternationalOpen}/>
    <p className="game-collection-scope">{manifest ? `${manifest.effectiveDate}までの保存済みデータ` : "保存済みの公式戦を確認"}<Link to="/NPB/preseason">オープン戦 · 未収録</Link></p>
    {manifest&&date&&!outsideRange&&<DateRibbon date={date} min={manifest.from} max={manifest.to} onChange={change} />}
    {team&&<div className="game-collection-scope"><strong>{npbTeamShortName(team)}の試合</strong><Link to={`/NPB/schedule${unfiltered.size?`?${unfiltered}`:""}`}>すべての球団を表示</Link></div>}
    {outsideRange&&manifest?<><DataState kind="unsupported" title="指定日の試合は収録範囲外です"/><button className="button button--secondary" onClick={()=>change(manifest.effectiveDate)}>保存済みの日付へ</button></>:
      state==="error"?<><DataState kind="source-unavailable" title="日程を読み込めません"/><button className="button button--secondary" onClick={retry}>日程を再読み込み</button></>:
      (state==="loading"||payload?.date!==date)&&<LoadingSkeleton/>}
    {state==="ready"&&payload&&payload.date===date&&<GameDateView payload={payload} team={team}/>}
    {!team&&state==="ready"&&payload&&payload.date===date&&toggle&&<details><summary>この日の球団をフォロー</summary><div className="row-list">{[...new Map(payload.games.flatMap(g=>[g.away,g.home]).map(t=>[t.id,t])).values()].map(t=><div className="surface-favorite" key={t.id}><Link className="player-row" to={`/NPB/teams/${encodeURIComponent(t.id)}`}>{t.name}</Link><TeamFavorite league="NPB" teamId={t.id} name={t.name} favorites={favorites} toggle={toggle} saving={saving}/></div>)}</div></details>}
  </div>;
}
