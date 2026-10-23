import { comparisonValue, metricNumber, type ComparisonRow } from "../domain/product-comparison";
import { MetricLabel } from "./components";

/** Visual scale only; missing values produce no bar, never an invented zero. */
export function ComparisonBars({ rows, metric }: { rows: ComparisonRow[]; metric: string }) {
  const maximum = Math.max(1, ...rows.map(row => Math.abs(metricNumber(row.metrics, metric) ?? 0)));
  const label = ({ runDifference: "得失点差", runsFor: "得点", runsAgainst: "失点", W: "勝利", L: "敗戦", T: "引分", G: "試合", outsRecorded: "IP", K9: "K/9", BB9: "BB/9" } as Record<string, string>)[metric] ?? metric;
  return <figure className={`comparison-bars${rows.length === 2 ? " comparison-bars--duel" : ""}`}><figcaption><MetricLabel metric={metric} label={label} /></figcaption><div className="comparison-contenders">{rows.map(row => {
    const value = metricNumber(row.metrics, metric);
    return <div className="comparison-bar" key={row.id}><strong>{row.name}</strong><div className="comparison-bar__track" aria-hidden="true">{value !== null && <span className={value < 0 ? "negative" : ""} style={{ width: `${Math.abs(value) / maximum * 100}%` }} />}</div><span>{comparisonValue(metric, value)}{row.metrics?.[metric]?.status === "partial" && " *"}</span></div>;
  })}</div><small>保存済み集計の比較。順位や優劣の判定ではありません。</small></figure>;
}
