import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { readNpbHistoricalSeason } from "../application/npb-historical-reader";
import { ageSeasonPlan, ageSeasonQuery } from "../domain/npb-age-season";
import { sumHistoricalRows, type NpbHistoricalDataset, type NpbHistoricalManifest } from "../domain/npb-historical";
import { normalizePlayerSearch } from "../domain/npb-player-directory";
import type { NpbCatalog } from "../domain/npb-product-contract";
import { comparisonValue, type ComparisonRow } from "../domain/product-comparison";
import { ComparisonBars } from "./comparison-bars";
import { DataState, LoadingSkeleton, MetricLabel } from "./components";
import { HistoricalCredits } from "./npb-historical-credits";
import type { CohortRepository } from "./npb-historical-cohort";
import { SaveViewButton } from "./personal-library";

export function NpbAgeSeason({ manifest, repository }: { manifest: NpbHistoricalManifest; repository: CohortRepository }) {
  const [params, setParams] = useSearchParams(), query = ageSeasonQuery(params);
  const [catalog, setCatalog] = useState<NpbCatalog | null>(null), [catalogFailed, setCatalogFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => { if (!query.valid) return; let active = true; void repository.catalog().then(c => { if (active) { setCatalog(c); setCatalogFailed(false); } }).catch(() => { if (active) setCatalogFailed(true); }); return () => { active = false; }; }, [repository, query.valid, attempt]);
  if (!query.valid) return <><DataState kind="unsupported" title="年齢・成績・比較選手の条件を確認してください" detail="公式戦の過去年度、0〜99歳、最大4人を指定できます。Currentや他大会は混ぜません。" /><button onClick={() => setParams({ cohort: "ageSeason", age: "26", role: "batting" })}>条件を初期化</button></>;
  if (catalogFailed) return <><DataState kind="source-unavailable" title="生年月日の情報を取得できません" /><button onClick={() => { setCatalogFailed(false); setAttempt(n => n + 1); }}>再試行</button></>;
  if (!catalog) return <LoadingSkeleton />;
  return <AgeWorkspace key={manifest.inputSha256} manifest={manifest} catalog={catalog} params={params} update={(key, value) => setParams(previous => { const next = new URLSearchParams(previous); next.set(key, value); return next; })} />;
}

function AgeWorkspace({ manifest, catalog, params, update }: { manifest: NpbHistoricalManifest; catalog: NpbCatalog; params: URLSearchParams; update: (key: string, value: string) => void }) {
  const query = ageSeasonQuery(params), [search, setSearch] = useState(""), [attempt, setAttempt] = useState(0);
  const plan = ageSeasonPlan(query.ids, query.age, catalog, manifest), key = JSON.stringify([query.ids, query.age, query.role, attempt]);
  const cache = useRef(new Map<number, Promise<NpbHistoricalDataset>>());
  const [result, setResult] = useState<{ key: string; data: Map<number, NpbHistoricalDataset>; failed: number[] } | null>(null);
  const seasons = [...new Set(plan.filter(p => p.available).map(p => p.season!))].sort((a, b) => a - b), seasonKey = seasons.join(",");
  useEffect(() => {
    let active = true;
    const years = seasonKey ? seasonKey.split(",").map(Number) : [];
    void Promise.all(years.map(async season => {
      let task = cache.current.get(season);
      if (!task) { task = readNpbHistoricalSeason(season, manifest).catch(error => { cache.current.delete(season); throw error; }); cache.current.set(season, task); }
      try { return { season, data: await task }; } catch { return { season, data: null }; }
    })).then(values => { if (active) setResult({ key, data: new Map(values.flatMap(v => v.data ? [[v.season, v.data] as const] : [])), failed: values.filter(v => !v.data).map(v => v.season) }); });
    return () => { active = false; };
  }, [key, seasonKey, manifest]);
  const ready = result?.key === key;
  const observations = plan.map(p => {
    const data = ready && p.season !== null ? result.data.get(p.season) : undefined;
    const rows = data?.rows.filter(r => r.playerId === p.playerId && r.role === query.role) ?? [];
    return { ...p, data, rows, metrics: rows.length ? sumHistoricalRows(rows).metrics : null };
  });
  const options = query.role === "batting" ? ["OPS", "AVG", "HR", "H", "PA"] : ["ERA", "SO", "outsRecorded", "WHIP"];
  const metric = options.includes(params.get("sort1") ?? "") ? params.get("sort1")! : options[0]!;
  const comparison: ComparisonRow[] = observations.flatMap(p => p.metrics ? [{ id: p.playerId, name: `${p.name} · ${p.season}年`, season: p.season!, date: `${p.season}-12-31`, coverage: "partial", metrics: Object.fromEntries(Object.entries(p.metrics).map(([k, value]) => [k, { value, status: value === null ? "unavailable" : "partial" }])) }] : []);
  const candidates = manifest.players.filter(p => catalog.players.some(c => c.playerId === p.playerId && c.profile.birthDate !== null) && !query.ids.includes(p.playerId) && (!search || normalizePlayerSearch(p.name).includes(normalizePlayerSearch(search))));
  const teamName = (id: string) => catalog.teams.find(t => t.teamId === id)?.shortName ?? "球団未確認";
  return <section className="historical-cohort" aria-label="同年齢の年度成績比較">
    <p><Link to={`/NPB/history?season=${Math.max(...manifest.seasons.map(s=>s.season))}&role=${query.role}&cohort=schoolYear${query.ids[0]?`&peer=${query.ids[0]}`:""}`}>同学年の選手を同じ年度で比較 →</Link></p>
    <p className="data-notice">各年度の12月31日時点で{query.age}歳となるシーズンを比較します。年齢到達日までの通算や完全なキャリアではありません。公式戦の収録分だけが対象です。</p>
    <div className="explorer-filter-grid"><form onSubmit={e => { e.preventDefault(); update("age", String(new FormData(e.currentTarget).get("age"))); }}><label>年末時点の年齢<input key={params.get("age") ?? "26"} name="age" type="number" min="0" max="99" step="1" required defaultValue={params.get("age") ?? "26"} /></label><button>年齢を適用</button></form><label>成績<select value={query.role} onChange={e => update("role", e.target.value)}><option value="batting">打撃（投手打撃を含む）</option><option value="pitching">投球</option></select></label></div>
    <p role="status">比較 {query.ids.length}/4人</p>
    {query.ids.length > 0 && !ready && <LoadingSkeleton />}
    {comparison.length >= 2 && <section aria-label="同年齢の比較結果"><label>比較指標<select value={metric} onChange={e => update("sort1", e.target.value)}>{options.map(k => <option key={k} value={k}>{k === "outsRecorded" ? "投球回" : k}</option>)}</select></label><ComparisonBars rows={comparison} metric={metric} /><p className="inline-note">年度・球団・収録母数が異なります。年代の環境差は調整せず、順位・優劣・規定資格を判定しません。</p></section>}
    <div className="explorer-results">{observations.map(p => <article key={p.playerId} className="explorer-result"><h2>{p.name}</h2><p>{p.season === null ? "対象年度を計算できません" : `${p.season}年 · 年末${query.age}歳`}</p>{p.reason ? <p>{p.reason}。出場なし・0成績とは扱いません。</p> : ready && result.failed.includes(p.season!) ? <p role="alert">年度成績を取得できません。</p> : ready && !p.rows.length ? <p>この役割の成績は未収録です。0成績とは扱いません。</p> : p.metrics && <><p>{[...new Set(p.rows.map(r => teamName(r.teamId)))].join(" / ")} · 球団別行の一部収録</p><dl className="explorer-values">{[query.role === "batting" ? "PA" : "outsRecorded", ...options.slice(0, 2)].map(k => <div key={k}><dt><MetricLabel metric={k} label={k === "outsRecorded" ? "投球回" : k} /></dt><dd>{comparisonValue(k, p.metrics?.[k] ?? null)}</dd></div>)}</dl><Link to={`/NPB/players/${p.playerId}/seasons?season=${p.season}&role=${query.role}`}>年度成績・推移を見る →</Link><details><summary>年齢と成績の出典</summary><p>生年月日 {p.birthDate} · プロフィール基準 {catalog.effectiveDate}。年度末年齢は生年月日から計算しました。</p><HistoricalCredits data={p.data!} playerId={p.playerId} />{catalog.players.find(c => c.playerId === p.playerId)?.profile.credits?.filter(c => c.fields.includes("birthDate")).map((c, i) => <p key={i}><a href={c.url} target="_blank" rel="noreferrer">{c.name}</a> · <a href={c.licenseUrl}>利用条件</a></p>)}</details></>}
      <button className="text-button" aria-label={`${p.name}を年齢比較から外す`} onClick={() => update("recentPlayers", query.ids.filter(id => id !== p.playerId).join(","))}>比較から外す</button></article>)}</div>
    {ready && result.failed.length > 0 && <button onClick={() => setAttempt(n => n + 1)}>取得できなかった年度を再試行</button>}
    {query.ids.length < 4 && <details className="compare-search" open={query.ids.length < 2}><summary>比較する選手を追加（最大4人）</summary><label>選手名で探す<input type="search" value={search} onChange={e => setSearch(e.target.value.slice(0, 100))} /></label><p className="inline-note">既存プロフィールで生年月日を確認できる収録選手が対象です。検索結果は最大30人で、正式な現役・新人資格とは無関係です。</p><div className="row-list">{candidates.slice(0, 30).map(p => <button className="player-row" key={p.playerId} onClick={() => { update("recentPlayers", [...query.ids, p.playerId].join(",")); setSearch(""); }}><strong>{p.name}</strong><span>比較に追加</span></button>)}</div>{!candidates.length && <p>条件に合う収録選手はいません。</p>}</details>}
    <SaveViewButton league="NPB" kind="history" params={params} /><p><Link to="/NPB/history?season=2025">同じ年度の成績を探す →</Link></p>
  </section>;
}
