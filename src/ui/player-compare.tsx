import { StatTable } from "./stat-table";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Services } from "../app/services";
import type { League } from "../domain/models";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";
import { searchNpbPlayers } from "../domain/npb-player-directory";
import { compareIds, compareBattingKeys, comparePitchingKeys, npbCompareSection, historicalCompareRoles, type CompareMetrics } from "../domain/player-compare";
import { normalizePlayerSearch } from "../domain/cross-league";
import { matchesMlbPlayerName } from "../domain/mlb-japanese-display";
import { battingAggregate, pitchingAggregate, dateWindow, type DatedBatter, type DatedPitcher } from "../domain/mlb-historical-aggregate";
import type { AdvancedPlayerPayload } from "../domain/mlb-pa-analysis";
import type { PlayerAnalysisBundle } from "../domain/player-analysis-bundle";
import type { PlayerRecentResponse } from "../domain/player-recent";
import { readHistoricalProduct } from "../app/historical-products";
import { useHistoricalDirectory } from "./use-mlb-historical";
import { useHistoricalCompetition } from "./historical-competition-context";
import { DataState, LoadingSkeleton, MetricLabel, PageHeading } from "./components";
import { DisplayExportButton } from "./product-sharing";
import { comparisonDisplayExport } from "../domain/product-sharing";

export type ComparePlayer = { id: string; name: string; batting: boolean; pitching: boolean; seasons?: number[] };
export type HistoricalProductProfile = { player: { id: string; name: string; seasons: number[] }; batting: DatedBatter[]; pitching: DatedPitcher[] };
export type HistoricalProductManifest = { seasons: { season: number; firstDate: string; lastDate: string; coverage: string }[]; teams: { id: string; name: string }[]; features?: { directBvp?: string; situationalAnalysis?: string } };
type Loaded = { id: string; metrics: CompareMetrics | null; date: string; notice: string | null; coverage?: string };
type Controls = { role: "batting" | "pitching"; condition: string; period: string; season: number; opponent: string; advancedOpponent: string; battingOrder: number };
type Loader = (id: string, controls: Controls) => Promise<Loaded>;
const conditionLabels: Record<string, string> = { season: "シーズン", total: "期間の成績", home: "ホーム", away: "ビジター", opponent: "対戦球団", order: "打順", starter: "先発出場", substitute: "途中出場", "pitcher-starter": "先発投手", reliever: "救援投手", "bases:empty": "走者なし", "bases:runners": "走者あり", "bases:risp": "得点圏", "outs:0": "0アウト", "outs:1": "1アウト", "outs:2": "2アウト", "inning:1–3": "1〜3回", "inning:4–6": "4〜6回", "inning:7–9": "7〜9回", "inning:extra": "延長", "score:ahead": "リード", "score:tied": "同点", "score:behind": "ビハインド", bvp: "実対戦" };
function metricValue(key: string, m: CompareMetrics[string] | undefined) {
  if (!m || m.value === null) return "—";
  if (key === "outsRecorded") return `${Math.floor(m.value / 3)}.${m.value % 3}`;
  return m.value.toFixed(["AVG", "OBP", "SLG", "OPS"].includes(key) ? 3 : ["ERA", "K9"].includes(key) ? 2 : 0);
}
export function CompareWorkspace({ league, players, teams, seasons, loader, advanced = false, competition = "regular" }: { league: League; players: ComparePlayer[]; teams: { id: string; name: string }[]; seasons: number[]; loader: Loader; advanced?: boolean; competition?: string }) {
  const [params, setParams] = useSearchParams(), [query, setQuery] = useState("");
  // Scope switches retain URL parameters. Accept only identities with a payload
  // in the current competition directory, for selected players and BvP opponents.
  const ids = compareIds(league, params.get("players")).filter(id => players.some(p => p.id === id)), idsKey = ids.join(",");
  const role = params.get("role") === "pitching" ? "pitching" : "batting";
  const season = params.has("season") ? Number(params.get("season")) : seasons.at(-1)!;
  const supportedSeason = seasons.includes(season);
  const period = league === "NPB" ? "30d" : ["season", "7d", "14d", "30d"].includes(params.get("period") ?? "") ? params.get("period")! : "season";
  const choices = ["season", ...(league === "NPB" ? ["7d", "14d", "30d"] : ["total"]), "home", "away", "opponent", ...(role === "batting" ? ["order", "starter", "substitute"] : ["pitcher-starter", "reliever"]), ...(advanced ? Object.keys(conditionLabels).filter(k => k.includes(":") || k === "bvp") : [])];
  const condition = choices.includes(params.get("condition") ?? "") ? params.get("condition")! : "season";
  const opponent = teams.some(t => t.id === params.get("opponent")) ? params.get("opponent")! : teams[0]?.id ?? "";
  const advancedOpponent = compareIds("MLB", params.get("against")).find(id => players.some(p => p.id === id)) ?? "";
  const battingOrder = /^[1-9]$/.test(params.get("order") ?? "") ? Number(params.get("order")) : 1;
  const controlsKey = JSON.stringify({ role, condition, period, season, opponent, advancedOpponent, battingOrder });
  const key = JSON.stringify([league, competition, idsKey, controlsKey]);
  const [state, setState] = useState<{ key: string; rows: ({ status: "ready"; value: Loaded } | { status: "error"; id: string })[] }>({ key: "", rows: [] });
  useEffect(() => { if (!supportedSeason) return; let active = true; const selected = idsKey ? idsKey.split(",") : []; const controls = JSON.parse(controlsKey) as Controls; void Promise.all(selected.map(id => loader(id, controls).then(value => ({ status: "ready" as const, value })).catch(() => ({ status: "error" as const, id })))).then(rows => { if (active) setState({ key, rows }); }); return () => { active = false; }; }, [loader, controlsKey, key, idsKey, supportedSeason]);
  const update = (values: Record<string, string>) => { const next = new URLSearchParams(params); for (const [k, v] of Object.entries(values)) { if (v) next.set(k, v); else next.delete(k); } setParams(next); };
  const matches = (p: ComparePlayer) => league === "MLB" ? matchesMlbPlayerName(p.id, p.name, query) : normalizePlayerSearch(p.name).includes(normalizePlayerSearch(query));
  const results = players.filter(p => (role === "batting" ? p.batting : p.pitching) && (!p.seasons || p.seasons.includes(season)) && matches(p) && !ids.includes(p.id)).slice(0, 12);
  const loaded = state.key === key ? state.rows : [];
  const dates = new Set(loaded.flatMap(r => r.status === "ready" ? [r.value.date] : []));
  const mismatch = dates.size > 1;
  const paMode = condition.includes(":") || condition === "bvp";
  const keys = paMode ? ["PA", "AB", "H", "2B", "3B", "HR", "BB", "HBP", "SO", "SH", "SF", "AVG", "OBP", "SLG", "OPS"] : role === "batting" ? compareBattingKeys : comparePitchingKeys.map(k => league === "NPB" && k === "appearances" ? "G" : k);
  if (!supportedSeason) return <div className="screen"><PageHeading eyebrow={league} title="選手比較" /><DataState kind="unsupported" title={league === "MLB" && season === 2026 ? "2026年の試合結果・選手成績は未対応" : "指定のシーズンは未収録です"} action="収録済みの比較へ" to={`/${league}/compare`} /></div>;
  return <div className="screen compare-screen"><Link className="back-link" to={`/${league}/search${competition === "postseason" ? `?competition=postseason&season=${season}` : ""}`}>← 選手一覧</Link><PageHeading eyebrow={`${league} · ${competition === "postseason" ? "POSTSEASON" : "REGULAR SEASON"}`} title="選手比較" />
    <div className="segmented" aria-label="比較する成績">{(["batting", "pitching"] as const).map(r => <button key={r} aria-pressed={role === r} onClick={() => update({ role: r, condition: "season", against: "" })}>{r === "batting" ? "打撃" : "投球"}</button>)}</div>
    <div className="compare-selection">{ids.map(id => <div key={id}><Link to={`/${league}/players/${encodeURIComponent(id)}?season=${season}${competition === "postseason" ? "&competition=postseason" : ""}`}>{players.find(p => p.id === id)?.name ?? "未収録選手"}</Link><button type="button" aria-label={`${players.find(p => p.id === id)?.name ?? "選手"}を比較から削除`} onClick={() => update({ players: ids.filter(p => p !== id).join(",") })}>×</button></div>)}</div>
    {ids.length < 4 && <details className="compare-search" open={ids.length < 2}><summary>選手を追加（{ids.length}/4）</summary><label className="search-field"><span className="sr-only">比較する選手名</span><input type="search" placeholder="選手名で検索" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="row-list">{results.map(p => <button className="player-row" key={p.id} onClick={() => { update({ players: [...ids, p.id].join(",") }); setQuery(""); }}><strong>{p.name}</strong><span>＋</span></button>)}</div>{!results.length && <p className="inline-note">この年度・記録種類の選手は見つかりません。</p>}</details>}
    <div className="mlb-controls">{league === "MLB" && <label>シーズン<select value={season} onChange={e => update({ season: e.target.value })}>{seasons.map(s => <option key={s}>{s}</option>)}</select></label>}<label>条件<select value={condition} onChange={e => update({ condition: e.target.value })}>{choices.map(c => <option key={c} value={c}>{conditionLabels[c] ?? c.replace("d", "日")}</option>)}</select></label>
    {league === "MLB" && condition !== "season" && !paMode && <label>期間<select value={period} onChange={e => update({ period: e.target.value })}>{["season", "7d", "14d", "30d"].map(p => <option value={p} key={p}>{p === "season" ? "シーズン" : `直近${p.replace("d", "日")}`}</option>)}</select></label>}
    {condition === "opponent" && <label>対戦球団<select value={opponent} onChange={e => update({ opponent: e.target.value })}>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
    {condition === "order" && <label>打順<select value={battingOrder} onChange={e => update({ order: e.target.value })}>{Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 1}>{i + 1}番</option>)}</select></label>}
    {condition === "bvp" && <label>共通の対戦相手<select value={advancedOpponent} onChange={e => update({ against: e.target.value })}><option value="">検索して相手を選択</option>{advancedOpponent && <option value={advancedOpponent}>{players.find(p => p.id === advancedOpponent)?.name ?? "選択済みの相手"}</option>}{players.filter(p => p.id !== advancedOpponent && matches(p)).slice(0, 30).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><input aria-label="対戦相手名を絞り込む" type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>}</div>
    <p className="inline-note">{condition === "season" ? `${season}年シーズン` : paMode ? `${season}年 · ${role === "pitching" ? "対戦打者の打撃成績" : "PA由来の打撃成績"}` : league === "NPB" && !condition.endsWith("d") ? "直近30日・同じ条件" : "同じ期間・条件"}。同じ記録種類で比較します。</p>
    {league === "NPB" && <Link className="text-link" to={`/NPB/talent?role=${role}`}>ドラフトの同期・年齢・学校から比較相手を探す →</Link>}
    {ids.length < 2 && <p className="data-notice">2〜4選手を選んで比較できます。</p>}
    {state.key !== key && ids.length > 0 ? <LoadingSkeleton /> : mismatch ? <DataState kind="source-unavailable" title="集計の基準日が揃っていません。更新後に再確認してください" /> : ids.length > 0 && <>
      {dates.size > 0 && <p className="inline-note">{[...dates][0]}まで</p>}
      {loaded.map((r, i) => r.status === "error" || r.value.notice ? <p className="data-notice" key={ids[i]}>{players.find(p => p.id === ids[i])?.name ?? "選手"}：{r.status === "error" ? "読み込みに失敗しました" : r.value.notice}</p> : null)}
      <div className="mlb-stat-scroll compare-table" tabIndex={0} role="region" aria-label="選手比較表"><StatTable><thead><tr><th>成績</th>{ids.map(id => <th key={id}>{players.find(p => p.id === id)?.name ?? "未収録"}</th>)}</tr></thead><tbody>{keys.map(k => <tr key={k}><th scope="row"><MetricLabel metric={k} label={k === "outsRecorded" ? "IP" : k === "K9" ? "K/9" : k} /></th>{ids.map((id, i) => { const r = loaded[i], m = r?.status === "ready" ? r.value.metrics?.[k] : undefined; return <td key={id}>{metricValue(k, m)}{m?.status === "partial" && <small>一部</small>}</td>; })}</tr>)}</tbody></StatTable></div>
      <p className="inline-note">規定到達者のランキングではありません。打席・登板数も合わせて確認してください。取得できない値は「—」。</p>
      {dates.size === 1 && <DisplayExportButton data={comparisonDisplayExport(league, `${season} ${competition} ${role} ${condition} ${period}`, [...dates][0]!, keys, ids.map((id, i) => { const row = loaded[i]; return { name: players.find(p => p.id === id)?.name ?? id, metrics: row?.status === "ready" ? row.value.metrics : null, coverage: row?.status === "ready" ? row.value.coverage ?? "unknown" : "unavailable" }; }))} />}
    </>}
  </div>;
}
export function NpbPlayerCompare({ services }: { services: Services }) {
  const [directory, setDirectory] = useState<NpbPlayerDirectory | null>(null), [error, setError] = useState(false);
  const [cache] = useState(() => new Map<string, Promise<PlayerAnalysisBundle | PlayerRecentResponse | null>>());
  useEffect(() => { let active = true; void services.directory.findLatestNpb().then(p => { if (active) setDirectory(p); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [services]);
  const loader = useCallback<Loader>(async (id, c) => {
    const kind = c.condition === "season" ? "season" : "bundle", key = `${id}:${kind}`;
    let pending = cache.get(key); if (!pending) { pending = kind === "season" ? services.recent.find(id, "season") : services.analysisBundle.find(id); cache.set(key, pending); void pending.catch(() => cache.delete(key)); }
    const payload = await pending;
    if (!payload) return { id, metrics: null, date: directory!.effectiveDate, notice: "保存済み成績なし" };
    const section = kind === "season" ? (payload as PlayerRecentResponse)[c.role] : npbCompareSection(payload as PlayerAnalysisBundle, c.role, c.condition, c.opponent, c.battingOrder);
    return { id, metrics: section?.metrics ?? null, date: payload.asOfDate, notice: !section ? "この条件の記録なし" : section.coverage.status !== "complete" ? "一部データ確認中・保存済み記録から集計" : null };
  }, [cache, services, directory]);
  if (error) return <DataState kind="source-unavailable" title="比較用の選手一覧を読み込めません" />;
  if (!directory) return <LoadingSkeleton />;
  return <CompareWorkspace league="NPB" players={searchNpbPlayers(directory.players, "", {}).map(p => ({ id: p.playerId, name: p.displayName, batting: p.battingAvailable, pitching: p.pitchingAvailable }))} teams={directory.teams.map(t => ({ id: t.id, name: t.shortName }))} seasons={[Number(directory.effectiveDate.slice(0, 4))]} loader={loader} />;
}
export function MlbPlayerCompare({ manifest }: { manifest: HistoricalProductManifest }) {
  const competition = useHistoricalCompetition(), directory = useHistoricalDirectory();
  const [cache] = useState(() => new Map<string, Promise<unknown>>());
  const loader = useCallback<Loader>(async (id, c) => {
    const advanced = c.condition.includes(":") || c.condition === "bvp";
    const path = `${competition === "postseason" ? "postseason/" : ""}${advanced ? `advanced/${c.season}` : "players"}/${id.replaceAll(":", "_")}.json`;
    let pending = cache.get(path); if (!pending) { pending = readHistoricalProduct(path); cache.set(path, pending); void pending.catch(() => cache.delete(path)); }
    const payload = await pending;
    const season = manifest.seasons.find(s => s.season === c.season)!;
    if (advanced) {
      const data = payload as AdvancedPlayerPayload;
      if (data.playerId !== id || data.scope !== String(c.season)) throw Error("Advanced comparison context mismatch");
      const ready = c.condition === "bvp" ? data.directBvp === "ready" : data.situations === "ready";
      const row = ready ? c.condition === "bvp" ? data[c.role].opponents.find(p => p.playerId === c.advancedOpponent)?.metrics : data[c.role].splits.find(p => p.key === c.condition)?.metrics : null;
      return { id, date: season.lastDate, coverage: season.coverage, metrics: row ? Object.fromEntries(Object.entries(row).map(([k, v]) => [k, { value: v, status: ready ? "complete" : "unavailable" }])) : null, notice: !ready ? "利用状況を確認中" : !row ? "この対戦・状況の記録なし" : null };
    }
    const profile = payload as HistoricalProductProfile;
    if (profile.player.id !== id) throw Error("Comparison identity mismatch");
    const { from, to } = c.condition === "season" || c.period === "season" ? { from: season.firstDate, to: season.lastDate } : dateWindow(season.lastDate, Number(c.period.replace("d", "")) as 7 | 14 | 30);
    const filter = (r: DatedBatter | DatedPitcher) => r.season === c.season && (c.condition === "season" || c.condition === "total" || c.condition === "home" && r.home || c.condition === "away" && !r.home || c.condition === "opponent" && r.opponentTeamId === c.opponent || c.condition === "order" && "battingOrder" in r && r.battingOrder === c.battingOrder || c.condition === "starter" && "starter" in r && r.starter === true || c.condition === "substitute" && "starter" in r && r.starter === false || c.condition === "pitcher-starter" && "role" in r && r.role === "starter" || c.condition === "reliever" && "role" in r && r.role === "reliever");
    const stats = c.role === "batting" ? battingAggregate(id, profile.batting.filter(filter), from, to) : pitchingAggregate(id, profile.pitching.filter(filter), from, to);
    return { id, date: to, coverage: season.coverage, metrics: stats.factCount ? stats.metrics : null, notice: !stats.factCount ? "この条件の記録なし" : season.coverage !== "complete" ? "一部データ確認中" : null };
  }, [cache, competition, manifest]);
  if (directory.status !== "ready") return directory.status === "loading" ? <LoadingSkeleton /> : <DataState kind="source-unavailable" title="選手一覧を読み込めません" />;
  return <CompareWorkspace league="MLB" competition={competition} players={directory.value!.players.filter(p => competition === "postseason" || !p.postseasonOnly).map(p => ({ id: p.id, name: p.name, seasons: p.seasons, ...historicalCompareRoles(p.positions) }))} teams={manifest.teams} seasons={manifest.seasons.map(s => s.season)} loader={loader} advanced={manifest.features?.directBvp === "available" || manifest.features?.situationalAnalysis === "available"} />;
}
