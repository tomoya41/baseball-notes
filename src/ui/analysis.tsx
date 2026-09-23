import { useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import type { AnalysisProvider } from "../application/ports";
import { samplePolicy } from "../app/analysis-policy";
import { capabilityManifestSchema, sampleWarning } from "../domain/analysis";
import type { AnalysisCapabilities, AnalysisQuery, AnalysisResult, CapabilityId, Split } from "../domain/analysis";
import { assessAnalysisQuery } from "../domain/analysis-query";
import { pitchTypeDefinitions } from "../domain/baseball-terms";
import { metrics } from "../domain/metrics";
import type { Player, PlayerCatalog } from "../domain/models";
import {
  analysisFilters, categoryLabels, comparisonSample, formatFilterSummary, formatMetricDelta, formatSplitMetric, makeAnalysisQuery,
  metricRelativeLabel, scoreLabels, situationGroups, splitSample, splitWarning, visibleSplitRows,
} from "../presentation/analysis";
import type { AnalysisCategory, AnalysisSubject, CountMode, SituationGroup } from "../presentation/analysis";
import { formatDate, formatPitchType } from "../presentation/formatters";
import { DataState, LoadingSkeleton, MetricInfo, PageHeading, PlayerRow, SectionHeader } from "./components";
import { useAnalysisData } from "./use-analysis-data";

function canUse(manifest: AnalysisCapabilities, id: CapabilityId): boolean {
  const feature = manifest.features[id];
  return feature.status === "available" && feature.implementation === "implemented";
}

export function SampleBadge({ split, subject, group, warningContext }: {
  split: Split; subject: AnalysisSubject; group: AnalysisQuery["groupBy"]; warningContext?: "directMatchup";
}) {
  const warning = warningContext ? sampleWarning(split.sampleSize, warningContext, samplePolicy)
    : splitWarning(split, subject, group, samplePolicy);
  return <span className="analysis-sample">{splitSample(split, subject, group)}
    {warning && <span className="sample-warning" title={warning}>{warning.includes("不明") ? "母数不明" : "参考値"}</span>}
  </span>;
}

function PercentileBar({ metric, league }: { metric: Split["metrics"][number]; league: PlayerCatalog["league"] }) {
  const definition = metrics[metric.definitionId];
  const comparison = metric.comparison;
  const label = metricRelativeLabel(metric, league);
  if (!definition || !comparison || !label || comparison.percentile === null) return null;
  const position = definition.percentileBasis === "raw-value" && definition.higherIsBetter === false
    ? 100 - comparison.percentile : comparison.percentile;
  return <div className="percentile-context">
    <span>{label}</span>
    <div className="percentile-bar" role="img" aria-label={label}>
      <span style={{ width: `${position}%` }} /></div>
    {comparisonSample(comparison.sampleSize) && <small>比較母数 {comparisonSample(comparison.sampleSize)}</small>}
  </div>;
}

export function SplitMetrics({ split, league, compact = false }: { split: Split; league: PlayerCatalog["league"]; compact?: boolean }) {
  const visible = split.metrics.filter((item) => metrics[item.definitionId]);
  return <div className={compact ? "analysis-metrics analysis-metrics--compact" : "analysis-metrics"}>
    {(compact ? visible.slice(0, 2) : visible).map((item) => {
      const definition = metrics[item.definitionId]!;
      const comparison = item.comparison;
      return <div className="analysis-metric" key={item.definitionId}>
        <div className="analysis-metric__label"><span>{definition.name}</span>
          {!compact && definition.advanced && <MetricInfo definition={definition} />}</div>
        <strong>{formatSplitMetric(item)}</strong>
        {!compact && comparison?.leagueAverage !== null && comparison?.leagueAverage !== undefined &&
          <small>{comparison.population}平均 {formatSplitMetric({ ...item,
            value: { status: "available", value: comparison.leagueAverage } })}</small>}
        {!compact && <PercentileBar metric={item} league={league} />}
      </div>;
    })}
  </div>;
}

function PitchRows({ splits, subject, group, league }: {
  splits: Split[]; subject: AnalysisSubject; group: AnalysisQuery["groupBy"]; league: PlayerCatalog["league"];
}) {
  return <div className="analysis-list">{splits.map((split) => {
    const type = Object.hasOwn(pitchTypeDefinitions, split.key) ? split.key as keyof typeof pitchTypeDefinitions : null;
    const usage = split.metrics.find((item) => item.definitionId === "usagePct" && item.value.status === "available");
    const share = usage?.value.status === "available" ? Math.max(0, Math.min(100, usage.value.value * 100)) : 0;
    return <details className="analysis-row" key={split.key}>
      <summary><span className={`pitch-mark${type ? ` pitch-mark--${type}` : ""}`} aria-hidden="true" />
        <span className="analysis-row__label"><strong>{type ? formatPitchType(type) : split.label}</strong>
          <SampleBadge split={split} subject={subject} group={group} /></span>
        {usage && <strong className="analysis-row__value">{formatSplitMetric(usage)}</strong>}
        {!usage && <SplitMetrics split={split} league={league} compact />}
        <ChevronRight size={18} aria-hidden="true" /></summary>
      {subject === "pitcher" && usage && <div className="pitch-usage" aria-label={`${type ? formatPitchType(type) : split.label} 使用率 ${formatSplitMetric(usage)}`}>
        <span style={{ width: `${share}%` }} /></div>}
      <div className="analysis-row__detail"><SplitMetrics split={split} league={league} /></div>
    </details>;
  })}</div>;
}

function SplitRows({ splits, subject, group, league }: {
  splits: Split[]; subject: AnalysisSubject; group: AnalysisQuery["groupBy"]; league: PlayerCatalog["league"];
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = visibleSplitRows(splits, group, expanded);
  return <><div className="analysis-list">{shown.map((split) => <details className="analysis-row" key={split.key}>
    <summary><span className="analysis-row__label"><strong>{split.label}</strong>
      <SampleBadge split={split} subject={subject} group={group} /></span>
      <SplitMetrics split={split} league={league} compact /><ChevronRight size={18} aria-hidden="true" /></summary>
    <div className="analysis-row__detail"><SplitMetrics split={split} league={league} /></div>
  </details>)}</div>
  {splits.length > shown.length && <button className="analysis-more" type="button"
    onClick={() => setExpanded(true)}>{group === "count" ? "全カウントを見る" : "各回を見る"}<ArrowRight size={16} /></button>}
  </>;
}

function ZoneGrid({ result, subject, league }: { result: AnalysisResult; subject: AnalysisSubject; league: PlayerCatalog["league"] }) {
  if (result.status !== "data" || !result.coordinates) return <DataState kind="no-data" title="コース集計がありません" />;
  const cells = new Map(result.splits.map((split) => [split.key, split]));
  if (cells.size !== 9 || Array.from({ length: 3 }, (_, row) => Array.from({ length: 3 }, (_, col) =>
    cells.has(`${row + 1}:${col + 1}`))).flat().includes(false))
    return <DataState kind="no-data" title="3×3のコース集計はありません" />;
  const viewpoint = result.coordinates.viewpoint === "pitcher" ? "投手から見た" :
    result.coordinates.viewpoint === "catcher" ? "捕手から見た" : "提供元定義の";
  return <div className="zone-container"><p className="muted">{viewpoint}ストライクゾーン · {result.coordinates.zoneDefinition}</p>
    <div className="zone-grid" role="group" aria-label="3×3コース分析">{Array.from({ length: 9 }, (_, index) => {
      const row = Math.floor(index / 3) + 1;
      const col = index % 3 + 1;
      const split = cells.get(`${row}:${col}`)!;
      const metric = split.metrics.find((item) => metrics[item.definitionId]);
      return <div className="zone-cell" key={split.key} aria-label={`${split.label} ${splitSample(split, subject)}`}>
        <small>{split.label}</small><strong>{metric ? formatSplitMetric(metric) : "—"}</strong>
        <SampleBadge split={split} subject={subject} group="zone" />
        {metric && <PercentileBar metric={metric} league={league} />}
      </div>;
    })}</div></div>;
}

export function AnalysisDataView({ result, category, subject, league }: {
  result: Extract<AnalysisResult, { status: "data" }>;
  category: AnalysisCategory; subject: AnalysisSubject; league: PlayerCatalog["league"];
}) {
  const group = result.query.groupBy;
  if (category === "zone") return <ZoneGrid result={result} subject={subject} league={league} />;
  if (category === "pitch") return <PitchRows splits={result.splits} subject={subject} group={group} league={league} />;
  if (category === "summary" || category === "batted") return <div className="analysis-summary">
    {result.splits.slice(0, 3).map((split) => <div className="analysis-summary__item" key={split.key}>
      <strong>{split.label}</strong><SampleBadge split={split} subject={subject} group={group} />
      <SplitMetrics split={split} league={league} /></div>)}
  </div>;
  return <SplitRows key={group} splits={result.splits} subject={subject} group={group} league={league} />;
}

function AnalysisFilter({ manifest, subject, period, setPeriod, filters, setFilters, asOfDate, countMode, setCountMode }: {
  manifest: AnalysisCapabilities; subject: AnalysisSubject; period: AnalysisQuery["period"];
  setPeriod: (period: AnalysisQuery["period"]) => void; filters: AnalysisQuery["filters"];
  setFilters: (filters: AnalysisQuery["filters"]) => void; asOfDate: string;
  countMode: CountMode; setCountMode: (mode: CountMode) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [dateError, setDateError] = useState("");
  const update = (patch: Partial<AnalysisQuery["filters"]>) => setFilters({ ...filters, ...patch });
  return <div className="analysis-filter">
    <div className="chip-list" role="group" aria-label="分析期間">{[7, 14, 30].map((days) =>
      <button key={days} className="filter-chip" type="button" disabled={!canUse(manifest, "recentForm")}
        aria-pressed={period.kind === "last-days" && period.days === days}
        onClick={() => setPeriod({ kind: "last-days", days: days as 7 | 14 | 30 })}>{days}日</button>)}
      <button className="filter-chip" type="button" aria-pressed={period.kind === "season"}
        onClick={() => setPeriod({ kind: "season", year: Number(asOfDate.slice(0, 4)) })}>シーズン</button></div>
    <div className="analysis-filter__second"><div className="chip-list" role="group" aria-label="相手の左右">
      {(["all", "R", "L"] as const).map((hand) => <button className="filter-chip" type="button" key={hand}
        disabled={hand !== "all" && !canUse(manifest, "handednessSplit")}
        aria-pressed={hand === "all" ? filters.opponent.kind === "all"
          : filters.opponent.kind === "handedness" && filters.opponent.hand === hand}
        onClick={() => update({ opponent: hand === "all" ? { kind: "all" } : { kind: "handedness", hand } })}>
        {hand === "all" ? "左右すべて" : subject === "batter" ? `対${hand}投手` : `対${hand}打者`}</button>)}
    </div><button className="filter-open" type="button" onClick={() => dialog.current?.showModal()}>
      <SlidersHorizontal size={18} />詳細条件</button></div>
    <p className="filter-summary">{formatFilterSummary(period, filters)}</p>
    <dialog ref={dialog} className="filter-dialog" aria-label="分析の詳細条件">
      <div className="filter-dialog__body"><h2>詳細条件</h2>
        <label>期間<select value={period.kind === "custom" ? "custom" : period.kind === "last-days" ? `last-${period.days}` : period.kind}
          onChange={(event) => {
            const kind = event.target.value;
            if (kind.startsWith("last-")) setPeriod({ kind: "last-days", days: Number(kind.slice(5)) as 7 | 14 | 30 });
            if (kind === "current-month" || kind === "previous-month") setPeriod({ kind });
            if (kind === "season") setPeriod({ kind: "season", year: Number(asOfDate.slice(0, 4)) });
          }}>
          <option value="season">シーズン</option>
          {[7, 14, 30].map((days) => <option key={days} value={`last-${days}`} disabled={!canUse(manifest, "recentForm")}>直近{days}日</option>)}
          <option value="current-month" disabled={!canUse(manifest, "monthlySplit")}>今月</option>
          <option value="previous-month" disabled={!canUse(manifest, "monthlySplit")}>前月</option>
          {period.kind === "custom" && <option value="custom">指定期間</option>}
        </select></label>
        <fieldset disabled={!canUse(manifest, "dateRange")}><legend>期間指定</legend>
          <div className="filter-date"><input type="date" aria-label="開始日" value={start} onChange={(event) => setStart(event.target.value)} />
            <input type="date" aria-label="終了日" value={end} max={asOfDate} onChange={(event) => setEnd(event.target.value)} /></div>
          <button className="filter-apply" type="button" onClick={() => {
            if (!start || !end || start > end || end >= asOfDate) { setDateError("前日までの正しい期間を指定してください"); return; }
            setDateError(""); setPeriod({ kind: "custom", startDate: start, endDate: end }); dialog.current?.close();
          }}>期間を適用</button>{dateError && <small className="warning">{dateError}</small>}
        </fieldset>
        <label>カウント<select disabled={!canUse(manifest, "countSplit")} value={filters.count.kind}
          onChange={(event) => update({ count: { kind: event.target.value as "all" | "first-pitch" | "pitcher-ahead" | "batter-ahead" | "two-strikes" | "full-count" } })}>
          <option value="all">すべて</option><option value="first-pitch">初球</option><option value="pitcher-ahead">投手有利</option>
          <option value="batter-ahead">打者有利</option><option value="two-strikes">2ストライク</option><option value="full-count">フルカウント</option>
        </select></label>
        <label>カウントの母集団<select disabled={!canUse(manifest, "countSplit")} value={countMode}
          onChange={(event) => setCountMode(event.target.value as CountMode)}>
          <option value="reached">到達打席の最終結果</option><option value="pitch">その時の投球反応</option>
        </select></label>
        <label>走者<select disabled={!canUse(manifest, "baseSplit")} value={filters.bases}
          onChange={(event) => update({ bases: event.target.value as AnalysisQuery["filters"]["bases"] })}>
          <option value="all">すべて</option><option value="empty">走者なし</option><option value="runners-on">走者あり</option>
          <option value="risp">得点圏</option><option value="loaded">満塁</option></select></label>
        <label>アウト<select disabled={!canUse(manifest, "outsSplit")} value={filters.outs ?? "all"}
          onChange={(event) => update({ outs: event.target.value === "all" ? null : Number(event.target.value) as 0 | 1 | 2 })}>
          <option value="all">すべて</option><option value="0">0アウト</option><option value="1">1アウト</option><option value="2">2アウト</option></select></label>
        {subject === "batter" && <label>打順<select disabled={!canUse(manifest, "battingOrderSplit")} value={filters.battingOrder ?? "all"}
          onChange={(event) => update({ battingOrder: event.target.value === "all" ? null : Number(event.target.value) })}>
          <option value="all">すべて</option>{Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 1}>{i + 1}番</option>)}</select></label>}
        <label>打席開始時点の点差<select disabled={!canUse(manifest, "scoreDifferentialSplit")}
          value={filters.scoreDifferential.kind === "bucket" ? filters.scoreDifferential.value : "all"}
          onChange={(event) => update({ scoreDifferential: event.target.value === "all" ? { kind: "all" }
            : { kind: "bucket", value: event.target.value as keyof typeof scoreLabels } })}>
          <option value="all">すべて</option>{Object.entries(scoreLabels).map(([key, label]) =>
            <option key={key} value={key}>{label}</option>)}</select></label>
        <label>試合イニング<select disabled={!canUse(manifest, "gameInningSplit")}
          value={filters.gameInning?.from ?? "all"} onChange={(event) => {
            const from = Number(event.target.value);
            update({ gameInning: event.target.value === "all" ? null : { from, through: from === 1 ? 3 : from === 4 ? 6 : from === 7 ? 9 : null } });
          }}><option value="all">すべて</option><option value="1">1〜3回</option><option value="4">4〜6回</option>
          <option value="7">7〜9回</option><option value="10">延長</option></select></label>
        {subject === "pitcher" && <label>登板内イニング順<select disabled={!canUse(manifest, "appearanceInningSplit")}
          value={filters.appearanceInning?.from ?? "all"} onChange={(event) => {
            const from = Number(event.target.value);
            update({ appearanceInning: event.target.value === "all" ? null : { from, through: from < 4 ? from : null } });
          }}><option value="all">すべて</option><option value="1">登板1イニング目</option>
          <option value="2">登板2イニング目</option><option value="3">登板3イニング目</option>
          <option value="4">4イニング目以降</option></select></label>}
        <label>球種<select disabled={!canUse(manifest, subject === "pitcher" ? "pitchMix" : "pitchTypeSplit")}
          value={filters.pitchType ?? "all"} onChange={(event) => update({ pitchType: event.target.value === "all" ? null : event.target.value })}>
          <option value="all">すべて</option>{Object.entries(pitchTypeDefinitions).map(([key, value]) =>
            <option key={key} value={key}>{value.ja}</option>)}</select></label>
        <label>球速帯<select disabled={!canUse(manifest, "pitchVelocity")}
          value={filters.velocity?.minInclusive ?? "all"} onChange={(event) => {
            const min = Number(event.target.value);
            update({ velocity: event.target.value === "all" ? null : { unit: "km/h", minInclusive: min, maxExclusive: min === 150 ? 155 : min === 155 ? 160 : null } });
          }}><option value="all">すべて</option><option value="150">150〜155 km/h</option>
          <option value="155">155〜160 km/h</option><option value="160">160 km/h以上</option></select></label>
      </div><form method="dialog"><button className="button" type="submit">閉じる</button></form>
    </dialog>
  </div>;
}

export function RecentChange({ provider, query, manifest, subject }: {
  provider: AnalysisProvider; query: AnalysisQuery; manifest: AnalysisCapabilities;
  subject: AnalysisSubject;
}) {
  const seasonQuery: AnalysisQuery = useMemo(() => ({ ...query, groupBy: "none",
    period: { kind: "season", year: Number(query.asOfDate.slice(0, 4)) } }), [query]);
  const recentQuery: AnalysisQuery = useMemo(() => ({ ...seasonQuery,
    period: { kind: "last-days", days: 30 } }), [seasonQuery]);
  const seasonGate = assessAnalysisQuery(seasonQuery, manifest);
  const recentGate = assessAnalysisQuery(recentQuery, manifest);
  const season = useAnalysisData(provider, seasonQuery, seasonGate.enabled);
  const recent = useAnalysisData(provider, recentQuery, recentGate.enabled);
  if (!seasonGate.enabled || !recentGate.enabled) return <DataState kind="unsupported" title="最近の変化は利用できません"
    detail={!recentGate.enabled ? recentGate.reason : !seasonGate.enabled ? seasonGate.reason : "比較条件は未対応です"} />;
  if (season.error || recent.error) return <DataState kind="source-unavailable" />;
  if (!season.result || !recent.result) return <LoadingSkeleton />;
  if (season.result.status !== "data" || recent.result.status !== "data") return <DataState kind="no-data" title="比較できる期間データがありません" />;
  const baseline = season.result.splits[0];
  const current = recent.result.splits[0];
  if (!baseline || !current) return <DataState kind="no-data" />;
  const warning = splitWarning(current, subject, "none", samplePolicy);
  return <div className="analysis-change"><p className="muted">直近30日とシーズン全体の差 · {formatDate(recent.result.coverage.completeThrough, true)}まで</p>
    <p className="analysis-sample">直近 {splitSample(current, subject)}{warning &&
      <span className="sample-warning">{warning.includes("不明") ? "母数不明" : "参考値"}</span>}</p>
    {(season.result.freshness.state === "stale" || recent.result.freshness.state === "stale") &&
      <DataState kind="source-unavailable" title="保存済みの古い分析データです" />}
    {current.metrics.map((item) => {
      const prior = baseline.metrics.find((metric) => metric.definitionId === item.definitionId);
      const definition = metrics[item.definitionId];
      if (!prior || !definition || item.value.status !== "available" || prior.value.status !== "available" ||
        item.sourceUnit !== prior.sourceUnit) return null;
      const delta = item.value.value - prior.value.value;
      return <div className="change-row" key={item.definitionId}><strong>{definition.name}</strong>
        <span>{formatSplitMetric(prior)} <ArrowRight size={15} aria-hidden="true" /> {formatSplitMetric(item)}</span>
        <strong>{formatMetricDelta(delta, item.definitionId, item.sourceUnit)}</strong></div>;
    })}
  </div>;
}

export function AnalysisScreen({ catalog, player, provider }: {
  catalog: PlayerCatalog; player: Player; provider: AnalysisProvider;
}) {
  const playerStats = catalog.statistics.filter((item) => item.playerId === player.id);
  const hasHitting = playerStats.some((item) => item.group === "hitting");
  const hasPitching = playerStats.some((item) => item.group === "pitching");
  const [subject, setSubject] = useState<AnalysisSubject>(hasHitting ? "batter" : "pitcher");
  const season = playerStats.length ? Math.max(...playerStats.map((item) => item.season)) : new Date().getFullYear();
  const manifest = useMemo(() => capabilityManifestSchema.parse(provider.capabilities(catalog.league)), [provider, catalog.league]);
  const [category, setCategory] = useState<AnalysisCategory>("summary");
  const [battedMode, setBattedMode] = useState<"batted" | "zone">("batted");
  const [situation, setSituation] = useState<SituationGroup>("handedness");
  const [countMode, setCountMode] = useState<CountMode>("reached");
  const [period, setPeriod] = useState<AnalysisQuery["period"]>({ kind: "season", year: season });
  const [filters, setFilters] = useState<AnalysisQuery["filters"]>(analysisFilters);
  const resolvedCategory = category === "batted" && battedMode === "zone" ? "zone" : category;
  const query = useMemo(() => makeAnalysisQuery({ league: catalog.league, playerId: player.id, subject,
    category: resolvedCategory, situation, countMode, period, filters, manifest }),
  [catalog.league, player.id, subject, resolvedCategory, situation, countMode, period, filters, manifest]);
  const gate = assessAnalysisQuery(query, manifest);
  const data = useAnalysisData(provider, query, gate.enabled && category !== "recent");
  const updateCategory = (next: AnalysisCategory) => { setCategory(next); setSituation("handedness"); };
  const result = data.result;
  return <div className="analysis-screen">
    <PageHeading eyebrow={`${catalog.league} / ${subject === "batter" ? "打者分析" : "投手分析"}`} title="分析" level={2}
      detail={subject === "batter" ? "打撃の特徴を、条件ごとに見る" : "投球の特徴を、条件ごとに見る"} />
    {hasHitting && hasPitching && <div className="segmented" role="group" aria-label="分析対象">
      <button type="button" aria-pressed={subject === "batter"} onClick={() => { setSubject("batter"); setCategory("summary"); setFilters(analysisFilters); }}>打者</button>
      <button type="button" aria-pressed={subject === "pitcher"} onClick={() => { setSubject("pitcher"); setCategory("summary"); setFilters(analysisFilters); }}>投手</button>
    </div>}
    <p className="analysis-cutoff">分析データは前日終了時点 · {result && (result.status === "data" || result.status === "empty")
      ? `${formatDate(result.coverage.completeThrough, true)}更新` : "更新日時はデータ取得後に表示"}</p>
    {category !== "summary" && <AnalysisFilter manifest={manifest} subject={subject} period={period} setPeriod={setPeriod}
      filters={filters} setFilters={setFilters} asOfDate={query.asOfDate} countMode={countMode} setCountMode={setCountMode} />}
    <nav className="analysis-nav chip-list" aria-label="分析カテゴリー">{categoryLabels[subject].map((item) =>
      <button className="filter-chip" type="button" key={item.id} aria-current={category === item.id ? "page" : undefined}
        onClick={() => updateCategory(item.id)}>{item.label}</button>)}</nav>
    {category === "situation" && <div className="analysis-subnav chip-list" role="group" aria-label="状況の種類">
      {situationGroups[subject].map((item) => <button key={item.id} className="filter-chip" type="button"
        aria-pressed={situation === item.id} onClick={() => setSituation(item.id)}>{item.label}</button>)}</div>}
    {category === "batted" && <div className="segmented" role="group" aria-label="打球とコース">
      <button type="button" aria-pressed={battedMode === "batted"} onClick={() => setBattedMode("batted")}>打球</button>
      <button type="button" aria-pressed={battedMode === "zone"} onClick={() => setBattedMode("zone")}>コース</button>
    </div>}
    {category === "count" && <div className="segmented" role="group" aria-label="カウント集計の意味">
      <button type="button" aria-pressed={countMode === "reached"} onClick={() => setCountMode("reached")}>到達打席の最終成績</button>
      <button type="button" aria-pressed={countMode === "pitch"} onClick={() => setCountMode("pitch")}>その時の投球反応</button></div>}
    <section className="analysis-content"><SectionHeader title={category === "summary" ? "主な数字" : category === "pitch"
      ? subject === "pitcher" ? "球種と使用割合" : "球種別の成績" : category === "count" ? "カウント別"
        : category === "situation" ? situationGroups[subject].find((item) => item.id === situation)?.label ?? "状況"
          : category === "recent" ? "最近何が変わった？" : resolvedCategory === "zone" ? "コース" : "打球"} />
      {category === "count" && <p className="muted">{countMode === "reached"
        ? "そのカウントまで到達した打席の最終結果" : "そのカウントで投じられた球への反応"}</p>}
      {category === "situation" && situation === "score-differential" && <p className="muted">打席開始時点の点差。接戦での強さを断定しません。</p>}
      {category === "situation" && situation === "appearance-inning" && <p className="muted">試合の何回かではなく、その投手が登板してから何イニング目か。</p>}
      {category === "recent" ? <RecentChange provider={provider} query={query} manifest={manifest}
        subject={subject} /> : !gate.enabled
        ? <DataState kind={gate.status === "not-implemented" ? "not-implemented" : "unsupported"}
          title={gate.status === "not-implemented" ? "この分析は準備中です" : "この条件の分析データはありません"}
          detail={gate.reason} />
        : data.error ? <DataState kind="source-unavailable" detail={data.error} />
          : !result ? <LoadingSkeleton /> : result.status === "empty" ? <DataState kind="no-data" detail={result.reason} />
            : result.status !== "data" ? <DataState kind={result.status === "not-implemented" ? "not-implemented" :
              result.status === "error" ? "source-unavailable" : "unsupported"} detail={result.reason} />
              : <AnalysisDataView result={result} category={resolvedCategory} subject={subject} league={catalog.league} />}
      {result && (result.status === "data" || result.status === "empty") && result.freshness.state === "stale" &&
        <DataState kind="source-unavailable" title="保存済みの古い分析データです" />}
    </section>
    {category === "summary" && <AnalysisFilter manifest={manifest} subject={subject} period={period} setPeriod={setPeriod}
      filters={filters} setFilters={setFilters} asOfDate={query.asOfDate} countMode={countMode} setCountMode={setCountMode} />}
  </div>;
}

export function AnalysisDirectory({ catalog, provider, favorites }: {
  catalog: PlayerCatalog; provider: AnalysisProvider; favorites: import("../domain/models").Favorite[];
}) {
  const manifest = capabilityManifestSchema.parse(provider.capabilities(catalog.league));
  const supported = manifest.subjects.length > 0 && canUse(manifest, "basicStats");
  return <div className="screen"><PageHeading eyebrow={`${catalog.league} / 分析`} title="分析" detail="選手を選んで、特徴を詳しく見る" />
    <Link className="ranking-entry" to={`/${catalog.league}/matchup`}><span><strong>投手 × 打者 MATCHUP</strong>
      <small>2人を選んで対戦の傾向を見る</small></span><ChevronRight size={19} /></Link>
    {!supported && <DataState kind="unsupported" title="現在の提供元に分析データはありません"
      detail={manifest.features.basicStats.reason} />}
    <SectionHeader title="選手を選ぶ" />
    <div className="row-list">{catalog.profiles.map(({ player }) => <PlayerRow key={player.id} player={player}
      catalog={catalog} favorites={favorites} to={`/${catalog.league}/players/${encodeURIComponent(player.id)}/analysis`} />)}</div>
  </div>;
}
