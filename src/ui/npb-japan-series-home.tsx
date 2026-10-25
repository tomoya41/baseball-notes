import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { readNpbJapanSeries } from "../application/npb-japan-series-reader";
import type { NpbJapanSeries } from "../domain/npb-japan-series";
import { japanSeriesFeaturedPlayers, japanSeriesGameUrl, japanSeriesHomeSummary } from "../presentation/japan-series-home";
import pin from "../data/npb-japan-series-release.json";
import { ClubIdentity } from "./club-identity";
import { PostseasonSpotlight } from "./postseason-spotlight";
import { LicensedPlayerPhoto } from "./licensed-player-photo";
import { npbTeamShortName as name } from "./npb-team-names";

const seriesUrl = `/NPB/postseason/series/${encodeURIComponent(pin.seriesId)}?season=2026`;
const shortDate = (date: string) => `${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`;
const observedTime = (date: string) => new Intl.DateTimeFormat("ja-JP", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit", timeZone:"Asia/Tokyo" }).format(new Date(date));

export function JapanSeriesHomeContent({ data, now }: { data: NpbJapanSeries; now: number }) {
  const [explore, setExplore] = useState(false);
  const { latest, next, awaitingResult, ties, finals, standingCompleteThroughLatest } = japanSeriesHomeSummary(data, now);
  return <section className="japan-home" aria-labelledby="japan-home-title">
    <header className="japan-home-heading"><h1 id="japan-home-title">日本シリーズ <small>2026</small></h1><Link to={seriesUrl}>日程・結果 <span aria-hidden="true">›</span></Link></header>
    <div className="japan-home-score">
      <p className="japan-home-caption">{latest ? `${shortDate(latest.date)} 第${latest.gameNumber}戦 · ${latest.winnerId === null ? "引き分け" : "終了"}` : "最新結果 · 未収録"}</p>
      {latest ? <Link className="japan-home-result" to={japanSeriesGameUrl(latest.gameId)} aria-label={`第${latest.gameNumber}戦 ${name(latest.awayTeamId)} ${latest.awayRuns}対${latest.homeRuns} ${name(latest.homeTeamId)}、試合詳細`}>
        <ClubIdentity teamId={latest.awayTeamId}>{name(latest.awayTeamId)}</ClubIdentity><strong>{latest.awayRuns}<small>–</small>{latest.homeRuns}</strong><ClubIdentity teamId={latest.homeTeamId}>{name(latest.homeTeamId)}</ClubIdentity>
      </Link> : <div className="japan-home-matchup">{data.series.teams.map(t => <ClubIdentity key={t.teamId} teamId={t.teamId}>{name(t.teamId)}</ClubIdentity>)}</div>}
      <div className="japan-home-standing" aria-label="収録済み試合のシリーズ対戦成績">{standingCompleteThroughLatest ? <>{data.series.teams.map(t => <span key={t.teamId}>{name(t.teamId)} <b>{t.playedWins}勝</b></span>)}<small>{finals}試合収録{ties > 0 && ` · ${ties}分`}{data.series.clinched ? " · 決着" : " · 4勝先取"}</small></> : <span>シリーズ勝敗 {finals ? "一部結果未収録" : "未収録"}</span>}</div>
    </div>
    <div className="japan-home-next">
      <div className="japan-home-next-heading"><strong>{data.series.clinched ? data.series.winnerId ? `${name(data.series.winnerId)} 優勝（収録時点）` : "シリーズ終了（収録時点）" : "次の予定"}</strong>{next && <span>{shortDate(next.date)} · 第{next.gameNumber}戦</span>}</div>
      {awaitingResult && <p><Link to={japanSeriesGameUrl(awaitingResult.gameId)}>{shortDate(awaitingResult.date)} 第{awaitingResult.gameNumber}戦 · 結果未収録</Link></p>}
      {next ? <Link className="japan-home-next-game" to={japanSeriesGameUrl(next.gameId)}><ClubIdentity teamId={next.awayTeamId}>{name(next.awayTeamId)}</ClubIdentity><span>vs</span><ClubIdentity teamId={next.homeTeamId}>{name(next.homeTeamId)}</ClubIdentity><span aria-hidden="true">›</span></Link> : !data.series.clinched && <p>次戦情報は未収録です。<Link to={seriesUrl}>日程を確認 →</Link></p>}
    </div>
    <details className="japan-home-explore" onToggle={e=>setExplore(e.currentTarget.open)}><summary>注目選手・試合情報 <small>{observedTime(data.observedAt)}取得</small></summary>
    {next && <><p className="japan-home-venue">{data.venues[next.gameId]} · {next.scheduledAt ? new Intl.DateTimeFormat("ja-JP",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"}).format(new Date(next.scheduledAt)) : "開始時刻未収録"}{next.gameNumber>=5&&" · 開催条件付き"}</p><div className="japan-home-starters"><span>予告先発 <b>未収録</b></span><a href="https://npb.jp/announcement/starter/" target="_blank" rel="noreferrer">公式発表 ↗</a></div></>}
    <details className="japan-home-source"><summary>{observedTime(data.observedAt)}取得 · 収録範囲・出典</summary><p>収録済みの結果と記事記載の日程。リアルタイム更新ではありません。未収録の試合結果・予告先発・個人成績は補完しません。</p>{data.sources.map(s => <p key={s.pageId}><a href={`https://ja.wikipedia.org/w/index.php?curid=${s.pageId}&oldid=${s.revision}`}>Wikipedia「{s.title}」の執筆者</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · 日程・結果の抜粋、表記整理。</p>)}</details>
    {explore && <PostseasonSpotlight scope={{teamIds:data.series.teams.map(t=>t.teamId)}} allowOutlook={!!next}/>}
    {explore && <div className="japan-home-players"><h2>出場球団の選手</h2><div>{japanSeriesFeaturedPlayers.filter(p => data.series.teams.some(t => t.teamId===p.teamId)).map(p => <article key={p.id}><LicensedPlayerPhoto playerId={p.id} season={2026}/><Link className="japan-home-player-link" to={`/NPB/players/${p.id}`}><strong>{p.name}</strong><ClubIdentity teamId={p.teamId}>{name(p.teamId)}</ClubIdentity></Link></article>)}</div></div>}
    </details>
  </section>;
}

export function NpbJapanSeriesHome({ now }: { now: number }) {
  const [data, setData] = useState<NpbJapanSeries | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => { let active=true; void readNpbJapanSeries().then(d => { if(active)setData(d); }).catch(() => { if(active)setFailed(true); }); return () => {active=false;}; }, []);
  if(data)return <JapanSeriesHomeContent data={data} now={now}/>;
  return <section className="japan-home japan-home--pending" aria-label="日本シリーズ"><h1>日本シリーズ</h1><p role="status">{failed ? "収録情報を読み込めません" : "結果・次戦を読み込み中"}</p><Link to={seriesUrl}>日程・結果へ →</Link></section>;
}
