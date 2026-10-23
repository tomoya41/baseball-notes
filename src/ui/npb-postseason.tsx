import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { readNpbCs } from "../application/npb-cs-reader";
import { readNpbSeries } from "../application/npb-series-reader";
import { assertCsSeriesSnapshot, type NpbPostseasonSeries } from "../domain/npb-postseason-series";
import type { PostseasonSeries } from "../domain/competition";
import { DataState, LoadingSkeleton } from "./components";
import { EditorialCover } from "./editorial-cover";
import { ScoreboardRow } from "./design-system";
import { npbTeamShortName as name } from "./npb-team-names";
import japanPin from "../data/npb-japan-series-release.json";
import { JapanSeriesEntry,NpbJapanSeriesScreen,japanSeriesUrl } from "./npb-japan-series";

const seriesUrl = (id: string) => `/NPB/postseason/series/${encodeURIComponent(id)}?season=2026`;
function SeriesScore({ series }: { series: PostseasonSeries }) {
  return <div className="series-score">{series.teams.map(t => <div key={t.teamId} className={t.teamId === series.winnerId ? "series-winner" : ""}>
    <span>{name(t.teamId)}</span><strong aria-label={`シリーズ${t.seriesTotal}勝`}>{t.seriesTotal}</strong>
    {series.teams.some(team => team.advantageWins > 0) && <small>{t.advantageWins ? `試合${t.playedWins}勝 ＋ アドバンテージ${t.advantageWins}勝` : `試合${t.playedWins}勝`}</small>}
  </div>)}</div>;
}
export function NpbPostseasonScreen() {
  const {seriesId}=useParams(),[params]=useSearchParams();
  return seriesId===japanPin.seriesId||!seriesId&&params.get("stage")==="japan_series"?<NpbJapanSeriesScreen/>:<NpbCsPostseasonScreen/>;
}
function NpbCsPostseasonScreen() {
  const [params] = useSearchParams(), {seriesId} = useParams();
  const stage = params.get("stage") ?? "all";
  const valid = (!params.has("season") || params.get("season") === "2026") && (!params.has("competition") || params.get("competition") === "postseason") &&
    ["all","npb_cs_first","npb_cs_final"].includes(stage) && (!seriesId || /^npb:series:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(seriesId));
  const [data, setData] = useState<NpbPostseasonSeries | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!valid) return; let active = true;
    void Promise.all([readNpbSeries(), readNpbCs()]).then(([series,cs]) => { assertCsSeriesSnapshot(series,cs); if (active) { setData(series); setFailed(false); } }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [valid,attempt]);
  const retry = () => { setFailed(false); setAttempt(a => a + 1); }, series = data?.series.find(s => s.id === seriesId);
  return <div className="screen postseason-screen npb-postseason-screen"><EditorialCover kind="postseason" eyebrow="NPB · 2026 POSTSEASON" title={series?.name ?? "ポストシーズン"} />
    {!valid ? <DataState kind="unsupported" title="指定の年度・大会条件は未対応です" /> : failed ? <><DataState kind="source-unavailable" title="シリーズ情報を取得できません" /><button onClick={retry}>再試行</button><Link to="/NPB/cs?season=2026">収録済みの試合・選手成績へ →</Link><Link to={japanSeriesUrl}>日本シリーズの日程へ →</Link></> : !data ? <LoadingSkeleton /> : seriesId && (!series || stage !== "all" && series.round !== stage) ? <DataState kind="no-data" title="この条件のシリーズは未収録です" /> : <>
      <p className="inline-note">記事取得 {data.observedAt.slice(0,10)} · CSの勝敗を収録。試合別の選手成績は一部収録です。</p>
      {series ? <>
        <SeriesScore series={series} />
        <h2>{name(series.winnerId!)} · {series.round === "npb_cs_final" ? "日本シリーズ進出" : "ファイナル進出"}</h2>
        <p className="inline-note">{series.winsRequired}勝で決着 · {series.effectiveDate}の収録結果まで。アドバンテージを実際の試合数・選手成績には加算しません。</p>
        {series.advancesToSeriesId && <Link className="section-action" to={seriesUrl(series.advancesToSeriesId)}>次のステージへ →</Link>}
        <h2>試合結果・選手成績</h2><div className="scoreboard-list">{series.games.map(g => <ScoreboardRow key={g.gameId}
          to={`/NPB/games/${encodeURIComponent(g.gameId)}?season=2026&competition=postseason&stage=${series.round}`}
          away={name(g.awayTeamId)} home={name(g.homeTeamId)} awayScore={g.awayRuns} homeScore={g.homeRuns} date={g.date.slice(5)} status={`終了 · 第${g.gameNumber}戦`} partial />)}</div>
        {series.npbFinalRuleEvidence && <details><summary>アドバンテージの根拠</summary><p>記事に記載された順位別勝敗数と、2026年の正式規定を照合しています。保存済みRegular成績から順位を推測していません。</p><p>{name(series.npbFinalRuleEvidence.leaderTeamId)} {series.npbFinalRuleEvidence.leader.wins}勝{series.npbFinalRuleEvidence.leader.losses}敗 ／ {name(series.npbFinalRuleEvidence.challengerTeamId)} {series.npbFinalRuleEvidence.challenger.wins}勝{series.npbFinalRuleEvidence.challenger.losses}敗</p><a href="https://npb.jp/games/2026/info_cs.html">2026年CSの規定</a></details>}
      </> : <>
        <div className="postseason-bracket" aria-label="CSの勝ち上がり">{["npb_cs_first","npb_cs_final"].filter(r => stage === "all" || stage === r).map(round => <section className="bracket-round" key={round}>
          <h2>{round === "npb_cs_first" ? "ファーストステージ" : "ファイナルステージ"}</h2>
          {data.series.filter(s => s.round === round).map(s => <Link className="series-entry" to={seriesUrl(s.id)} key={s.id}><h3>{s.name}</h3><SeriesScore series={s} /><span className="series-meta">{name(s.winnerId!)}が進出 · 試合詳細へ →</span></Link>)}
        </section>)}</div>
        <JapanSeriesEntry cs={data}/>
      </>}
      <div className="hub-links"><Link to={`/NPB/cs?season=2026${stage === "all" ? "" : `&stage=${stage}`}`}>CSの全収録試合・選手から探す →</Link>{seriesId && <Link to="/NPB/postseason?season=2026">全体の勝ち上がり →</Link>}<Link to="/NPB/schedule">公式戦の日程・結果 →</Link></div>
      <details><summary>収録範囲・出典</summary><p>Wikipediaに記載された情報です。選手成績は一部収録で、公式戦とは別集計です。</p>{data.sources.map(s => <p key={s.pageId}><a href={`https://ja.wikipedia.org/w/index.php?curid=${s.pageId}&oldid=${s.revision}`}>Wikipedia「{s.title}」の執筆者</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · 原記事からの変更：勝敗・成績表の抜粋・表記整理</p>)}</details>
    </>}
  </div>;
}
