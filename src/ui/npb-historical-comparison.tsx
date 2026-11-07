import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { comparisonValue } from "../domain/product-comparison";
import { ComparisonBars } from "./comparison-bars";
import "./npb-historical-comparison.css";

type Role = "batting" | "pitching";
export type HistoricalContender = {
  id: string;
  name: string;
  season: number | null;
  age: number | null;
  teams?: string[];
  metrics: Record<string, number | null> | null;
  collectedYears?: number[] | undefined;
  reason?: string | null;
  fetchFailed?: boolean;
  annualSeason?: number | undefined;
  profileAvailable?: boolean;
  details?: ReactNode;
};

const metricLabels: Record<string, string> = { AVG: "打率", ERA: "防御率", HR: "本塁打", H: "安打", RBI: "打点", PA: "打席", SO: "奪三振", W: "勝利", outsRecorded: "投球回" };
const rateNotes: Record<string, string> = {
  AVG: "打率は通常、高い方がよい指標です。",
  OPS: "OPSは通常、高い方がよい指標です。",
  ERA: "防御率は通常、低い方がよい指標です。",
  WHIP: "WHIPは通常、低い方がよい指標です。",
};

function missingMetric(metrics: Record<string, number | null>, metric: string) {
  if (metrics[metric] != null) return null;
  if ((metric === "ERA" || metric === "WHIP") && metrics.outsRecorded === 0) return "記録された投球アウトが0のため算出できません。";
  if ((metric === "AVG" || metric === "OPS") && metrics.AB === 0) return "記録された打数が0のため算出できません。";
  return rateNotes[metric] ? "計算に必要な内訳が未収録です。" : "この指標は未収録です。";
}

export function NpbHistoricalComparison({ contenders, role, group, resultsLabel, options, metric, setMetric, add, remove, removeLabel, note, collected = false }: {
  contenders: HistoricalContender[];
  role: Role;
  group: string;
  resultsLabel: string;
  options: readonly string[];
  metric: string;
  setMetric: (metric: string) => void;
  add?: (() => void) | undefined;
  remove: (id: string) => void;
  removeLabel: string;
  note: string;
  collected?: boolean;
}) {
  if (!contenders.length) return null;
  const rows = contenders.map(p => ({
    id: p.id, name: p.name,
    metrics: p.metrics ? Object.fromEntries(Object.entries(p.metrics).map(([key, value]) =>
      [key, { value, status: value === null ? "unavailable" as const : "partial" as const }])) : null,
  }));
  const comparable = contenders.filter(p => p.metrics).length >= 2;
  const sampleKey = role === "batting" ? "PA" : "outsRecorded";
  const sampleLabel = metricLabels[sampleKey];
  return <section className="historical-comparison" aria-label={comparable ? resultsLabel : "選択した比較選手"}>
    <div className="historical-comparison-heading">
      <div><p className="eyebrow">NPB · 過去の公式戦</p><h3>{group}</h3></div>
      <label>比較指標<select value={metric} onChange={e => setMetric(e.target.value)}>
        {options.map(key => <option key={key} value={key}>{metricLabels[key] ?? key}</option>)}
      </select></label>
      {add && <button type="button" className="text-button historical-comparison-add" onClick={add}>選手を追加</button>}
    </div>
    {rateNotes[metric] && <p className="historical-comparison-interpretation">棒の長さは記録値。{rateNotes[metric]}</p>}
    <ComparisonBars rows={rows} metric={metric} context={{ label: metricLabels[metric] ?? metric, note, render: id => {
      const p = contenders.find(player => player.id === id)!;
      const base = `/NPB/players/${encodeURIComponent(id)}`;
      const sample = p.metrics?.[sampleKey] ?? null;
      const reason = p.reason ?? (p.metrics && missingMetric(p.metrics, metric));
      return <>
        <p className="historical-comparison-period">{p.season === null ? "対象年度未確認" : `${p.season}年${collected ? "まで" : ""}`} · {p.age === null ? "年末年齢未確認" : `年末${p.age}歳`}</p>
        {reason && <p className="historical-comparison-reason" role={p.fetchFailed ? "alert" : undefined}>{reason}</p>}
        {p.metrics && <dl className="historical-comparison-scope">
          <div><dt>母数（{sampleLabel}）</dt><dd>{sample === null ? "未収録" : `${comparisonValue(sampleKey, sample)}${role === "batting" ? "打席" : "回"}`}</dd></div>
          <div><dt>対象球団</dt><dd>{p.teams?.join(" / ") || "未確認"}</dd></div>
          <div><dt>収録範囲</dt><dd>球団別行の一部収録</dd></div>
        </dl>}
        {p.collectedYears?.length ? <p className="inline-note">合計対象：{p.collectedYears.join("・")}年。{p.season !== null && !p.collectedYears.includes(p.season) && " 対象年齢の年度は未収録です。"}</p> : null}
        <div className="historical-comparison-actions">
          {p.annualSeason !== undefined && <Link to={`${base}/seasons?season=${p.annualSeason}&role=${role}`}>{collected ? "最新の収録年度" : "年度成績・推移"} →</Link>}
          {p.profileAvailable && <Link to={base}>選手プロフィール →</Link>}
          <button className="text-button" type="button" aria-label={`${p.name}${removeLabel}`} onClick={() => remove(id)}>比較から外す</button>
        </div>
        {p.details}
      </>;
    } }} />
  </section>;
}
