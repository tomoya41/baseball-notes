import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Services } from "../app/services";
import { readHistoricalProduct } from "../app/historical-products";
import { readNpbExplorerSeason } from "../application/explorer-readers";
import { boundedExplorerRead, cachedExplorerRead, explorerInputErrors, exploreRows, explorerMetrics, explorerQuery, readableMetric, selectedRecentPlayers, MAX_RECENT_PLAYERS } from "../domain/data-explorer";
import type { ExplorerRow, ExplorerValues } from "../domain/data-explorer";
import type { NpbSeasonPayload } from "../application/npb-season-payload";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";
import type { HistoricalDirectoryPlayer } from "../domain/historical-directory";
import type { HistoricalTeamHub } from "../domain/team-hub";
import type { DatedBatter, DatedPitcher } from "../domain/mlb-historical-aggregate";
import { battingAggregate, pitchingAggregate, dateWindow } from "../domain/mlb-historical-aggregate";
import { matchesMlbPlayerName } from "../domain/mlb-japanese-display";
import { DataState, LoadingSkeleton, MetricLabel, PageHeading } from "./components";
import { useHistoricalStatic } from "./use-mlb-historical";
import { useHistoricalCompetition } from "./historical-competition-context";

export type ExplorerManifest = { seasons: { season: number; firstDate: string; lastDate: string; coverage: string }[]; teams: { id: string; name: string }[] };
export type ExplorerProfile = { player: { id: string; name: string; seasons: number[] }; seasonTotals: Record<string, { batting: ExplorerValues | null; pitching: ExplorerValues | null }>; batting: DatedBatter[]; pitching: DatedPitcher[] };
type SeasonProjection = { season: number; firstDate: string; lastDate: string; coverage: string; players: { playerId: string; batting: ExplorerValues | null; pitching: ExplorerValues | null }[] };
type RecentRow = ExplorerRow & { coverage: string };
function formatValue(key: string, value: number | null) {
  if (value === null) return "—";
  if (key === "outsRecorded") return `${Math.floor(value / 3)}.${value % 3}`;
  return ["AVG", "OBP", "SLG", "OPS"].includes(key) ? value.toFixed(3) : ["ERA", "K9"].includes(key) ? value.toFixed(2) : String(value);
}
export function ExplorerLinks({ league, scope = "" }: { league: "NPB" | "MLB"; scope?: string }) {
  const context = new URLSearchParams(scope.replace(/^\?/, ""));
  if (context.get("season") === "all") context.delete("season");
  context.delete("kind"); context.delete("date");
  if (context.get("role") === "pitcher") context.set("role", "pitching");
  if (context.get("role") === "batter") context.set("role", "batting");
  const search = new URLSearchParams(context);
  if (league === "NPB" && context.get("role")) search.set("role", context.get("role") === "pitching" ? "pitcher" : "batter");
  return <nav className="explorer-links" aria-label="データを探す"><Link to={`/${league}/search?${search}`}>検索</Link><Link to={`/${league}/data?${context}`}>データ探索</Link><Link to={`/${league}/history?${context}`}>シーズン履歴</Link><Link to={`/${league}/glossary`}>指標ガイド</Link></nav>;
}
export function DataExplorerView({ league, rows, teams, season, years, effectiveDate, coverage, readRecent, scope = "" }: {
  league: "NPB" | "MLB"; rows: ExplorerRow[]; teams: { id: string; name: string }[]; season: number; years: number[]; effectiveDate: string; coverage: string;
  readRecent: (ids: string[], days: 7 | 14 | 30) => Promise<{ values: RecentRow[]; failed: string[] }>; scope?: string;
}) {
  const [params, setParams] = useSearchParams(), query = explorerQuery(params);
  const daysRaw = params.get("period"), days = daysRaw === "7" || daysRaw === "14" || daysRaw === "30" ? Number(daysRaw) as 7 | 14 | 30 : null;
  const idsKey = selectedRecentPlayers(params, new Set(rows.map(r => r.playerId))).join(","), ids = idsKey ? idsKey.split(",") : [], key = `${season}:${scope}:${effectiveDate}:${days}:${idsKey}`;
  const [recent, setRecent] = useState<{ key: string; values: RecentRow[]; failed: string[] } | null>(null);
  const [errorKey, setErrorKey] = useState("");
  const [attempt, setAttempt] = useState(0);
  const update = (name: string, value: string) => setParams(previous => {
    const next = new URLSearchParams(previous); if (value) next.set(name, value); else next.delete(name);
    if (["season", "team", "role"].includes(name)) { next.delete("recentPlayers"); next.delete("compare"); }
    if (name === "role") for (const i of [1, 2]) for (const field of ["metric", "op", "value", "sort", "dir"]) next.delete(`${field}${i}`);
    if (!["page", "compare"].includes(name)) next.delete("page");
    return next;
  });
  useEffect(() => {
    if (!days || !idsKey) return;
    let active = true;
    void readRecent(idsKey.split(","), days).then(result => { if (active) { setErrorKey(""); setRecent({ key, ...result }); } }).catch(() => { if (active) setErrorKey(key); });
    return () => { active = false; };
  }, [key, idsKey, days, readRecent, attempt]);
  const source = days ? recent?.key === key ? recent.values : [] : rows;
  const matched = league === "MLB" ? source.filter(r => matchesMlbPlayerName(r.playerId, r.name, query.name)) : source;
  const inputErrors = explorerInputErrors(params);
  const visible = inputErrors.length ? [] : exploreRows(matched, { ...query, name: league === "MLB" ? "" : query.name });
  const pageSize = 40, pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const requestedPage = Number(params.get("page") ?? 0), page = Number.isInteger(requestedPage) && requestedPage >= 0 ? Math.min(requestedPage, pages - 1) : 0;
  const candidates = exploreRows(league === "MLB" ? rows.filter(r => matchesMlbPlayerName(r.playerId, r.name, query.name)) : rows, { ...query, minimum: 0, rules: [], sorts: [] });
  const compare = [...new Set((params.get("compare") ?? "").split(",").filter(id => rows.some(r => r.playerId === id)))].slice(0, 4);
  const toggleId = (name: "recentPlayers" | "compare", id: string) => { const selected = name === "compare" ? compare : ids, maximum = name === "compare" ? 4 : MAX_RECENT_PLAYERS; update(name, (selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id].slice(0, maximum)).join(",")); };
  const keys = explorerMetrics[query.role].filter(k => rows.some(r => readableMetric(r[query.role]?.[k]) !== null)), displayKeys = [params.get("sort1") || (query.role === "batting" ? "OPS" : "ERA"), params.get("sort2") || (query.role === "batting" ? "HR" : "SO")].filter(k => (keys as readonly string[]).includes(k));
  const sampleKey = query.role === "batting" ? "PA" : "outsRecorded";
  const linkScope = `?season=${season}${scope}`;
  return <div className="screen data-explorer"><PageHeading eyebrow={`${league} · ${season} · ${scope ? "POSTSEASON" : "REGULAR SEASON"}`} title="データ探索" /><ExplorerLinks league={league} scope={linkScope} />
    <p className="inline-note">保存済みデータの条件検索です。公式ランキング・HOTではありません。{effectiveDate}まで · Coverage {coverage === "complete" ? "確認済み" : "一部未確認"}。</p>
    <div className="explorer-filter-grid"><label>シーズン<select value={season} onChange={e => update("season", e.target.value)}>{years.map(year => <option key={year}>{year}</option>)}</select></label><label>成績<select value={query.role} onChange={e => update("role", e.target.value)}><option value="batting">打撃</option><option value="pitching">投球</option></select></label><label>球団<select value={query.teamId} onChange={e => update("team", e.target.value)}><option value="">すべて</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>期間<select value={days ?? "season"} onChange={e => update("period", e.target.value)}><option value="season">シーズン</option>{[7, 14, 30].map(d => <option key={d} value={d}>直近{d}日・選択選手</option>)}</select></label></div>
    <label className="search-field"><span className="sr-only">選手名</span><input type="search" value={query.name} placeholder="選手名・既存表記で検索" onChange={e => update("q", e.target.value)} /></label>
    <details className="explorer-filters"><summary>条件・並べ替え</summary><label>最低サンプル（{query.role === "batting" ? "打席" : "アウト数"}）<input type="number" min="0" value={params.get("minimum") ?? "0"} onChange={e => update("minimum", e.target.value)} /></label><p className="inline-note">探索用の任意条件です。公式規定到達の判定ではありません。率はサンプル数と合わせて確認してください。</p>
      {[1, 2].map(i => <div className="explorer-filter-grid" key={i}><label>条件{i}の指標<select value={params.get(`metric${i}`) ?? ""} onChange={e => update(`metric${i}`, e.target.value)}><option value="">指定なし</option>{keys.map(k => <option key={k}>{k}</option>)}</select></label><label>条件{i}の方向<select value={params.get(`op${i}`) ?? "gte"} onChange={e => update(`op${i}`, e.target.value)}><option value="gte">以上</option><option value="lte">以下</option></select></label><label>条件{i}の値<input type="number" min="0" step="any" value={params.get(`value${i}`) ?? ""} onChange={e => update(`value${i}`, e.target.value)} /></label><label>並べ替え{i}<select value={params.get(`sort${i}`) ?? ""} onChange={e => update(`sort${i}`, e.target.value)}><option value="">名前順</option>{keys.map(k => <option key={k}>{k}</option>)}</select></label><label>並べ替え{i}の方向<select value={params.get(`dir${i}`) ?? "desc"} onChange={e => update(`dir${i}`, e.target.value)}><option value="desc">大きい順</option><option value="asc">小さい順</option></select></label></div>)}
    </details>
    {days && <details className="explorer-filters" open><summary>直近を調べる選手 {ids.length}/{MAX_RECENT_PLAYERS}</summary><p className="inline-note">{effectiveDate}を基準に同じ期間で比較。球団・名前で候補を絞り、最大12選手を選択します。全選手の順位ではありません。</p><div className="explorer-candidates">{candidates.slice(0, 40).map(row => <label key={row.playerId}><input type="checkbox" checked={ids.includes(row.playerId)} disabled={!ids.includes(row.playerId) && ids.length >= MAX_RECENT_PLAYERS} onChange={() => toggleId("recentPlayers", row.playerId)} />{row.name}</label>)}</div>{candidates.length > 40 && <p>候補を40人まで表示。球団・名前で絞り込んでください。</p>}</details>}
    {days && ids.length > 0 && recent?.key !== key && errorKey !== key && <LoadingSkeleton />}
    {days && (errorKey === key || (recent?.key === key && recent.failed.length > 0)) && <><DataState kind="source-unavailable" title="一部の選択選手を読み込めません" detail="取得できた選手だけを表示しています。未取得を0として扱いません。" /><button className="text-button" onClick={() => setAttempt(v => v + 1)}>未取得を再読み込み</button></>}
    {days && recent?.key === key && recent.values.some(r => r.coverage !== "complete") && <DataState kind="small-sample" title="この期間のCoverageは一部未確認です" />}
    <div className="list-heading"><strong>検索結果 {visible.length}人</strong><span>{page + 1}/{pages}ページ</span></div>
    {inputErrors.map(error => <p className="data-notice" role="status" key={error}>{error}</p>)}
    {query.teamId && compare.length > 0 && <p className="inline-note">比較へは選手・年度・期間を引き継ぎます。球団の絞り込みは引き継がず、選手の全所属分を比較します。</p>}
    {compare.length > 0 && <Link className="button button--secondary" to={`/${league}/compare?players=${compare.map(encodeURIComponent).join("%2C")}&season=${season}&role=${query.role}${days ? league === "NPB" ? `&condition=${days}d` : `&condition=total&period=${days}d` : ""}${scope}`}>{compare.length}人を比較へ {compare.length < 2 ? "（もう1人追加）" : "→"}</Link>}
    {!visible.length && (!days || recent?.key === key || !ids.length) && <DataState kind="no-data" title={days && !ids.length ? "直近を調べる選手を選択してください" : "条件に合う保存済みデータがありません"} />}
    <div className="row-list">{visible.slice(page * pageSize, (page + 1) * pageSize).map(row => <article className="explorer-result" key={row.playerId}>
      <div className="explorer-result-title"><Link to={`/${league}/players/${encodeURIComponent(row.playerId)}${linkScope}`}><strong>{row.name}</strong></Link>
        <button aria-label={`${row.name}を比較${compare.includes(row.playerId) ? "から外す" : "に追加"}`} aria-pressed={compare.includes(row.playerId)} disabled={!compare.includes(row.playerId) && compare.length >= 4} onClick={() => toggleId("compare", row.playerId)}>比較</button></div>
      <dl className="explorer-values">{[...new Set([sampleKey, ...displayKeys])].map(k => <div key={k}>
        <dt><MetricLabel metric={k} label={k === "outsRecorded" ? "IP" : k === "K9" ? "K/9" : k} /></dt>
        <dd>{formatValue(k, readableMetric(row[query.role]?.[k]))}{row[query.role]?.[k]?.status === "partial" && <small> 一部</small>}</dd>
      </div>)}</dl>
    </article>)}</div>
    {pages > 1 && <nav className="explorer-pagination" aria-label="探索結果のページ"><button disabled={page === 0} onClick={() => update("page", String(page - 1))}>前へ</button><span>{page + 1}/{pages}</span><button disabled={page + 1 >= pages} onClick={() => update("page", String(page + 1))}>次へ</button></nav>}
  </div>;
}

export function NpbDataExplorer({ services }: { services: Services }) {
  const [params] = useSearchParams(), year = Number(params.get("season") ?? 2026);
  const supported = year === 2026 && params.get("competition") !== "postseason";
  const [data, setData] = useState<{ season: NpbSeasonPayload; directory: NpbPlayerDirectory } | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => { if (!supported) return; let active = true; void Promise.all([readNpbExplorerSeason(2026), services.directory.findLatestNpb()]).then(([season, directory]) => { if (season.effectiveDate !== directory.effectiveDate) throw Error("Projection dates differ"); if (active) setData({ season, directory }); }).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, [services, supported]);
  const rows = useMemo<ExplorerRow[]>(() => data?.season.players.map(p => ({ playerId: p.playerId, name: p.displayName, teamId: p.teamId, batting: p.batting?.metrics ?? null, pitching: p.pitching?.metrics ?? null })) ?? [], [data]);
  const readOne = useMemo(() => cachedExplorerRead(async (id: string, days: 7 | 14 | 30): Promise<RecentRow> => {
    const value = await services.recent.find(id, `${days}d`);
    if (!value || value.player.id !== id || value.asOfDate !== data?.season.effectiveDate || value.period !== `${days}d`) throw Error("Recent scope/date unavailable");
    const window = dateWindow(value.asOfDate, days);
    if ([value.batting, value.pitching].some(p => p && (p.playerId !== id || p.from !== window.from || p.to !== window.to))) throw Error("Recent window mismatch");
    return { playerId: id, name: value.player.name, teamId: value.player.teamId, batting: value.batting?.metrics ?? null, pitching: value.pitching?.metrics ?? null,
      coverage: [value.batting, value.pitching].filter(Boolean).every(p => p!.coverage.status === "complete") ? "complete" : "partial" };
  }), [services, data]);
  const readRecent = useCallback((ids: string[], days: 7 | 14 | 30) => boundedExplorerRead(ids, id => readOne(id, days)), [readOne]);
  if (!supported) return <DataState kind="unsupported" title="指定したNPBシーズン・Postseasonの成績は未収録です" />;
  if (failed) return <DataState kind="source-unavailable" title="整合した保存済みSeasonを取得できません" />;
  if (!data) return <LoadingSkeleton />;
  if (params.get("team") && !data.directory.teams.some(t => t.id === params.get("team"))) return <DataState kind="unsupported" title="指定した球団は未収録です" />;
  if (data.season.players.some(p => !data.directory.players.some(d => d.playerId === p.playerId && d.displayName === p.displayName && d.teamId === p.teamId))) return <DataState kind="source-unavailable" title="Season・選手一覧の整合を確認できません" />;
  return <><p className="screen inline-note">球団は選手の最新保存所属で絞り込みます。成績には移籍前の出場分も含みます。</p><DataExplorerView league="NPB" rows={rows} teams={data.directory.teams} season={2026} years={[2026]} effectiveDate={data.season.effectiveDate} coverage={data.season.coverage.status} readRecent={readRecent} /></>;
}
export function MlbDataExplorer({ manifest }: { manifest: ExplorerManifest }) {
  const [params] = useSearchParams(), competition = useHistoricalCompetition(), year = Number(params.get("season") ?? manifest.seasons.at(-1)!.season), teamId = params.get("team") ?? "";
  const descriptor = manifest.seasons.find(s => s.season === year), team = manifest.teams.find(t => t.id === teamId);
  const season = useHistoricalStatic<SeasonProjection>(descriptor && !teamId ? `seasons/${year}.json` : null);
  const teamResult = useHistoricalStatic<HistoricalTeamHub>(descriptor && team ? `teams/${year}/${teamId.replaceAll(":", "_")}.json` : null);
  const directory = useHistoricalStatic<{ players: HistoricalDirectoryPlayer[] }>(descriptor && (!teamId || team) ? "players/index.json" : null);
  const source = teamId ? teamResult : season;
  const rows = useMemo<ExplorerRow[]>(() => {
    if (teamId) return teamResult.value?.players.map(p => ({ ...p, teamId })) ?? [];
    const names = new Map(directory.value?.players.filter(p => p.seasons.includes(year)).map(p => [p.id, p.name]));
    return season.value?.players.flatMap(p => names.has(p.playerId) ? [{ ...p, name: names.get(p.playerId)! }] : []) ?? [];
  }, [teamId, teamResult.value, directory.value, year, season.value]);
  const readOne = useMemo(() => cachedExplorerRead(async (id: string, days: 7 | 14 | 30): Promise<RecentRow> => {
    const profile = await readHistoricalProduct<ExplorerProfile>(`${competition === "postseason" ? "postseason/" : ""}players/${id.replaceAll(":", "_")}.json`);
    if (profile.player.id !== id || !profile.player.seasons.includes(year) || !descriptor) throw Error("Historical identity/season mismatch");
    const window = dateWindow(descriptor.lastDate, days), batting = profile.batting.filter(p => p.season === year && (!teamId || p.teamId === teamId)), pitching = profile.pitching.filter(p => p.season === year && (!teamId || p.teamId === teamId));
    const b = battingAggregate(id, batting, window.from, window.to), p = pitchingAggregate(id, pitching, window.from, window.to);
    return { playerId: id, name: profile.player.name, teamId: teamId || null, batting: b.factCount ? b.metrics : null, pitching: p.factCount ? p.metrics : null, coverage: descriptor.coverage };
  }), [competition, year, descriptor, teamId]);
  const readRecent = useCallback((ids: string[], days: 7 | 14 | 30) => boundedExplorerRead(ids, id => readOne(id, days)), [readOne]);
  if (!descriptor || (teamId && !team)) return <DataState kind="unsupported" title="指定シーズン・球団は未収録です" />;
  if (source.status === "error" || source.status === "missing" || directory.status === "error" || directory.status === "missing") return <DataState kind="source-unavailable" title="指定範囲の成績を取得できません" />;
  if (!source.value || !directory.value) return <LoadingSkeleton />;
  if ((teamId ? teamResult.value?.season : season.value?.season) !== year) return <DataState kind="source-unavailable" title="保存済みSeasonが一致しません" />;
  if (teamId && (teamResult.value?.effectiveDate !== descriptor.lastDate || rows.some(row => !directory.value?.players.some(p => p.id === row.playerId && p.seasons.includes(year))))) return <DataState kind="source-unavailable" title="球団Season・選手一覧の整合を確認できません" />;
  if (!teamId && (season.value?.firstDate !== descriptor.firstDate || season.value?.lastDate !== descriptor.lastDate || rows.length !== season.value?.players.length)) return <DataState kind="source-unavailable" title="保存済みSeason・選手一覧の整合を確認できません" />;
  return <><p className="screen inline-note">MLB過去記録。{teamId ? "選択球団での出場分を集計します。" : "選択年の全所属球団合計です。"}現在の成績ではありません。</p><DataExplorerView league="MLB" rows={rows} teams={manifest.teams} season={year} years={manifest.seasons.map(s => s.season)} effectiveDate={descriptor.lastDate} coverage={descriptor.coverage} readRecent={readRecent} scope={competition === "postseason" ? "&competition=postseason" : ""} /></>;
}
