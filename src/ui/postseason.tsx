import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { League } from "../domain/models";
import { roundLabels, type PostseasonHub, type PostseasonSeries } from "../domain/competition";
import { japaneseMlbTeamName } from "../domain/mlb-japanese-display";
import { DataState, LoadingSkeleton, PageHeading } from "./components";
import { ScoreboardRow } from "./design-system";
import { useHistoricalStatic } from "./use-mlb-historical";

export function PostseasonUnavailable({ league }: { league: League }) {
  return <div className="screen"><PageHeading eyebrow={`${league} · POSTSEASON`} title="ポストシーズン" />
    <DataState kind="unsupported" title="試合・選手成績は未対応" detail="公開アプリで利用できるデータ提供元の条件を確認中です。" />
    <p className="inline-note">Source rights pending · 結果を推測して表示しません。</p>
    <div className="chip-list">{(league === "NPB" ? ["npb_cs_first", "npb_cs_final", "japan_series"] as const : ["wild_card", "division_series", "alcs", "nlcs", "world_series"] as const).map(r => <span className="filter-chip" key={r}>{roundLabels[r]}</span>)}</div>
    {league === "NPB" && <p className="inline-note">CSファイナルの1勝アドバンテージは、試合の勝利とは別に扱います。</p>}
    <Link className="text-link" to={`/${league}/schedule`}>Regular Season 日程・結果</Link>
    {league === "MLB" && <Link className="button button--secondary" to="/MLB/postseason?season=2025">収録済みのPostseasonへ</Link>}
  </div>;
}
const team = (id: string) => japaneseMlbTeamName(id, "球団");
function SeriesScore({ series }: { series: PostseasonSeries }) {
  return <div className="series-score">{series.teams.map(t => <div key={t.teamId} className={t.teamId === series.winnerId ? "series-winner" : ""}>
    <span>{team(t.teamId)}</span><strong>{t.seriesTotal}</strong>{t.advantageWins > 0 && <small>試合{t.playedWins}勝 + アドバンテージ{t.advantageWins}勝</small>}
  </div>)}</div>;
}
export function PostseasonBracket({ hub }: { hub: PostseasonHub }) {
  const rounds = [...new Set(hub.series.map(s => s.round))];
  return <div className="postseason-bracket" aria-label="勝ち上がり・シリーズ一覧">{rounds.map(round => <section className="bracket-round" key={round}>
    <h2>{roundLabels[round]}</h2>{hub.series.filter(s => s.round === round).map(s => <Link className="series-entry" key={s.id} to={`/MLB/postseason/series/${encodeURIComponent(s.id)}?season=${hub.season}`}>
      <SeriesScore series={s} /><span className="series-meta">Best of {s.bestOf} · {s.clinched ? "決着" : "進行中"}<span aria-hidden="true"> →</span></span>
    </Link>)}
  </section>)}</div>;
}
export function MlbPostseasonScreen() {
  const [params] = useSearchParams(), { seriesId } = useParams(), navigate = useNavigate();
  const season = Number(params.get("season") ?? "2025"), supported = season >= 2020 && season <= 2025 && Number.isInteger(season);
  const state = useHistoricalStatic<PostseasonHub>(supported ? `postseason/hub/${season}.json` : null);
  if (!supported) return <PostseasonUnavailable league="MLB" />;
  const hub = state.value, series = hub?.series.find(s => s.id === seriesId);
  return <div className="screen postseason-screen"><PageHeading eyebrow="MLB · HISTORICAL" title={seriesId ? series?.name ?? "シリーズ" : "ポストシーズン"} />
    <div className="schedule-season"><label>シーズン<select value={season} onChange={e => navigate(`/MLB/postseason?season=${e.target.value}`)}>{[2020,2021,2022,2023,2024,2025].map(y => <option key={y}>{y}</option>)}</select></label>
      <Link to="/MLB/postseason?season=2026">2026 Current</Link></div>
    {state.status === "loading" ? <LoadingSkeleton /> : state.status !== "ready" ? <><DataState kind={state.status === "error" ? "source-unavailable" : "no-data"} title="Postseasonを読み込めません" />
      {state.status === "error" && <button className="text-button" onClick={state.retry}>再読み込み</button>}</> : seriesId && !series ? <DataState kind="no-data" title="シリーズが見つかりません" /> : series ? <>
        <SeriesScore series={series} /><p className="inline-note">Best of {series.bestOf} · {series.winsRequired}勝で決着</p>
        {series.winnerId && <h2 className="series-result">{team(series.winnerId)} · {series.round === "world_series" ? "優勝" : "勝ち上がり"}</h2>}
        {series.advancesToSeriesId && <Link className="text-link" to={`/MLB/postseason/series/${encodeURIComponent(series.advancesToSeriesId)}?season=${season}`}>次のラウンド →</Link>}
        <h2>試合結果</h2><div className="scoreboard-list">{series.games.map(g => <ScoreboardRow key={g.gameId} to={`/MLB/games/${encodeURIComponent(g.gameId)}?season=${season}&competition=postseason`}
          away={team(g.awayTeamId)} home={team(g.homeTeamId)} awayScore={g.awayRuns} homeScore={g.homeRuns} date={g.date.slice(5)} status={`終了 · Game ${g.gameNumber}`} />)}</div>
        <Link className="text-link" to={`/MLB/postseason?season=${season}`}>全体の勝ち上がり</Link>
      </> : <><PostseasonBracket hub={hub!} /><p className="inline-note">全{hub!.games}試合 · {hub!.effectiveDate}終了時点 · Retrosheet</p></>}
    <div className="hub-links"><Link to={`/MLB/records?season=${season}&competition=postseason`}>Postseason Leaders →</Link><Link to={`/MLB/schedule?season=${season}&competition=postseason`}>日程・結果 →</Link></div>
  </div>;
}
