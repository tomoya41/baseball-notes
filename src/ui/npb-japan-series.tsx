import { InningScoreboard } from "./inning-scoreboard";
import { UnavailableDailyMvp } from "./daily-mvp";
import { UnavailableGameMvp } from "./game-mvp";
import { PostseasonSpotlight } from "./postseason-spotlight";
import { EditorialCover } from "./editorial-cover";
import { useEffect,useState } from "react";
import { Link,useParams,useSearchParams } from "react-router-dom";
import { readNpbJapanSeries } from "../application/npb-japan-series-reader";
import { assertJapanSeriesAdvancement,allJapanSeriesSources,japanResultSource,type NpbJapanSeries } from "../domain/npb-japan-series";
import type { NpbPostseasonSeries } from "../domain/npb-postseason-series";
import pin from "../data/npb-japan-series-release.json";
import { japanSeries2026Awards } from "../data/npb-japan-series-awards";
import { DataState, LoadingSkeleton } from "./components";
import { ScoreboardRow,ScoreHero } from "./design-system";
import { GameHeading } from "./signature";
import { npbTeamShortName as name } from "./npb-team-names";
import { dateInZone } from "../domain/analysis-query";
import { JapanSeriesRecap } from "./japan-series-recap";
import { japanSeriesBoxScore, japanSeriesBoxScoreLicense, japanSeriesBoxScoreSource,
  japanSeriesIdentitySource, japanSeriesPlayerGames } from "../data/npb-japan-series-box-scores";
import { JapanSeriesBoxScoreTables, JapanSeriesPlayerBoxScores } from "./japan-series-box-score";

import { japanGameNotRequired } from "../presentation/japan-series-recap";

export const japanSeriesUrl=`/NPB/postseason/series/${encodeURIComponent(pin.seriesId)}?season=2026`;
const statusLabel=(status:NpbJapanSeries["series"]["games"][number]["status"])=>({scheduled:"予定・結果未収録",in_progress:"結果未確認",final:"収録済み試合終了",postponed:"延期",cancelled:"中止",suspended:"中断"})[status];
const observedDate=(data:NpbJapanSeries)=>dateInZone(Date.parse(data.observedAt),"Asia/Tokyo");
const observedTime=(time:string)=>new Intl.DateTimeFormat("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"}).format(new Date(time));
function InningScore({data,gameId}:{data:NpbJapanSeries;gameId:string}){
  const result=data.results.find(r=>r.gameId===gameId),game=data.series.games.find(g=>g.gameId===gameId);if(!result||!game)return null;
  return <><InningScoreboard away={{name:name(game.awayTeamId),runs:game.awayRuns,innings:result.awayInnings}} home={{name:name(game.homeTeamId),runs:game.homeRuns,innings:result.homeInnings.map((n,i)=>i===result.homeInnings.length-1&&result.homeLastInning==="not_played"?"X":i===result.homeInnings.length-1&&result.homeLastInning==="walk_off"?`${n}x` as const:n)}}/><p className="inline-note">試合時間 {Math.floor(result.durationMinutes/60)}時間{result.durationMinutes%60}分</p></>;
}
const gameUrl=(id:string)=>`/NPB/games/${encodeURIComponent(id)}?season=2026&competition=postseason&stage=japan_series`;
function useJapan(valid:boolean){
  const [data,setData]=useState<NpbJapanSeries|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{if(!valid)return;let active=true;void readNpbJapanSeries().then(d=>{if(active){setData(d);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[valid,attempt]);
  return {data,failed,retry:()=>{setFailed(false);setAttempt(n=>n+1);}};
}
function Sources({data,gameId}:{data:NpbJapanSeries;gameId?:string|undefined}){
  const own=gameId?japanResultSource(data,gameId):undefined,sources=own?[own]:allJapanSeriesSources(data);
  const box=gameId?japanSeriesBoxScore(data,gameId):undefined;
  return <details><summary>収録範囲・出典</summary><p>記事取得 {observedTime(data.observedAt)}（日本時間）{data.review&&` · 最終確認 ${observedTime(data.review.reviewedAt)}`}。リアルタイム更新ではありません。</p><p>Wikipediaの記事に記載された日程です。実際の開催・開始時刻・選手の出場を保証するものではありません。公式戦・CSとは別集計です。CSの勝数・アドバンテージは日本シリーズへ持ち越しません。</p>{sources.map(s=><p key={`${s.pageId}:${s.revision}`}><a href={`https://ja.wikipedia.org/w/index.php?curid=${s.pageId}&oldid=${s.revision}`}>Wikipedia「{s.title}」の執筆者 · 改版{s.revision}</a> · <a href={`https://ja.wikipedia.org/w/index.php?curid=${s.pageId}&action=history`}>執筆履歴</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · 原記事からの変更：日程・結果・球場の抜粋・表記整理</p>)}{!gameId && data.series.clinched && data.series.id === japanSeries2026Awards.seriesId && <p><a href={japanSeries2026Awards.revisionUrl}>Wikipediaの執筆者による表彰記録</a>（賞と受賞者を抜粋・表記整理、<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>） · <a href={japanSeries2026Awards.officialUrl}>NPB公式の表彰結果</a></p>}{box && <p><a href={japanSeriesBoxScoreSource}>Wikipediaの執筆者による打撃・投球表</a>（収録項目を抜粋・表記整理、<a href={japanSeriesBoxScoreLicense}>CC BY-SA 4.0</a>） · <a href={`https://npb.jp/bis/scores/nipponseries/boxscore2026_${box.gameNumber}.html`}>NPB公式の試合記録</a> · 本人照合<br/><a href={japanSeriesIdentitySource}>Chadwick Register</a>（<a href="https://opendatacommons.org/licenses/by/1-0/">ODC-BY 1.0</a>）と日本語版Wikipediaの選手記事</p>}<a href="https://npb.jp/nippons/2026/">日本シリーズの公式情報</a></details>;
}
function Unavailable({failed,retry}:{failed:boolean;retry:()=>void}){return failed?<><DataState kind="source-unavailable" title="日本シリーズ情報を取得できません"/><button onClick={retry}>再試行</button><Link to="/NPB/cs?season=2026">収録済みのCSへ →</Link></>:<LoadingSkeleton/>;}
export function JapanSeriesEntry({cs}:{cs:NpbPostseasonSeries}){
  const state=useJapan(true);let consistent=false;
  if(state.data){try{assertJapanSeriesAdvancement(state.data,cs);consistent=true;}catch{/* Keep the independently valid CS visible. */}}
  const data=state.data;
  const hasBox=data?.results.some(result=>japanSeriesBoxScore(data,result.gameId));
  const series=data?.series;
  const finished=series?.clinched&&series.winnerId;
  return <section><h2>日本シリーズ</h2>{!state.data?<Unavailable {...state}/>:!consistent?<DataState kind="source-unavailable" title="進出情報の照合を確認中です"/>:<><Link className="player-row" to={japanSeriesUrl}><strong>{state.data.series.teams.map(t=>name(t.teamId)).join(" vs ")}</strong><span>{finished?"総括・結果 →":"日程・シリーズ詳細 →"}</span></Link><p>{finished?`${name(finished)}が優勝`:state.data.results.length?"収録結果 · 4勝先取":"10月24日開幕予定 · 4勝先取"}</p><p className="inline-note">記事取得 {observedDate(state.data)} · {state.data.results.length?`${state.data.results.length}試合の結果を収録。${hasBox?"打撃・投球は試合詳細へ。":"個人成績は未収録。"}`:"試合結果・選手成績は未収録。"}{!finished&&"予定は変更される場合があります。"}</p><Sources data={state.data}/></>}</section>;
}
export function NpbJapanSeriesScreen({gameDetail=false}:{gameDetail?:boolean}){
  const [params,setParams]=useSearchParams(),{gameId}=useParams();
  const side=params.get("boxSide"),role=params.get("role");
  const selection=(side==="away"||side==="home")&&(role==="batting"||role==="pitching")?{side,role} as const:undefined;
  const valid=(!params.has("season")||params.get("season")==="2026")&&(!params.has("competition")||params.get("competition")==="postseason")&&(!params.has("stage")||["all","japan_series"].includes(params.get("stage")!));
  const state=useJapan(valid),d=state.data,s=d?.series,g=s?.games.find(row=>row.gameId===gameId),played=!!s?.games.some(row=>row.status==="final"),beforeOpening=!!d&&observedDate(d)<d.series.games[0]!.date;
  const box=gameDetail&&d&&g?japanSeriesBoxScore(d,g.gameId):undefined;
  const notRequired=!!d&&!!g&&japanGameNotRequired(d,g);
  return <div className="screen postseason-screen">{(!gameDetail||!g)&&<EditorialCover kind="postseason" eyebrow="NPB · 2026 POSTSEASON" title="日本シリーズ"/>}
    {!valid?<DataState kind="unsupported" title="指定の年度・シリーズは未対応です"/>:!d?<Unavailable {...state}/>:gameDetail&&!g?<DataState kind="no-data" title="この試合は未収録です"/>:<>
      <p className="inline-note">収録時点 {observedTime(d.observedAt)}（日本時間）</p>
      {gameDetail&&g?<><GameHeading title={`第${g.gameNumber}戦 · ${name(g.awayTeamId)}対${name(g.homeTeamId)}`} date={g.date} context={`NPB · 日本シリーズ · 第${g.gameNumber}戦${notRequired?" · 当初予定":""}`} backTo={japanSeriesUrl}/><ScoreHero away={name(g.awayTeamId)} home={name(g.homeTeamId)} awayId={g.awayTeamId} homeId={g.homeTeamId} awayScore={g.awayRuns} homeScore={g.homeRuns} status={notRequired?"開催不要":statusLabel(g.status)}/><p>{d.venues[g.gameId]} · {notRequired?"当初の開催予定":g.scheduledAt?new Intl.DateTimeFormat("ja-JP",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"}).format(new Date(g.scheduledAt)):"開始時刻は未収録"}</p>{g.gameNumber>=5&&!notRequired&&<p className="inline-note">4勝先取でシリーズ終了。開催条件を満たす場合の日程です。</p>}
        {!notRequired&&<UnavailableGameMvp/>}
        <InningScore data={d} gameId={g.gameId}/>{box ? <JapanSeriesBoxScoreTables key={g.gameId} box={box} selection={selection}
          onSelection={next=>setParams(previous=>{
            const query=new URLSearchParams(previous);
            if(next){query.set("boxSide",next.side);query.set("role",next.role);}
            else{query.delete("boxSide");query.delete("role");}
            return query;
          },{replace:true,preventScrollReset:true})} /> : <><h2>個人成績</h2><p className="data-notice">{notRequired?"シリーズ決着により開催不要となった試合です。日付・球場は当初予定で、試合結果・個人成績はありません。":g.status==="final"?"結果を収録しています。選手別の打撃・投球成績は未収録です。":"この試合の結果・打撃・投球成績はまだ収録していません。予定スコアの空欄は0点・試合終了を意味しません。"}</p></>}
      </>:<><h2>{d.series.teams.map(t=>name(t.teamId)).join(" vs ")}</h2><p>7試合制 · 4勝先取</p>{played?<div className="series-score">{d.series.teams.map(t=><div key={t.teamId}><span>{name(t.teamId)}</span><strong>{t.playedWins}</strong></div>)}</div>:<p className="data-notice">{beforeOpening?"取得時点で開幕前です。シリーズ勝敗・試合結果・選手成績は未収録です。":"試合結果が未収録のため、シリーズ勝敗は確認できません。出場なし・試合なしとは判定しません。"}</p>}
        <JapanSeriesRecap data={d}/><h2>日程・試合詳細</h2><p className="inline-note">{d.series.clinched?"シリーズは決着しました。開催不要の試合は当初予定を表示しています。":"予定日は変更される場合があります。第5戦以降は開催条件付き。開始時刻は未収録です。"}</p><div className="scoreboard-list">{d.series.games.map(row=><ScoreboardRow key={row.gameId} to={gameUrl(row.gameId)} away={name(row.awayTeamId)} home={name(row.homeTeamId)} awayId={row.awayTeamId} homeId={row.homeTeamId} awayScore={row.awayRuns} homeScore={row.homeRuns} date={row.date.slice(5)} status={`第${row.gameNumber}戦 · ${japanGameNotRequired(d,row)?"開催不要":row.status==="scheduled"?"予定":statusLabel(row.status)}`}/>)}</div></>}
      {!gameDetail&&<UnavailableDailyMvp/>}
      {!gameDetail&&<PostseasonSpotlight scope={{teamIds:d.series.teams.map(t=>t.teamId)}} allowOutlook={!d.series.clinched&&d.series.games.some(g=>g.status==="scheduled"&&g.date>=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Tokyo"}).format(new Date()))}/>}
      <div className="hub-links">{gameDetail&&<Link to={japanSeriesUrl}>日本シリーズの日程へ →</Link>}<Link to="/NPB/postseason?season=2026">CSからの勝ち上がり →</Link><Link to="/NPB/cs?season=2026">CSの収録成績へ →</Link></div><Sources data={d} gameId={gameDetail?g?.gameId:undefined}/>
    </>}
  </div>;
}

export function NpbJapanSeriesPlayerStats({ playerId, role, preferredGameId }: {
  playerId: string; role: "batting" | "pitching"; preferredGameId?: string | undefined;
}) {
  const state = useJapan(true);
  if (!state.data) return <Unavailable {...state} />;
  const games = japanSeriesPlayerGames(state.data, playerId, role);
  return <section>
    <h2>2026年 · 日本シリーズの{role === "batting" ? "打撃" : "投球"}</h2>
    {games.length ? <>
      <p className="inline-note">試合別の収録分 · {games.length}試合。公式戦とは別集計です。</p>
      <JapanSeriesPlayerBoxScores games={games} playerId={playerId} role={role} preferredGameId={preferredGameId} />
      <details className="source-note"><summary>収録範囲・出典</summary>
        <p>「—」の項目は未収録です。<a href={japanSeriesBoxScoreSource}>日本語版Wikipediaの試合表</a>を抜粋・整形し、
          <a href={japanSeriesBoxScoreLicense}>CC BY-SA 4.0</a>で提供しています。本人照合には
          <a href={japanSeriesIdentitySource}>Chadwick Register</a>（<a href="https://opendatacommons.org/licenses/by/1-0/">ODC-BY 1.0</a>）を利用しました。</p>
      </details>
    </> : <DataState kind="no-data" title="この成績区分の日本シリーズの記録は未収録です" />}
  </section>;
}
