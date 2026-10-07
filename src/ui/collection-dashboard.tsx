import { useContext, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { Services } from "../app/services";
import { readHistoricalProduct } from "../app/historical-products";
import type { Favorite, League } from "../domain/models";
import { readNpbExplorerSeason, readNpbRecentExplorer } from "../application/explorer-readers";
import { boundedComparisonRead } from "../application/product-comparison";
import { battingAggregate, pitchingAggregate, dateWindow } from "../domain/mlb-historical-aggregate";
import { comparisonValue, metricNumber, collectionSeasonCheckpoint, type ComparisonRow } from "../domain/product-comparison";
import type { CompareMetrics } from "../domain/player-compare";
import { LibraryContext } from "./personal-library-context";
import { DataState, LoadingSkeleton, MetricLabel, PageHeading } from "./components";
import type { ExplorerManifest, ExplorerProfile } from "./data-explorer";
import { NpbPlayerTrends, PlayerTrends } from "./player-trends";
import { useHistoricalStatic } from "./use-mlb-historical";
import type { HistoricalChronology } from "../domain/game-chronology";

function HistoricalCollectionTrend({ id, season, competition, complete }: { id: string; season: number; competition: string; complete: boolean }) {
  const prefix = competition === "postseason" ? "postseason/" : "", profile = useHistoricalStatic<ExplorerProfile>(`${prefix}players/${id.replaceAll(":", "_")}.json`), chronology = useHistoricalStatic<HistoricalChronology>(`${prefix}chronology/${season}.json`);
  if (profile.status === "loading" || chronology.status === "loading") return <LoadingSkeleton />;
  if (!profile.value || profile.value.player.id !== id || !chronology.value) return <DataState kind="source-unavailable" title="推移を取得できません" />;
  return <PlayerTrends scope={`${season} ${competition}の保存済み出場`} coverageComplete={complete} batting={profile.value.batting.filter(r => r.season === season).map(r => ({ ...r, gameNumber: chronology.value!.games.find(g => g.gameId === r.gameId)?.number ?? null, walks: r.bb, sacrificeFlies: r.sf }))} pitching={profile.value.pitching.filter(r => r.season === season).map(r => ({ ...r, gameNumber: chronology.value!.games.find(g => g.gameId === r.gameId)?.number ?? null, earnedRuns: r.er, strikeouts: r.so }))} />;
}
export function CollectionDashboard({ league, services, favorites }: { league: League; services: Services; favorites: Favorite[] }) {
  const ctx = useContext(LibraryContext), { collectionId } = useParams(), [params, setParams] = useSearchParams();
  const collection = ctx?.state?.collections.find(c => c.id === collectionId), activeLeague: League = params.get("league") === "MLB" ? "MLB" : params.get("league") === "NPB" ? "NPB" : league;
  const season = Number(params.get("season") ?? (activeLeague === "NPB" ? 2026 : 2025)), competition = params.get("competition") === "postseason" ? "postseason" : "regular", period = params.get("period") ?? "season", role = params.get("role") === "pitching" ? "pitching" : "batting";
  const players = collection?.players.filter(p => p.league === activeLeague) ?? [], page = Math.min(Math.max(0, Math.floor(Number(params.get("page"))) || 0), Math.max(0, Math.ceil(players.length / 12) - 1)), ids = players.slice(page * 12, (page + 1) * 12).map(p => p.playerId), idsKey = ids.join(",");
  const key = `${activeLeague}:${season}:${competition}:${period}:${role}:${idsKey}`, [state, setState] = useState<{ key: string; rows: ComparisonRow[] } | null>(null), [error, setError] = useState(""), [expanded, setExpanded] = useState(""), [selected, setSelected] = useState<string[]>([]);
  const supported = (activeLeague === "NPB" ? season === 2026 && competition === "regular" : season >= 2020 && season <= 2025 && Number.isInteger(season)) && ["season", "7", "14", "30"].includes(period);
  useEffect(() => {
    if (!supported || !idsKey) return; let active = true;
    const read = async (): Promise<ComparisonRow[]> => {
      const ids = idsKey.split(",");
      if (activeLeague === "NPB") {
        const directory = await services.directory.findLatestNpb();
        const p = period === "season" ? await readNpbExplorerSeason(season) : await readNpbRecentExplorer(Number(period) as 7 | 14 | 30, directory);
        if (p.effectiveDate !== directory.effectiveDate) throw Error("Collection generation mismatch");
        return ids.map(id => { const r = p.players.find(p => p.playerId === id); return { id, name: directory.players.find(p => p.playerId === id)?.displayName ?? id, season, date: p.effectiveDate, coverage: p.coverage.status, metrics: r?.[role]?.metrics ?? null }; });
      }
      const prefix = competition === "postseason" ? "postseason/" : "";
      const [manifest, directory] = await Promise.all([readHistoricalProduct<ExplorerManifest>(`${prefix}manifest.json`), readHistoricalProduct<{ players: { id: string; name: string }[] }>(`${prefix}players/index.json`)]);
      const s = manifest.seasons.find(s => s.season === season); if (!s) throw Error("Uncollected season");
      if (period === "season") {
        const p = await readHistoricalProduct<{ season: number; players: { playerId: string; batting: CompareMetrics | null; pitching: CompareMetrics | null }[] }>(`${prefix}seasons/${season}.json`);
        if (p.season !== season) throw Error("Season mismatch");
        return ids.map(id => ({ id, name: directory.players.find(p => p.id === id)?.name ?? id, season, date: s.lastDate, coverage: s.coverage, metrics: p.players.find(p => p.playerId === id)?.[role] ?? null }));
      }
      const result = await boundedComparisonRead(ids, id => readHistoricalProduct<ExplorerProfile>(`${prefix}players/${id.replaceAll(":", "_")}.json`));
      const window = dateWindow(s.lastDate, Number(period) as 7 | 14 | 30);
      return result.map((r, i) => { const id = ids[i]!, profile = r.status === "fulfilled" && r.value.player.id === id ? r.value : null, stats = profile ? role === "batting" ? battingAggregate(id, profile.batting.filter(f => f.season === season), window.from, window.to) : pitchingAggregate(id, profile.pitching.filter(f => f.season === season), window.from, window.to) : null; return { id, name: directory.players.find(p => p.id === id)?.name ?? id, season, date: s.lastDate, coverage: profile ? s.coverage : "unavailable", metrics: stats?.factCount ? stats.metrics : null, ...(!profile ? { notice: "取得できません" } : {}) }; });
    };
    void read().then(rows => { if (active) { setState({ key, rows }); setError(""); } }).catch(() => { if (active) setError(key); }); return () => { active = false; };
  }, [key, idsKey, activeLeague, season, competition, period, role, services, supported]);
  const update = (k: string, v: string) => setParams(p => { const next = new URLSearchParams(p); next.set(k, v); if (k !== "page") next.delete("page"); if (k === "league") { next.set("season", v === "NPB" ? "2026" : "2025"); next.delete("competition"); } return next; });
  if (ctx?.error) return <DataState kind="source-unavailable" title={ctx.error} />;
  if (!ctx?.state) return <LoadingSkeleton />;
  if (!collection) return <DataState kind="no-data" title="この端末にコレクションがありません" action="保存・整理へ" to={`/${league}/library`} />;
  const rows = state?.key === key ? state.rows : [], keys = role === "batting" ? ["PA", "HR", "OPS"] : ["outsRecorded", "SO", "ERA"], suffix = `?season=${season}${competition === "postseason" ? "&competition=postseason" : ""}`, compareIds = selected.filter(id => players.some(p => p.playerId === id)).slice(0, 4);
  const comparePeriod = period === "season" ? "" : activeLeague === "NPB" ? `&condition=${period}d` : `&condition=total&period=${period}d`;
  return <div className="screen"><Link className="back-link" to={`/${league}/library`}>← Collections</Link><PageHeading eyebrow="My / Watch Dashboard" title={collection.name} /><p className="inline-note">この端末の選手グループ。集計対象を分けて確認します。</p><div className="explorer-filter-grid"><label>League<select value={activeLeague} onChange={e => update("league", e.target.value)}><option>NPB</option><option>MLB</option></select></label><label>Season<select value={season} onChange={e => update("season", e.target.value)}>{(activeLeague === "NPB" ? [2026] : [2020,2021,2022,2023,2024,2025]).map(y => <option key={y}>{y}</option>)}</select></label>{activeLeague === "MLB" && <label>集計対象<select value={competition} onChange={e => update("competition", e.target.value)}><option value="regular">Regular Season</option><option value="postseason">Postseason</option></select></label>}<label>期間<select value={period} onChange={e => update("period", e.target.value)}>{["season", "7", "14", "30"].map(p => <option key={p} value={p}>{p === "season" ? "Season" : `直近${p}日`}</option>)}</select></label><label>成績<select value={role} onChange={e => update("role", e.target.value)}><option value="batting">打撃</option><option value="pitching">投球</option></select></label></div>
    <p className="inline-note">{players.length}人 · 12人ずつ表示。Recentは選択範囲の最終保存日が基準です。</p>{!supported ? <DataState kind="unsupported" title="指定の年度・集計対象は未収録です" /> : !ids.length ? <DataState kind="no-data" title="このLeagueの選手は登録されていません" /> : error === key ? <DataState kind="source-unavailable" title="Dashboardを取得できません。保存した選手は維持しています" /> : state?.key !== key ? <LoadingSkeleton /> : <div className="row-list">{rows.map(r => <article className="collection-watch-row" key={r.id}><div className="list-heading"><label className="compare-pick"><input type="checkbox" aria-label={`${r.name}を比較候補に選ぶ`} checked={compareIds.includes(r.id)} disabled={!compareIds.includes(r.id) && compareIds.length >= 4} onChange={() => setSelected(compareIds.includes(r.id) ? compareIds.filter(id => id !== r.id) : [...compareIds, r.id])} /></label><Link to={`/${activeLeague}/players/${encodeURIComponent(r.id)}${suffix}`}><strong>{favorites.some(f => f.league === activeLeague && f.kind === "player" && f.entityId === r.id) && "★ "}{r.name}</strong></Link></div><p className="inline-note">{r.date}まで · {r.coverage === "complete" ? "収録済み" : "一部未確認"}{r.notice && ` · ${r.notice}`}</p>{r.metrics ? <dl className="explorer-values">{keys.map(k => <div key={k}><dt><MetricLabel metric={k} label={k === "outsRecorded" ? "IP" : k} /></dt><dd>{comparisonValue(k, metricNumber(r.metrics, k))}{r.metrics?.[k]?.status === "partial" && <small> 一部</small>}</dd></div>)}</dl> : <p>この年度・期間・成績の保存済み記録なし</p>}{activeLeague === "NPB" && period === "season" && collectionSeasonCheckpoint(r.metrics, role) && <p className="inline-note">保存済みSeasonの節目：{collectionSeasonCheckpoint(r.metrics, role)}（公式達成・通算ではありません）</p>}<nav className="explorer-links"><Link to={`/${activeLeague}/players/${encodeURIComponent(r.id)}/trends${suffix}`}>推移・連続記録</Link><Link to={`/${activeLeague}/players/${encodeURIComponent(r.id)}/analysis${suffix}`}>Analysis</Link><Link to={`/${activeLeague}/season-compare?kind=player&entity=${encodeURIComponent(r.id)}&role=${role}${competition === "postseason" ? "&competition=postseason" : ""}`}>年度比較</Link>{activeLeague === "NPB" && <Link to={`/NPB/milestones?q=${encodeURIComponent(r.name)}`}>シーズンの節目</Link>}</nav><button onClick={() => setExpanded(expanded === r.id ? "" : r.id)}>{expanded === r.id ? "推移を閉じる" : "推移をここで見る"}</button>{expanded === r.id && (activeLeague === "NPB" ? <NpbPlayerTrends services={services} playerId={r.id} /> : <HistoricalCollectionTrend id={r.id} season={season} competition={competition} complete={r.coverage === "complete"} />)}</article>)}</div>}
    {compareIds.length >= 2 && <Link className="button" to={`/${activeLeague}/compare${suffix}&players=${compareIds.map(encodeURIComponent).join("%2C")}&role=${role}${comparePeriod}`}>{compareIds.length}人を比較 →</Link>}<nav className="library-pagination" aria-label="Collectionのページ"><button disabled={page <= 0} onClick={() => update("page", String(page - 1))}>前へ</button><span>{page + 1}/{Math.max(1, Math.ceil(players.length / 12))}</span><button disabled={(page + 1) * 12 >= players.length} onClick={() => update("page", String(page + 1))}>次へ</button></nav>
  </div>;
}
