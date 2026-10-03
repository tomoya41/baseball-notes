import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { Services } from "../app/services";
import type { Favorite } from "../domain/models";
import type { GameIndexRow } from "../domain/npb-game-index";
import { shiftGameDate } from "../domain/npb-game-index";
import type { NpbLatestStandings } from "../domain/standings";
import type { NpbCatalog } from "../domain/npb-product-contract";
import type { HistoricalTeamHub } from "../domain/team-hub";
import type { PostseasonHub } from "../domain/competition";
import type { CompareMetrics } from "../domain/player-compare";
import type { HistoricalProductManifest } from "./player-compare";
import { useHistoricalStatic } from "./use-mlb-historical";
import { useHistoricalCompetition } from "./historical-competition-context";
import { DataState, LoadingSkeleton, MetricLabel, PageHeading, SectionHeader } from "./components";
import { Monogram, ScoreboardRow } from "./design-system";
import { hasHistoricalPostseason, usePostseasonAvailability } from "./postseason-availability";

export function TeamMetrics({ batting, pitching }: { batting: CompareMetrics; pitching: CompareMetrics }) {
  return <section className="stats-section"><h2>チームの主要成績</h2>{([["打撃", batting, ["PA", "H", "HR", "AVG", "OPS"]], ["投球", pitching, ["outsRecorded", "SO", "R", "ERA", "K9"]]] as const).map(([title, metrics, keys]) => <div key={title}><h3 className="stat-role-label">{title}</h3><div className="metric-grid">{keys.map(k => { const m = metrics[k]; return <div className="metric-tile" key={k}><MetricLabel metric={k} label={k === "outsRecorded" ? "IP" : k === "K9" ? "K/9" : k} /><strong className="metric-tile__value">{m?.value == null ? "—" : k === "outsRecorded" ? `${Math.floor(m.value / 3)}.${m.value % 3}` : m.value.toFixed(["AVG", "OPS"].includes(k) ? 3 : ["ERA", "K9"].includes(k) ? 2 : 0)}</strong>{m?.status === "partial" && <small>一部</small>}</div>; })}</div></div>)}</section>;
}
export function NpbTeams({ services }: { services: Services }) {
  const [catalog, setCatalog] = useState<NpbCatalog | null>(null), [error, setError] = useState(false);
  useEffect(() => { let active = true; void services.product.catalog().then(p => { if (active) setCatalog(p); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [services]);
  return <div className="screen"><PageHeading eyebrow="NPB" title="球団" />{error ? <DataState kind="source-unavailable" title="球団一覧を読み込めません" /> : !catalog ? <LoadingSkeleton /> : <div className="row-list">{catalog.teams.map(t => <Link className="player-row" key={t.teamId} to={`/NPB/teams/${encodeURIComponent(t.teamId)}`}><Monogram name={t.abbreviation} /><span className="player-row__body"><strong>{t.name}</strong><small>{t.division === "Central" ? "セ・リーグ" : "パ・リーグ"}</small></span><span>→</span></Link>)}</div>}</div>;
}
export function NpbTeamActivity({ services, teamId }: { services: Services; teamId: string }) {
  const [state, setState] = useState<{ key: string; games: GameIndexRow[]; from: string; to: string; incomplete: boolean } | null>(null), [errorKey, setError] = useState("");
  const [standings, setStandings] = useState<NpbLatestStandings | null>(null);
  useEffect(() => { let active = true; void services.standings.findLatestNpb().then(s => { if (active) setStandings(s); }).catch(() => {}); return () => { active = false; }; }, [services]);
  useEffect(() => { let active = true; void services.gameSurface.manifest().then(async m => {
    const from = shiftGameDate(m.to, -13) > m.from ? shiftGameDate(m.to, -13) : m.from;
    const dates: string[] = []; for (let d = from; d <= m.to; d = shiftGameDate(d, 1)) dates.push(d);
    // Public date indexes only, not Game/player details. Bounded 14 requests, independent of roster size.
    const pages = []; for (const date of dates) pages.push(await services.gameSurface.date(date));
    if (active) { setError(""); setState({ key: teamId, from, to: m.to, incomplete: pages.some(p => !["complete", "no_games"].includes(p.coverage)), games: pages.flatMap(p => p.games).filter(g => [g.home.id, g.away.id].includes(teamId)).sort((a, b) => b.date.localeCompare(a.date) || b.gameNumber - a.gameNumber || a.gameId.localeCompare(b.gameId)) }); }
  }).catch(() => { if (active) setError(teamId); }); return () => { active = false; }; }, [services, teamId]);
  const rank = standings?.standings.find(r => r.teamId === teamId), visible = state?.key === teamId ? state : null;
  return <>{rank && <section className="stats-section"><SectionHeader title="順位" to="/NPB/home" action="順位表" /><p className="team-standing"><strong>{rank.rank}<small>位</small></strong><span>{rank.wins}勝 {rank.losses}敗 {rank.ties}分<br />{standings!.throughDate}終了時点</span></p></section>}
    <section className="home-section"><SectionHeader title="最近の試合" action="日程・結果" to="/NPB/schedule" />{errorKey === teamId ? <DataState kind="source-unavailable" title="最近の試合を読み込めません" /> : !visible ? <LoadingSkeleton /> : <><p className="inline-note">{visible.from}〜{visible.to}{visible.incomplete && " · 一部データ確認中"}</p>{visible.games.length ? <div className="scoreboard-list">{visible.games.map(g => <ScoreboardRow key={g.gameId} to={`/NPB/games/${encodeURIComponent(g.gameId)}`} away={g.away.name} home={g.home.name} awayScore={g.away.score} homeScore={g.home.score} date={g.date.slice(5)} status={g.status === "final" ? "終了" : g.status === "scheduled" ? "予定" : g.status === "postponed" ? "延期" : "状態確認中"} gameNumber={g.gameNumber} partial={g.completeness !== "complete"} />)}</div> : <p className="inline-note">この期間の保存済み試合はありません。</p>}</>}</section>
    <Link className="text-link" to="/NPB/postseason">Postseasonの利用状況 →</Link></>;
}
export function MlbTeams({ manifest }: { manifest: HistoricalProductManifest }) {
  const competition = useHistoricalCompetition(), [params] = useSearchParams();
  const season = params.get("season") ?? String(manifest.seasons.at(-1)!.season);
  return <div className="screen"><PageHeading eyebrow={`MLB · ${season} · ${competition === "postseason" ? "POSTSEASON" : "HISTORICAL"}`} title="球団" /><div className="row-list">{manifest.teams.map(t => <Link className="player-row" key={t.id} to={`/MLB/teams/${encodeURIComponent(t.id)}?season=${encodeURIComponent(season)}${competition === "postseason" ? "&competition=postseason" : ""}`}><Monogram name={t.name} /><strong>{t.name}</strong><span>→</span></Link>)}</div></div>;
}
export function MlbTeamHub({ manifest, favorites }: { manifest: HistoricalProductManifest; favorites: Favorite[] }) {
  const competition = useHistoricalCompetition(), availability = usePostseasonAvailability();
  const { teamId } = useParams(), [params, setParams] = useSearchParams();
  const selected = params.has("season") ? Number(params.get("season")) : manifest.seasons.at(-1)!.season;
  const knownSeason = manifest.seasons.some(s => s.season === selected);
  const team = manifest.teams.find(t => t.id === teamId);
  const result = useHistoricalStatic<HistoricalTeamHub>(team && knownSeason ? `teams/${selected}/${team.id.replaceAll(":", "_")}.json` : null);
  const postseason = useHistoricalStatic<PostseasonHub>(team && knownSeason && hasHistoricalPostseason(availability) ? `postseason/hub/${selected}.json` : null);
  const [mode, setMode] = useState<"batting" | "pitching">("batting"), [onlyFavorites, setOnlyFavorites] = useState(false);
  if (!team) return <DataState kind="no-data" title="球団が見つかりません" />;
  const scope = `?season=${selected}${competition === "postseason" ? "&competition=postseason" : ""}`;
  const hub = result.value;
  const favoritesSet = new Set(favorites.filter(f => f.league === "MLB" && f.kind === "player").map(f => f.entityId));
  const names = (id: string) => manifest.teams.find(t => t.id === id)?.name ?? "球団不明";
  const roster = (hub?.players ?? []).filter(p => p[mode] && (!onlyFavorites || favoritesSet.has(p.playerId))).sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return <div className="screen team-hub"><Link className="back-link" to={`/MLB/teams?season=${selected}${competition === "postseason" ? "&competition=postseason" : ""}`}>← 球団一覧</Link><header className="profile-header"><Monogram name={team.name} large /><div><p className="eyebrow">MLB · {competition === "postseason" ? "POSTSEASON" : "REGULAR SEASON"}</p><h1>{team.name}</h1></div></header>
    <div className="mlb-controls"><label>シーズン<select value={selected} onChange={e => { const next = new URLSearchParams(params); next.set("season", e.target.value); setParams(next); }}>{!knownSeason && <option value={selected}>{selected} 未収録</option>}{manifest.seasons.map(s => <option key={s.season}>{s.season}</option>)}</select></label></div>
    {!knownSeason ? <DataState kind="unsupported" title={selected === 2026 ? "2026年の試合結果・選手成績は未対応" : "このシーズンは未収録です"} /> : result.status !== "ready" || !hub ? result.status === "loading" ? <LoadingSkeleton /> : <DataState kind="source-unavailable" title="球団成績を読み込めません" /> : <>
    <section className="stats-section"><h2>{selected} {competition === "postseason" ? "Postseason" : "シーズン"}</h2><p className="inline-note">{hub.effectiveDate}まで · {hub.coverage === "complete" ? "収録済み全試合" : "一部データ確認中"}</p><div className="metric-grid">{[["試合", hub.G], ["勝", hub.W], ["敗", hub.L], ["得点", hub.runsFor], ["失点", hub.runsAgainst]].map(([k, v]) => <div className="metric-tile" key={k}><span>{k}</span><strong className="metric-tile__value">{v}</strong></div>)}</div></section>
    <TeamMetrics batting={hub.batting} pitching={hub.pitching} />
    <section className="home-section"><SectionHeader title="最近の試合" action="日程・結果" to={`/MLB/schedule${scope}&date=${hub.effectiveDate}`} /><div className="scoreboard-list">{hub.games.map(g => <ScoreboardRow key={g.gameId} to={`/MLB/games/${encodeURIComponent(g.gameId)}${scope}`} away={names(g.awayTeamId)} home={names(g.homeTeamId)} awayScore={g.awayRuns} homeScore={g.homeRuns} date={g.date.slice(5)} status="終了" gameNumber={g.number} partial={!g.complete} />)}</div>{!hub.games.length && <p className="inline-note">このスコープの出場試合はありません。</p>}</section>
    <section className="stats-section"><SectionHeader title="出場選手" action="選手比較" to={`/MLB/compare${scope}`} /><p className="inline-note">この球団での{selected}年の成績。現在の所属ではありません。移籍前後は球団ごとに分離。</p><div className="segmented">{(["batting", "pitching"] as const).map(m => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "batting" ? "打撃" : "投球"}</button>)}</div><label className="team-favorites-filter"><input type="checkbox" checked={onlyFavorites} onChange={e => setOnlyFavorites(e.target.checked)} />お気に入りだけ</label>
    <div className="mlb-stat-scroll" tabIndex={0} role="region" aria-label="球団別選手成績"><table><thead><tr><th>選手</th>{(mode === "batting" ? ["PA", "H", "HR", "OPS"] : ["outsRecorded", "SO", "ERA"]).map(k => <th key={k}><MetricLabel metric={k} label={k === "outsRecorded" ? "IP" : k} /></th>)}</tr></thead><tbody>{roster.map(p => <tr key={p.playerId}><th scope="row"><Link to={`/MLB/players/${encodeURIComponent(p.playerId)}${scope}`}>{favoritesSet.has(p.playerId) && "★ "}{p.name}</Link></th>{(mode === "batting" ? ["PA", "H", "HR", "OPS"] : ["outsRecorded", "SO", "ERA"]).map(k => { const n = p[mode]?.[k]?.value; return <td key={k}>{n == null ? "—" : k === "outsRecorded" ? `${Math.floor(n / 3)}.${n % 3}` : n.toFixed(k === "OPS" ? 3 : k === "ERA" ? 2 : 0)}</td>; })}</tr>)}</tbody></table></div>{!roster.length && <p className="inline-note">対象の選手はありません。</p>}</section>
    </>}
    {postseason.status === "ready" && postseason.value!.series.some(s => s.teams.some(t => t.teamId === team.id)) && <section className="stats-section"><SectionHeader title={`${selected} Postseason`} action="全体を見る" to={`/MLB/postseason?season=${selected}`} /><div className="row-list">{postseason.value!.series.filter(s => s.teams.some(t => t.teamId === team.id)).map(s => <Link className="player-row" key={s.id} to={`/MLB/postseason/series/${encodeURIComponent(s.id)}?season=${selected}`}><strong>{s.name}</strong><span>→</span></Link>)}</div></section>}
    <p className="inline-note"><Link to="/MLB/sources">データ提供元・クレジット</Link></p>
  </div>;
}
