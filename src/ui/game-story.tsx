import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Services } from "../app/services";
import type { League } from "../domain/models";
import type { NpbGameDetail } from "../domain/npb-game-detail";
import type { NpbTeamSeason } from "../domain/npb-product-contract";
import type { GameIndexRow } from "../domain/npb-game-index";
import type { PostseasonHub } from "../domain/competition";
import { shiftGameDate } from "../domain/npb-game-index";
import { recapNumbers, seriesAfterGame, type RecapBatter, type RecapPitcher } from "../domain/product-daily";
import { LoadingSkeleton, SectionHeader, MetricLabel } from "./components";
import { TeamFavorite, type FavoriteActions } from "./team-favorite";
import { GameLinks } from "./npb-game-surface";
import { useHistoricalStatic } from "./use-mlb-historical";

const n = (v: number | null) => v ?? "—";
export function GameRecap({ league, batting, pitching, complete, scope = "", favorites = [] }: { league: League; batting: RecapBatter[]; pitching: RecapPitcher[]; complete: boolean; scope?: string; favorites?: FavoriteActions["favorites"] }) {
  const highlighted = recapNumbers(batting, pitching);
  const ids = new Set(favorites.filter(f => f.kind === "player" && f.league === league).map(f => f.entityId));
  const batters = [...new Map([...highlighted.batting.slice(0, 4), ...batting.filter(p => ids.has(p.playerId))].map(p => [p.playerId, p])).values()];
  const pitchers = [...new Map([...highlighted.pitching.slice(0, 3), ...pitching.filter(p => ids.has(p.playerId))].map(p => [p.playerId, p])).values()];
  return <section className="home-section game-recap"><SectionHeader title="この試合の主な数字" />{!complete && <p className="inline-note">一部データ確認中 · 保存済みの成績のみ</p>}
    <div className="daily-metric-help"><MetricLabel metric="PA" /><MetricLabel metric="IP" /><MetricLabel metric="RBI" /></div>
    {batters.length > 0 && <><h3>打撃</h3><div className="row-list">{batters.map(p => <Link className="daily-recap-row" key={`${p.playerId}:${p.teamId}`} to={`/${league}/players/${encodeURIComponent(p.playerId)}${scope}`}><strong>{ids.has(p.playerId) && "★ "}{p.name}</strong><span>PA {n(p.pa)} · 安打 {n(p.hits)} · 本塁打 {n(p.homeRuns)} · 打点 {n(p.rbi)}</span></Link>)}</div></>}
    {pitchers.length > 0 && <><h3>投球</h3><div className="row-list">{pitchers.map(p => <Link className="daily-recap-row" key={`${p.playerId}:${p.teamId}`} to={`/${league}/players/${encodeURIComponent(p.playerId)}${scope}`}><strong>{ids.has(p.playerId) && "★ "}{p.name}</strong><span>IP {p.outs === null ? "—" : `${Math.floor(p.outs / 3)}.${p.outs % 3}`} · 失点 {n(p.runs)} · 奪三振 {n(p.so)}</span></Link>)}</div></>}
    {!batters.length && !pitchers.length && <p className="inline-note">この条件で表示できる成績はありません。確認済みの項目はボックススコアへ。</p>}
    <details><summary>選出の根拠</summary><p>打撃は2安打以上または本塁打。投球は6回以上・失点1以下、または1回以上・失点0。お気に入り選手は条件によらず表示。打撃は本塁打・安打数、投球は投球回数の順に表示します。勝因・敗因の判定ではありません。</p></details>
  </section>;
}
export function GameTeamLinks({ league, teams, scope = "", ...actions }: FavoriteActions & { league: League; teams: { id: string; name: string }[]; scope?: string }) {
  return <div className="row-list match-team-links">{teams.map(t => <div className="surface-favorite" key={t.id}><Link className="player-row" to={`/${league}/teams/${encodeURIComponent(t.id)}${scope}`}><strong>{t.name}</strong><span>球団ページ →</span></Link><TeamFavorite league={league} teamId={t.id} name={t.name} {...actions} /></div>)}</div>;
}
export function NpbGamePreview({ game, services, favorites }: { game: NpbGameDetail; services: Services; favorites: FavoriteActions["favorites"] }) {
  const [value, setValue] = useState<{ id: string; season: NpbTeamSeason | null; seasonError: boolean; games: GameIndexRow[]; incomplete: boolean } | null>(null), [error, setError] = useState("");
  useEffect(() => { let active = true; void (async () => {
    const manifest = await services.gameSurface.manifest();
    const until = [shiftGameDate(game.date, -1), manifest.effectiveDate].sort()[0]!;
    let seasonError = false;
    const season = await services.product.teamSeason(Number(game.date.slice(0, 4))).catch(() => { seasonError = true; return null; });
    const windowFrom = shiftGameDate(game.date, -14), windowTo = shiftGameDate(game.date, -1);
    const from = [windowFrom, manifest.from].sort().at(-1)!;
    const dates: string[] = [], games: GameIndexRow[] = []; let incomplete = until < windowTo || manifest.from > windowFrom || manifest.to < windowTo;
    for (let d = from; d <= until && d <= manifest.to; d = shiftGameDate(d, 1)) dates.push(d);
    const results = await Promise.allSettled(dates.map(d => services.gameSurface.date(d)));
    results.forEach((result, index) => {
      if (result.status !== "fulfilled" || result.value.date !== dates[index]) { incomplete = true; return; }
      const page = result.value;
      incomplete ||= !["complete", "no_games"].includes(page.coverage);
      games.push(...page.games.filter(g => g.status === "final" && g.date < game.date));
    });
    return { id: game.gameId, season: season && season.effectiveDate <= until ? season : null, seasonError, games, incomplete };
  })().then(v => { if (active) setValue(v); }).catch(() => { if (active) setError(game.gameId); }); return () => { active = false; }; }, [game.gameId, game.date, services]);
  const data = value?.id === game.gameId ? value : null;
  const opponents = data?.games.filter(g => [g.home.id, g.away.id].includes(game.home.id) && [g.home.id, g.away.id].includes(game.away.id)).sort((a, b) => b.date.localeCompare(a.date) || b.gameNumber - a.gameNumber) ?? [];
  return <section className="home-section game-preview"><SectionHeader title="Game Preview" /><p className="inline-note">保存済みの試合前データ。予告先発・出場選手の予測は行いません。</p>
    {error === game.gameId ? <p>プレビューを読み込めません。球団ページから確認できます。</p> : !data ? <LoadingSkeleton /> : <>
      {data.season ? <><p className="inline-note">{data.season.effectiveDate}まで · {data.season.coverage.status === "complete" ? "確認済み" : "保存済み分"}</p><div className="preview-team-grid">{[game.away, game.home].map(t => { const s = data.season!.teams.find(v => v.teamId === t.id); return <div key={t.id}><Link to={`/NPB/teams/${encodeURIComponent(t.id)}`}>{t.shortName}</Link><strong>{s ? `${s.W}勝 ${s.L}敗 ${s.T}分` : "成績未確認"}</strong><small>得点 {s?.runsFor ?? "—"} / 失点 {s?.runsAgainst ?? "—"}</small></div>; })}</div></> : <p className="inline-note" role={data.seasonError ? "status" : undefined}>{data.seasonError ? "球団のシーズン成績を読み込めません。試合結果は読み込めた範囲を表示しています。" : "試合前時点のシーズン成績は未収録です。"}</p>}
      <h3>直近14日間の結果</h3>{data.incomplete && <p className="inline-note">一部データ確認中。未収録試合は含みません。</p>}<div className="preview-team-grid">{[game.away, game.home].map(t => { const rows = data.games.filter(g => [g.home.id, g.away.id].includes(t.id)); const scored = rows.filter(g => g.home.score !== null && g.away.score !== null); const wins = scored.filter(g => g.home.id === t.id ? g.home.score! > g.away.score! : g.away.score! > g.home.score!).length; return <div key={t.id}><span>{t.shortName}</span><strong>{wins}勝 / {scored.length}試合</strong>{rows.length !== scored.length && <small>スコア未確認あり</small>}</div>; })}</div>
      {opponents.length > 0 && <><h3>この期間の直接対戦</h3><GameLinks games={opponents.slice(0, 3)} /></>}
    </>}
    {favorites.some(f => f.kind === "player" && f.league === "NPB") && <Link className="text-link" to="/NPB/my">フォロー選手のRecent・推移 →</Link>}
    <div className="daily-links"><Link to={`/NPB/compare`}>選手を比較</Link><Link to="/NPB/postseason">Postseason利用状況</Link></div>
  </section>;
}
export function PostseasonGameContext({ season, gameId, names }: { season: number; gameId: string; names: (id: string) => string }) {
  const result = useHistoricalStatic<PostseasonHub>(`postseason/hub/${season}.json`);
  const series = result.value?.series.find(s => s.games.some(g => g.gameId === gameId));
  const standing = series && seriesAfterGame(series, gameId);
  if (result.status !== "ready" || !series || !standing) return <section className="home-section"><SectionHeader title="この試合終了時のSeries" />{result.status === "loading" ? <LoadingSkeleton /> : <p className="inline-note" role="status">{result.status === "error" ? "Series情報を読み込めません。" : result.status === "missing" ? "この年のSeries情報は未収録です。" : !series ? "この試合のSeriesは未確認です。" : "この試合時点のSeries勝敗は未確定です。"}</p>}</section>;
  const clinched = standing.find(t => t.total >= series.winsRequired);
  return <section className="home-section"><SectionHeader title="この試合終了時のSeries" action="Series詳細" to={`/MLB/postseason/series/${encodeURIComponent(series.id)}?season=${season}`} /><p>{standing.map(t => `${names(t.teamId)} ${t.played}勝${t.advantage ? ` + アドバンテージ ${t.advantage}勝（Series合計 ${t.total}勝）` : ""}`).join(" / ")}</p>{clinched && <p>{names(clinched.teamId)}がSeries決着</p>}</section>;
}
