import { comparisonPeriods, type ComparisonPeriod, type PlayerPeriodComparison } from "../domain/player-period-comparison";
import type { PlayerHomeAway } from "../domain/player-home-away";
import type { AggregateMetric } from "../domain/player-period";
import { formatDate } from "../presentation/formatters";
import { formatRecentMetric } from "../presentation/recent-formatter";
import { DataState, LoadingSkeleton, PageHeading, SectionHeader } from "./components";

type AnalysisState = "loading" | "ready" | "missing" | "error";
type Role = "batting" | "pitching";
const names: Record<ComparisonPeriod, string> = { "7d": "7日", "14d": "14日", "30d": "30日" };
const coverageNames = { complete: "収集確認済み", partial: "一部データ未収集",
  unknown: "一部期間の収集状況を確認できません", unavailable: "収集状況を確認できません" } as const;
const battingMetrics = [{ key: "OPS", label: "OPS" }, { key: "AVG", label: "AVG" },
  { key: "OBP", label: "OBP" }, { key: "SLG", label: "SLG" }] as const;
const pitchingMetrics = [{ key: "ERA", label: "ERA" }, { key: "K9", label: "K/9" }] as const;
const battingSamples = [{ key: "PA", label: "PA" }, { key: "H", label: "安打" },
  { key: "HR", label: "HR" }, { key: "BB", label: "四球" }, { key: "SO", label: "三振" }] as const;
const pitchingSamples = [{ key: "appearances", label: "登板" }, { key: "outsRecorded", label: "IP" },
  { key: "BF", label: "BF" }, { key: "H", label: "安打" }, { key: "HR", label: "HR" },
  { key: "SO", label: "三振" }, { key: "ER", label: "自責点" }] as const;

function RoleComparison({ payload, role }: { payload: PlayerPeriodComparison; role: Role }) {
  const first = comparisonPeriods.find((period) => payload.periods[period][role]);
  if (!first) return null;
  const metrics = role === "batting" ? battingMetrics : pitchingMetrics;
  const samples = role === "batting" ? battingSamples : pitchingSamples;
  return <section className="analysis-period-role" aria-label={role === "batting" ? "打撃の期間比較" : "投球の期間比較"}>
    <SectionHeader title={role === "batting" ? "打撃の比較" : "投球の比較"} />
    <p className="analysis-period-note">{role === "batting" ? "OPSを中心に、出塁率と長打率も比較します。" :
      "ERAとK/9を、登板数・投球回とあわせて確認できます。"}</p>
    <div className="analysis-period-metrics">{metrics.map(({ key, label }, index) => <div key={key}
      className={`analysis-period-metric${index === 0 ? " analysis-period-metric--primary" : ""}`}
      role="group" aria-label={`${label}の期間比較`}><strong>{label}</strong>
      <div className="analysis-period-metric__values">{comparisonPeriods.map((period) => <div key={period}>
        <span>{names[period]}</span><strong>{formatRecentMetric(key, payload.periods[period][role]?.metrics[key])}</strong>
      </div>)}</div></div>)}</div>
    <h3 className="analysis-period-sample-heading">集計対象と内訳</h3>
    <div className="analysis-period-samples">{comparisonPeriods.map((period) => {
      const result = payload.periods[period][role];
      const coverage = payload.periods[period].coverage;
      return <div className="analysis-period-sample" key={period}><div className="analysis-period-sample__heading">
        <strong>{names[period]}</strong><small>{result && `${formatDate(result.from, true)}〜${formatDate(result.to, true)}`}</small></div>
        {result ? <div className="analysis-period-sample__values">{samples.map(({ key, label }) => <span key={key}>
          {label} <strong>{formatRecentMetric(key, result.metrics[key])}</strong></span>)}</div> :
          <p className="muted">保存済みの出場記録なし</p>}
        <small className={`analysis-period-coverage analysis-period-coverage--${coverage.status}`}>
          {coverageNames[coverage.status]}</small>
      </div>;
    })}</div>
  </section>;
}

export function NpbPlayerAnalysisScreen({ payload, state }: { payload: PlayerPeriodComparison | null; state: AnalysisState }) {
  const hasFacts = payload && comparisonPeriods.some((period) =>
    payload.periods[period].batting || payload.periods[period].pitching);
  return <div className="analysis-screen npb-player-analysis">
    <PageHeading eyebrow="NPB / 選手分析" title="最近の傾向" level={2}
      detail="保存済みの試合成績から、直近7・14・30日を同時に比較" />
    {state === "loading" && <div aria-live="polite"><LoadingSkeleton /></div>}
    {state === "error" && <DataState kind="source-unavailable" title="分析データを取得できませんでした" />}
    {state === "missing" && <DataState kind="no-data" title="分析できる試合データがまだありません" />}
    {state === "ready" && payload && <><p className="analysis-cutoff">{formatDate(payload.asOfDate, true)}終了時点</p>
      {!hasFacts ? <DataState kind="no-data" title="分析できる試合データがまだありません" /> : <>
        <RoleComparison payload={payload} role="batting" />
        <RoleComparison payload={payload} role="pitching" />
      </>}</>}
  </div>;
}

type SplitResult = NonNullable<PlayerHomeAway["batting"]["home"]> |
  NonNullable<PlayerHomeAway["pitching"]["home"]>;
function splitMetric(result: SplitResult | null, key: string) {
  const metrics = result?.metrics as Record<string, AggregateMetric> | undefined;
  return formatRecentMetric(key, metrics?.[key]);
}

const splitDetails = {
  batting: [{ key: "AB", label: "打数" }, { key: "H", label: "安打" }, { key: "HR", label: "HR" },
    { key: "BB", label: "四球" }, { key: "SO", label: "三振" }, { key: "OBP", label: "OBP" },
    { key: "SLG", label: "SLG" }],
  pitching: [{ key: "appearances", label: "登板" }, { key: "GS", label: "先発" },
    { key: "BF", label: "BF" }, { key: "H", label: "安打" }, { key: "HR", label: "HR" },
    { key: "SO", label: "三振" }, { key: "R", label: "失点" }, { key: "ER", label: "自責点" },
    { key: "pitchCount", label: "投球数" }],
} as const;

function HomeAwayRole({ role, rows }: { role: Role; rows: PlayerHomeAway[Role] }) {
  if (!rows.totalFactCount) return null;
  const label = role === "batting" ? "打撃" : "投球";
  const primary = role === "batting" ? [{ key: "OPS", label: "OPS" }, { key: "AVG", label: "AVG" },
    { key: "PA", label: "PA" }, { key: "G", label: "試合" }] :
    [{ key: "ERA", label: "ERA" }, { key: "K9", label: "K/9" },
      { key: "outsRecorded", label: "IP" }, { key: "BF", label: "BF" }];
  return <section className="analysis-split-role" aria-label={`${label}のホーム・ビジター比較`}>
    <h3>{label}</h3><div className="analysis-split-grid">{(["home", "away"] as const).map((side) => {
      const result = rows[side];
      const sideName = side === "home" ? "ホーム" : "ビジター";
      return <div className="analysis-split-card" key={side} role="group" aria-label={`${label} ${sideName}`}>
        <h4>{sideName}</h4>{result ? <>
          <div className="analysis-split-primary">{primary.map(({ key, label: name }) => <div key={key}>
            <span>{name}</span><strong>{splitMetric(result, key)}</strong></div>)}</div>
          {role === "pitching" && <p className="analysis-split-sample">{splitMetric(result, "appearances")}登板 · BF {splitMetric(result, "BF")}</p>}
          <details className="analysis-split-details"><summary>詳しい成績</summary>
            <dl>{splitDetails[role].map(({ key, label: name }) => <div key={key}><dt>{name}</dt>
              <dd>{splitMetric(result, key)}</dd></div>)}</dl></details>
        </> : <p className="muted">保存済み{sideName}成績なし</p>}</div>;
    })}</div>
    {rows.unknownFactCount > 0 && <p className="analysis-period-note">分類できない{label}記録：{rows.unknownFactCount}件</p>}
  </section>;
}

export function NpbPlayerHomeAwaySection({ payload, state }: { payload: PlayerHomeAway | null; state: AnalysisState }) {
  const hasFacts = payload && (payload.batting.totalFactCount > 0 || payload.pitching.totalFactCount > 0);
  return <section className="analysis-home-away" aria-label="ホーム・ビジター条件別分析">
    <SectionHeader title="ホーム / ビジター" />
    <p className="analysis-period-note">保存済みの直近30日試合成績を、開催側で分けて比較します。</p>
    {state === "loading" && <div aria-live="polite"><LoadingSkeleton /></div>}
    {state === "error" && <DataState kind="source-unavailable" title="ホーム・ビジター成績を取得できませんでした" />}
    {state === "missing" && <DataState kind="no-data" title="分析できる試合データがまだありません" />}
    {state === "ready" && payload && (!hasFacts
      ? <DataState kind="no-data" title="分析できる試合データがまだありません" />
      : <><p className="analysis-period-note">{formatDate(payload.from, true)}〜{formatDate(payload.to, true)} · {formatDate(payload.asOfDate, true)}終了時点</p>
        <HomeAwayRole role="batting" rows={payload.batting} />
        <HomeAwayRole role="pitching" rows={payload.pitching} />
        {payload.capability === "unavailable" && <p className="analysis-period-note">開催側を確認できる記録がありません。</p>}
        {payload.coverage.status !== "complete" && <p className={`analysis-period-coverage analysis-period-coverage--${payload.coverage.status}`}>
          {coverageNames[payload.coverage.status]}。表示値は保存済み記録から算出しています。</p>}
      </>)}
  </section>;
}
