import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Services } from "../app/services";
import type { League } from "../domain/models";
import { canonicalEntityRefSchema } from "../domain/cross-league";
import { boundedComparisonRead, readMlbTeamComparison, readNpbTeamComparison } from "../application/product-comparison";
import { comparisonValue, metricNumber, previousYearDelta, selectedTeams, selectedYears, teamComparisonKeys, type ComparisonRow } from "../domain/product-comparison";
import { readHistoricalProduct } from "../app/historical-products";
import type { ExplorerManifest, ExplorerProfile } from "./data-explorer";
import { compareBattingKeys, comparePitchingKeys } from "../domain/player-compare";
import { useHistoricalCompetition } from "./historical-competition-context";
import { DataState, LoadingSkeleton, MetricLabel, PageHeading } from "./components";
import { DisplayExportButton } from "./product-sharing";
import { useHistoricalStatic } from "./use-mlb-historical";
import { matchesMlbPlayerName } from "../domain/mlb-japanese-display";
import { readNpbExplorerSeason } from "../application/explorer-readers";

const labels: Record<string, string> = { G: "試合", W: "勝", L: "敗", T: "分", runsFor: "得点", runsAgainst: "失点", runDifference: "得失点差", outsRecorded: "IP", K9: "K/9" };
const scopeSuffix = (season: number, scope: string) => `?season=${season}${scope === "postseason" ? "&competition=postseason" : ""}`;
function ComparisonBars({ rows, metric }: { rows: ComparisonRow[]; metric: string }) {
  const max = Math.max(1, ...rows.map(r => Math.abs(metricNumber(r.metrics, metric) ?? 0)));
  return <figure className="comparison-bars"><figcaption><MetricLabel metric={metric} label={labels[metric] ?? metric} /></figcaption>{rows.map(r => {
    const n = metricNumber(r.metrics, metric);
    return <div className="comparison-bar" key={r.id}><strong>{r.name}</strong><div className="comparison-bar__track">{n !== null && <span className={n < 0 ? "negative" : ""} style={{ width: `${Math.abs(n) / max * 100}%` }} />}</div><span>{comparisonValue(metric, n)}{r.metrics?.[metric]?.status === "partial" && " *"}</span></div>;
  })}<small>保存済み集計の比較。順位や優劣の判定ではありません。</small></figure>;
}
function ComparisonResults({ league, rows, keys, metric, scope, yearMode = false }: { league: League; rows: ComparisonRow[]; keys: string[]; metric: string; scope: string; yearMode?: boolean }) {
  const dates = new Set(rows.map(r => r.date));
  if (!yearMode && dates.size > 1) return <DataState kind="source-unavailable" title="比較の基準日が一致しません" />;
  return <><ComparisonBars rows={rows} metric={metric} /><div className="comparison-results">{rows.map(r => <article className="comparison-summary" key={r.id}><h2>{r.name}</h2><p className="inline-note">{r.season} · {r.date}まで · {r.coverage === "complete" ? "収録済み" : "一部未確認"}</p>{r.notice && <p className="inline-note">{r.notice}</p>}<dl className="explorer-values">{keys.map(k => <div key={k}><dt><MetricLabel metric={k} label={labels[k] ?? k} /></dt><dd>{comparisonValue(k, metricNumber(r.metrics, k))}{r.metrics?.[k]?.status === "partial" && <small> 一部</small>}</dd></div>)}</dl>{yearMode && <p className="inline-note">前年差（{metric === "outsRecorded" ? "アウト数" : metric}）：{previousYearDelta(rows, r, metric) === null ? "—" : `${previousYearDelta(rows, r, metric)! >= 0 ? "+" : ""}${previousYearDelta(rows, r, metric)!.toFixed(["AVG", "OBP", "SLG", "OPS"].includes(metric) ? 3 : ["ERA", "K9"].includes(metric) ? 2 : 0)}`}</p>}</article>)}</div>
    <DisplayExportButton data={{ league, scope, date: [...dates].sort().at(-1) ?? "", coverage: rows.every(r => r.coverage === "complete" && keys.every(k => metricNumber(r.metrics, k) !== null && r.metrics?.[k]?.status === "complete")) ? "complete" : "partial", columns: ["対象", "Season", "基準日", "Coverage", ...keys], rows: rows.map(r => [r.name, r.season, r.date, r.coverage, ...keys.map(k => metricNumber(r.metrics, k))]) }} />
  </>;
}
type Loader = (ids: string[], season: number, view: string) => Promise<ComparisonRow[]>;
function TeamWorkspace({ league, teams, years, load, competition = "regular", favorites = [] }: { league: League; teams: { id: string; name: string }[]; years: number[]; load: Loader; competition?: string; favorites?: string[] }) {
  const [params, setParams] = useSearchParams(), ids = selectedTeams(league, params.get("teams")), year = Number(params.get("season") ?? years.at(-1));
  const choices = league === "MLB" ? ["season", "7", "14", "30", "home", "away"] : ["season", "14"], view = params.get("view") ?? "season";
  const idsKey = ids.join(","), key = `${idsKey}:${year}:${view}:${competition}`, [state, setState] = useState<{ key: string; rows: ComparisonRow[]; error: boolean } | null>(null), [query, setQuery] = useState("");
  const known = ids.every(id => teams.some(t => t.id === id)), supported = years.includes(year) && choices.includes(view) && !(league === "NPB" && params.get("competition") === "postseason");
  useEffect(() => { if (!supported || !known || !idsKey) return; let active = true; void load(idsKey.split(","), year, view).then(rows => { if (active) setState({ key, rows, error: false }); }).catch(() => { if (active) setState({ key, rows: [], error: true }); }); return () => { active = false; }; }, [load, key, idsKey, year, view, supported, known]);
  const update = (k: string, v: string) => setParams(p => { const next = new URLSearchParams(p); if (v) next.set(k, v); else next.delete(k); return next; });
  const displayKeys = league === "NPB" && view === "14" ? teamComparisonKeys.slice(0, 7) : teamComparisonKeys;
  const metric = displayKeys.includes(params.get("metric") ?? "") ? params.get("metric")! : "runDifference";
  const rows = state?.key === key ? state.rows : [], candidates = teams.filter(t => !ids.includes(t.id) && t.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id))).slice(0, 12);
  return <div className="screen"><PageHeading eyebrow={`${league} · ${competition === "postseason" ? "POSTSEASON" : "REGULAR SEASON"}`} title="球団比較" /><p className="inline-note">2〜4球団の保存済み成績を比較。公式順位ではありません。</p>{!supported || !known ? <DataState kind="unsupported" title="指定の年度・条件・球団は未対応です" /> : <>
    <div className="compare-selection">{ids.map(id => <div key={id}><Link to={`/${league}/teams/${encodeURIComponent(id)}${scopeSuffix(year, competition)}`}>{teams.find(t => t.id === id)!.name}</Link><button aria-label={`${teams.find(t => t.id === id)!.name}を球団比較から外す`} onClick={() => update("teams", ids.filter(t => t !== id).join(","))}>×</button></div>)}</div>
    {ids.length < 4 && <details open={ids.length < 2}><summary>球団を追加（{ids.length}/4）</summary><label className="search-field"><span className="sr-only">比較する球団</span><input type="search" placeholder="球団名で検索" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="row-list">{candidates.map(t => <button className="player-row" key={t.id} onClick={() => { update("teams", [...ids, t.id].join(",")); setQuery(""); }}>{favorites.includes(t.id) && "★ "}{t.name} ＋</button>)}</div></details>}
    <div className="explorer-filter-grid"><label>シーズン<select value={year} onChange={e => update("season", e.target.value)}>{years.map(y => <option key={y}>{y}</option>)}</select></label><label>集計条件<select value={view} onChange={e => update("view", e.target.value)}>{choices.map(v => <option key={v} value={v}>{v === "season" ? "Season" : v === "home" ? "Home" : v === "away" ? "Away" : `直近${v}日${league === "NPB" ? "・試合結果" : ""}`}</option>)}</select></label><label>比較グラフ<select value={metric} onChange={e => update("metric", e.target.value)}>{displayKeys.map(k => <option key={k} value={k}>{labels[k] ?? k}</option>)}</select></label></div>
    {league === "MLB" && <p className="inline-note">Recentは選択年度・集計対象の最終保存日が基準です。現在の成績ではありません。</p>}
    {ids.length < 2 && <p className="data-notice">比較する球団を2〜4つ選んでください。</p>}{ids.length > 0 && (state?.key !== key ? <LoadingSkeleton /> : state.error ? <DataState kind="source-unavailable" title="球団比較を読み込めません" /> : <ComparisonResults league={league} rows={rows} keys={displayKeys} metric={metric} scope={`${year} ${competition} Team ${view}`} />)}
    <Link to={`/${league}/teams${scopeSuffix(year, competition)}`}>球団Hub一覧 →</Link>
  </>}</div>;
}
export function NpbTeamCompare({ services, favoriteTeams = [] }: { services: Services; favoriteTeams?: string[] }) {
  const [catalog, setCatalog] = useState<{ teams: { id: string; name: string }[]; years: number[] } | null>(null), [error, setError] = useState(false);
  useEffect(() => { let active = true; void services.product.catalog().then(p => { if (active) setCatalog({ teams: p.teams.map(t => ({ id: t.teamId, name: t.name })), years: [Number(p.effectiveDate.slice(0, 4))] }); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [services]);
  const load = useCallback<Loader>(async (ids, year, view) => { const rows = await readNpbTeamComparison(services, view); if (rows.some(r => r.season !== year)) throw Error("Season mismatch"); return ids.map(id => rows.find(r => r.id === id)!); }, [services]);
  return error ? <DataState kind="source-unavailable" title="球団一覧を読み込めません" /> : !catalog ? <LoadingSkeleton /> : <TeamWorkspace league="NPB" {...catalog} load={load} favorites={favoriteTeams} />;
}
export function MlbTeamCompare({ manifest, favoriteTeams = [] }: { manifest: ExplorerManifest; favoriteTeams?: string[] }) {
  const competition = useHistoricalCompetition();
  const load = useCallback<Loader>(async (ids, year, view) => { const result = await boundedComparisonRead(ids, id => readMlbTeamComparison(id, manifest.teams.find(t => t.id === id)!.name, year, competition, view)); if (result.some(r => r.status === "rejected")) throw Error("Team load failed"); return result.flatMap(r => r.status === "fulfilled" ? [r.value] : []); }, [manifest, competition]);
  return <TeamWorkspace league="MLB" teams={manifest.teams} years={manifest.seasons.map(s => s.season)} load={load} competition={competition} favorites={favoriteTeams} />;
}
export function SeasonCompare({ league, manifest, services }: { league: League; manifest?: ExplorerManifest; services?: Services }) {
  const [params, setParams] = useSearchParams(), competition = useHistoricalCompetition(), kind = params.get("kind") === "team" ? "team" : "player", entity = params.get("entity") ?? "", role = params.get("role") === "pitching" ? "pitching" : "batting";
  const years = manifest?.seasons.map(s => s.season) ?? [2026], selected = selectedYears(params.get("years"), years), valid = canonicalEntityRefSchema.safeParse({ league, kind, id: entity }).success;
  const directory = useHistoricalStatic<{ players: { id: string; name: string }[] }>(league === "MLB" && kind === "player" ? "players/index.json" : null), [query, setQuery] = useState("");
  const [npbNames, setNpbNames] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { if (league !== "NPB" || !services) return; let active = true; void services.product.catalog().then(p => { if (active) setNpbNames(kind === "team" ? p.teams.map(t => ({ id: t.teamId, name: t.name })) : p.players.map(t => ({ id: t.playerId, name: t.displayName }))); }).catch(() => { if (active) setNpbNames([]); }); return () => { active = false; }; }, [league, services, kind]);
  const names = league === "NPB" ? npbNames : kind === "team" ? manifest?.teams ?? [] : directory.value?.players ?? [], name = names.find(n => n.id === entity)?.name ?? entity;
  const selectedKey = selected.join(","), key = `${league}:${competition}:${kind}:${entity}:${selectedKey}:${role}`, [state, setState] = useState<{ key: string; rows: ComparisonRow[] } | null>(null), [errorKey, setErrorKey] = useState("");
  const unsupported = !selected.length || league === "NPB" && params.get("competition") === "postseason";
  useEffect(() => { if (!valid || unsupported) return; let active = true;
    const read = async (): Promise<ComparisonRow[]> => {
      const selected = selectedKey.split(",").map(Number);
      if (league === "NPB") {
        if (kind === "team") return (await readNpbTeamComparison(services!)).filter(r => r.id === entity).map(r => ({ ...r, id: `${r.id}:${r.season}` }));
        const payload = await readNpbExplorerSeason(2026), player = payload.players.find(p => p.playerId === entity); if (!player) throw Error("Player absent");
        return [{ id: `${entity}:2026`, name: "2026年", season: 2026, date: payload.effectiveDate, coverage: payload.coverage.status, metrics: player[role]?.metrics ?? null }];
      }
      if (kind === "team") { const result = await boundedComparisonRead(selected.map(String), y => readMlbTeamComparison(entity, `${y}年`, Number(y), competition)); return result.map((r, i) => r.status === "fulfilled" ? { ...r.value, id: `${entity}:${selected[i]}` } : { id: `${entity}:${selected[i]}`, name: `${selected[i]}年`, season: selected[i]!, date: manifest!.seasons.find(s => s.season === selected[i])!.lastDate, coverage: "unavailable", metrics: null, notice: "この年度を取得できません" }); }
      const profile = await readHistoricalProduct<ExplorerProfile>(`${competition === "postseason" ? "postseason/" : ""}players/${entity.replaceAll(":", "_")}.json`); if (profile.player.id !== entity) throw Error("Player identity mismatch");
      return selected.map(y => ({ id: `${entity}:${y}`, name: `${y}年`, season: y, date: manifest!.seasons.find(s => s.season === y)!.lastDate, coverage: manifest!.seasons.find(s => s.season === y)!.coverage, metrics: profile.seasonTotals[String(y)]?.[role] ?? null, ...(!profile.seasonTotals[String(y)]?.[role] ? { notice: "この年度・出場形態の記録なし" } : {}) }));
    };
    void read().then(rows => { if (active) { setState({ key, rows }); setErrorKey(""); } }).catch(() => { if (active) setErrorKey(key); }); return () => { active = false; };
  }, [key, selectedKey, valid, unsupported, league, kind, entity, role, competition, services, manifest]);
  const update = (k: string, v: string) => setParams(p => { const next = new URLSearchParams(p); next.set(k, v); if (k === "kind") next.delete("entity"); return next; });
  const keys = kind === "team" ? teamComparisonKeys : role === "batting" ? compareBattingKeys : comparePitchingKeys.map(k => k === "appearances" && league === "NPB" ? "G" : k), metric = keys.includes(params.get("metric") ?? "") ? params.get("metric")! : kind === "team" ? "W" : role === "batting" ? "OPS" : "ERA";
  return <div className="screen"><PageHeading eyebrow={`${league} · ${competition === "postseason" ? "POSTSEASON" : "REGULAR SEASON"}`} title="保存済みシーズン比較" /><p className="inline-note">収録年度の比較です。Career・通算成績ではありません。率指標はPA／IP、2020年などの試合数の違いと合わせて確認してください。</p><div className="explorer-filter-grid"><label>対象<select value={kind} onChange={e => update("kind", e.target.value)}><option value="player">選手</option><option value="team">球団</option></select></label>{kind === "player" && <label>成績<select value={role} onChange={e => update("role", e.target.value)}><option value="batting">打撃</option><option value="pitching">投球</option></select></label>}<label>指標<select value={metric} onChange={e => update("metric", e.target.value)}>{keys.map(k => <option value={k} key={k}>{labels[k] ?? k}</option>)}</select></label></div>
    <details open={!entity}><summary>{name || "比較対象を選択"}</summary><label className="search-field"><span className="sr-only">シーズン比較の対象検索</span><input type="search" placeholder="名前で検索" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="row-list">{names.filter(n => league === "MLB" && kind === "player" ? matchesMlbPlayerName(n.id, n.name, query) : n.name.includes(query)).slice(0, 12).map(n => <button className="player-row" key={n.id} onClick={() => update("entity", n.id)}>{n.name}</button>)}</div></details>
    <fieldset className="comparison-years"><legend>比較年度（最大6年）</legend>{years.map(y => <label key={y}><input type="checkbox" checked={selected.includes(y)} onChange={() => update("years", (selected.includes(y) ? selected.filter(s => s !== y) : [...selected, y]).join(","))} />{y}</label>)}</fieldset>
    {years.length < 2 && <p className="data-notice">現在のNPBは2026年のみ収録。年度差は未対応です。</p>}{unsupported ? <DataState kind="unsupported" title="指定年度・集計対象は未収録です" /> : entity && !valid ? <DataState kind="unsupported" title="canonical IDが一致しません" /> : valid && (errorKey === key ? <DataState kind="source-unavailable" title="シーズン比較を取得できません" /> : state?.key !== key ? <LoadingSkeleton /> : <><h2>{name}</h2><ComparisonResults league={league} rows={state.rows} keys={[...new Set([kind === "team" ? "G" : role === "batting" ? "PA" : "outsRecorded", metric, kind === "team" ? "runDifference" : role === "batting" ? "HR" : "SO"])]} metric={metric} scope={`${competition} 保存済み年度 ${selected.join("/")}`} yearMode /><div className="row-list">{selected.map(y => <Link key={y} className="player-row" to={`/${league}/${kind === "team" ? "teams" : "players"}/${encodeURIComponent(entity)}${kind === "player" ? "/stats" : ""}${scopeSuffix(y, competition)}`}>{y}年の保存済み成績 →</Link>)}</div></>)}
  </div>;
}
