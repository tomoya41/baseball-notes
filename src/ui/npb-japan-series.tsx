import { useEffect,useState } from "react";
import { Link,useParams,useSearchParams } from "react-router-dom";
import { readNpbJapanSeries } from "../application/npb-japan-series-reader";
import { assertJapanSeriesAdvancement,type NpbJapanSeries } from "../domain/npb-japan-series";
import type { NpbPostseasonSeries } from "../domain/npb-postseason-series";
import pin from "../data/npb-japan-series-release.json";
import { DataState,LoadingSkeleton,PageHeading } from "./components";
import { ScoreboardRow,ScoreHero } from "./design-system";
import { GameHeading } from "./signature";
import { npbTeamShortName as name } from "./npb-team-names";
import { dateInZone } from "../domain/analysis-query";

export const japanSeriesUrl=`/NPB/postseason/series/${encodeURIComponent(pin.seriesId)}?season=2026`;
const statusLabel=(status:NpbJapanSeries["series"]["games"][number]["status"])=>({scheduled:"予定・結果未収録",in_progress:"結果未確認",final:"収録済み試合終了",postponed:"延期",cancelled:"中止",suspended:"中断"})[status];
const observedDate=(data:NpbJapanSeries)=>dateInZone(Date.parse(data.observedAt),"Asia/Tokyo");
const observedTime=(time:string)=>new Intl.DateTimeFormat("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"}).format(new Date(time));
function InningScore({data,gameId}:{data:NpbJapanSeries;gameId:string}){
  const result=data.results.find(r=>r.gameId===gameId),game=data.series.games.find(g=>g.gameId===gameId);if(!result||!game)return null;
  return <section><h2>イニング別得点</h2><table className="series-innings" aria-label="イニング別得点"><thead><tr><th scope="col">回</th><th scope="col">{name(game.awayTeamId)}</th><th scope="col">{name(game.homeTeamId)}</th></tr></thead><tbody>{result.awayInnings.map((runs,i)=><tr key={i}><th scope="row">{i+1}</th><td>{runs}</td><td>{i===result.homeInnings.length-1&&result.homeLastInning==="not_played"?"X":`${result.homeInnings[i]}${i===result.homeInnings.length-1&&result.homeLastInning==="walk_off"?"x":""}`}</td></tr>)}</tbody></table><p className="inline-note">試合時間 {Math.floor(result.durationMinutes/60)}時間{result.durationMinutes%60}分 · Xはその回の攻撃なし、xはサヨナラ終了。投球アウト数は推定しません。</p></section>;
}
const gameUrl=(id:string)=>`/NPB/games/${encodeURIComponent(id)}?season=2026&competition=postseason&stage=japan_series`;
function useJapan(valid:boolean){
  const [data,setData]=useState<NpbJapanSeries|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{if(!valid)return;let active=true;void readNpbJapanSeries().then(d=>{if(active){setData(d);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[valid,attempt]);
  return {data,failed,retry:()=>{setFailed(false);setAttempt(n=>n+1);}};
}
function Sources({data}:{data:NpbJapanSeries}){return <details><summary>収録範囲・出典</summary><p>Wikipediaの記事に記載された日程です。実際の開催・開始時刻・選手の出場を保証するものではありません。公式戦・CSとは別集計です。CSの勝数・アドバンテージは日本シリーズへ持ち越しません。</p>{data.sources.map(s=><p key={s.pageId}><a href={`https://ja.wikipedia.org/w/index.php?curid=${s.pageId}&oldid=${s.revision}`}>Wikipedia「{s.title}」の執筆者</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · 原記事からの変更：日程・球場の抜粋・表記整理</p>)}<a href="https://npb.jp/nippons/2026/">最新の開催情報を公式サイトで確認</a></details>;}
function Unavailable({failed,retry}:{failed:boolean;retry:()=>void}){return failed?<><DataState kind="source-unavailable" title="日本シリーズ情報を取得できません"/><button onClick={retry}>再試行</button><Link to="/NPB/cs?season=2026">収録済みのCSへ →</Link></>:<LoadingSkeleton/>;}
export function JapanSeriesEntry({cs}:{cs:NpbPostseasonSeries}){
  const state=useJapan(true);let consistent=false;
  if(state.data){try{assertJapanSeriesAdvancement(state.data,cs);consistent=true;}catch{/* Keep the independently valid CS visible. */}}
  return <section><h2>日本シリーズ</h2>{!state.data?<Unavailable {...state}/>:!consistent?<DataState kind="source-unavailable" title="進出情報の照合を確認中です"/>:<><Link className="player-row" to={japanSeriesUrl}><strong>{state.data.series.teams.map(t=>name(t.teamId)).join(" vs ")}</strong><span>日程・大会詳細 →</span></Link><p>{state.data.results.length?"収録結果 · 4勝先取":"10月24日開幕予定 · 4勝先取"}</p><p className="inline-note">記事取得 {observedDate(state.data)} · {state.data.results.length?`終了確認した${state.data.results.length}試合の結果を収録。個人成績は未収録。`:`試合結果・選手成績は未収録。`}予定は変更される場合があります。</p><Sources data={state.data}/></>}</section>;
}
export function NpbJapanSeriesScreen({gameDetail=false}:{gameDetail?:boolean}){
  const [params]=useSearchParams(),{gameId}=useParams();
  const valid=(!params.has("season")||params.get("season")==="2026")&&(!params.has("competition")||params.get("competition")==="postseason")&&(!params.has("stage")||["all","japan_series"].includes(params.get("stage")!));
  const state=useJapan(valid),d=state.data,s=d?.series,g=s?.games.find(row=>row.gameId===gameId),played=!!s?.games.some(row=>row.status==="final"),beforeOpening=!!d&&observedDate(d)<d.series.games[0]!.date;
  return <div className="screen postseason-screen">{(!gameDetail||!g)&&<PageHeading eyebrow="NPB · 2026 · ポストシーズン" title="日本シリーズ"/>}
    {!valid?<DataState kind="unsupported" title="指定の年度・大会条件は未対応です"/>:!d?<Unavailable {...state}/>:gameDetail&&!g?<DataState kind="no-data" title="この試合は未収録です"/>:<>
      <p className="inline-note">記事取得 {observedTime(d.observedAt)}（日本時間）{d.review&&` · 最終確認 ${observedTime(d.review.reviewedAt)} · ${d.review.reviewedBy}`} · 予定と収録結果を表示。リアルタイム更新ではありません。</p>
      {gameDetail&&g?<><GameHeading title={`第${g.gameNumber}戦 · ${name(g.awayTeamId)}対${name(g.homeTeamId)}`} date={g.date} context={`NPB · 日本シリーズ · 第${g.gameNumber}戦`} backTo={japanSeriesUrl}/><ScoreHero away={name(g.awayTeamId)} home={name(g.homeTeamId)} awayScore={g.awayRuns} homeScore={g.homeRuns} status={statusLabel(g.status)}/><p>{d.venues[g.gameId]} · {g.scheduledAt?new Intl.DateTimeFormat("ja-JP",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"}).format(new Date(g.scheduledAt)):"開始時刻は未収録"}</p>{g.gameNumber>=5&&<p className="inline-note">4勝先取で大会終了。開催条件を満たす場合の日程です。</p>}
        <InningScore data={d} gameId={g.gameId}/><h2>個人成績</h2><p className="data-notice">{g.status==="final"?"結果を収録しています。選手別の打撃・投球成績は未収録です。":"この試合の結果・打撃・投球成績はまだ収録していません。予定スコアの空欄は0点・試合終了を意味しません。"}</p>
      </>:<><h2>{d.series.teams.map(t=>name(t.teamId)).join(" vs ")}</h2><p>7試合制 · 4勝先取</p>{played?<div className="series-score">{d.series.teams.map(t=><div key={t.teamId}><span>{name(t.teamId)}</span><strong>{t.playedWins}</strong></div>)}</div>:<p className="data-notice">{beforeOpening?"取得時点で開幕前です。シリーズ勝敗・試合結果・選手成績は未収録です。":"試合結果が未収録のため、シリーズ勝敗は確認できません。出場なし・試合なしとは判定しません。"}</p>}
        {d.series.clinched&&<p>{name(d.series.winnerId!)} · 4勝先取で決着（収録時点）</p>}<h2>日程・試合詳細</h2><p className="inline-note">予定日は変更される場合があります。第5戦以降は開催条件付き。開始時刻は未収録です。</p><div className="scoreboard-list">{d.series.games.map(row=><ScoreboardRow key={row.gameId} to={gameUrl(row.gameId)} away={name(row.awayTeamId)} home={name(row.homeTeamId)} awayScore={row.awayRuns} homeScore={row.homeRuns} date={row.date.slice(5)} status={`第${row.gameNumber}戦 · ${row.status==="scheduled"?"予定":statusLabel(row.status)}`}/>)}</div></>}
      <div className="hub-links">{gameDetail&&<Link to={japanSeriesUrl}>日本シリーズの日程へ →</Link>}<Link to="/NPB/postseason?season=2026">CSからの勝ち上がり →</Link><Link to="/NPB/cs?season=2026">CSの収録成績へ →</Link></div><Sources data={d}/>
    </>}
  </div>;
}
