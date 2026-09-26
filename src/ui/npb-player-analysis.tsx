import { comparisonPeriods, type ComparisonPeriod, type PlayerPeriodComparison } from "../domain/player-period-comparison";
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
