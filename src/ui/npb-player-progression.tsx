import { Link, useSearchParams } from "react-router-dom";
import { bestObservedSeasons, historicalProgression, observedClubChanges, progressionMetrics, type ProgressionMetric } from "../domain/npb-player-progression";
import type { NpbHistoricalRow } from "../domain/npb-historical";
import { comparisonValue } from "../domain/product-comparison";
import { MetricLabel } from "./components";
import { NpbClubComparison } from "./npb-club-comparison";

export function NpbPlayerProgression({ rows, years, teamName }: { rows: NpbHistoricalRow[]; years: number[]; teamName: (id: string) => string }) {
  const [params, setParams] = useSearchParams();
  const role = rows[0]?.role ?? "batting";
  const options: ProgressionMetric[] = role === "batting" ? ["OPS", "AVG", "HR", "H", "RBI", "PA", "G"] : ["ERA", "SO", "outsRecorded", "G", "WHIP", "K9", "BB9"];
  const raw = params.get("trendMetric"), metric = options.includes(raw as ProgressionMetric) ? raw as ProgressionMetric : options[0]!;
  const points = historicalProgression(rows, years), best = bestObservedSeasons(points, metric);
  const finite = points.flatMap(p => p.metrics[metric] == null ? [] : [p.metrics[metric]!]);
  const min = Math.min(0, ...finite), max = Math.max(1, ...finite);
  const x = (year: number) => 24 + (year - Math.min(...years)) / Math.max(1, Math.max(...years) - Math.min(...years)) * 272;
  const y = (v: number) => 130 - (v - min) / (max - min) * 100;
  const label = metric === "outsRecorded" ? "投球回" : metric === "K9" ? "K/9" : metric === "BB9" ? "BB/9" : metric;
  return <section className="player-progression" aria-label="年度別成績の推移">
    <h3>成績の変化</h3>
    <label>推移指標<select value={metric} onChange={e => setParams(previous => { const next = new URLSearchParams(previous); next.set("trendMetric", e.target.value); return next; })}>{options.filter(k => progressionMetrics.includes(k)).map(k => <option key={k} value={k}>{k === "outsRecorded" ? "投球回" : k}</option>)}</select></label>
    <p><MetricLabel metric={metric} label={label} /> · 選択年度の収録分。欠損年度は線でつなぎません。</p>
    <svg viewBox="0 0 320 166" role="img" aria-label={`${label}の年度推移。正確な値と欠損は下の年度一覧で確認できます`} style={{ width: "100%", maxWidth: 640, height: "auto", color: "var(--accent)" }}>
      <line x1="24" y1="130" x2="296" y2="130" stroke="currentColor" opacity=".3" />
      {points.map((p, i) => { const v = p.metrics[metric], previous = points[i - 1], pv = previous?.metrics[metric]; return <g key={p.season}>
        {v != null && pv != null && previous && p.season === previous.season + 1 && <line x1={x(previous.season)} y1={y(pv)} x2={x(p.season)} y2={y(v)} stroke="currentColor" strokeWidth="2" />}
        {v != null && <circle cx={x(p.season)} cy={y(v)} r="4" fill="currentColor"><title>{p.season}年 {comparisonValue(metric, v)}</title></circle>}
        <text x={x(p.season)} y="156" textAnchor="middle" fill="currentColor" fontSize="12">{p.season}</text>
      </g>; })}
    </svg>
    <dl className="explorer-values">{points.map(p => <div key={p.season}><dt>{p.season}年 · {p.teams.length ? p.teams.map(teamName).join(" / ") : "未収録"}</dt><dd>{comparisonValue(metric, p.metrics[metric] ?? null)}<small style={{ display: "block", fontWeight: 400 }}>{p.sample == null ? "母数未収録" : role === "batting" ? `${p.sample}打席` : `${comparisonValue("outsRecorded", p.sample)}回`}</small></dd></div>)}</dl>
    <p className="inline-note">{["AVG", "OPS"].includes(metric) ? "率指標の最高値は収録100打席以上が対象。" : ["ERA", "WHIP", "K9", "BB9"].includes(metric) ? "率指標の最高・最小値は収録30投球回以上が対象。" : ""}公式の規定資格や完全な年度成績ではありません。</p>
    <p><strong>この収録範囲の{["ERA", "WHIP", "BB9"].includes(metric) ? "最小" : "最高"}値：</strong>{best.length ? best.map(p => `${p.season}年 ${comparisonValue(metric, p.metrics[metric]!)}`).join(" / ") : "母数不足または未収録"}</p>
    <NpbClubComparison rows={rows} years={years} metric={metric} teamName={teamName} />
    {rows[0]&&<p><Link to={`/NPB/history?season=${Math.max(...rows.map(r=>r.season))}&role=${role}&cohort=schoolYear&peer=${rows[0].playerId}`}>同学年・ドラフト同期の成績と比較 →</Link></p>}
    {rows[0]&&<p><Link to={`/NPB/history?cohort=ageSeason&age=26&role=${role}&recentPlayers=${rows[0].playerId}`}>同じ年齢だったシーズンと比較 →</Link></p>}
    <p><Link to="/NPB/glossary?scope=historical">過去成績で使える指標の説明 →</Link></p><details><summary>所属球団別の変化</summary><p>記録された球団別行を表示します。在籍期間や移籍日を推定せず、未収録球団の行を補いません。</p><dl className="explorer-values">{rows.slice().sort((a,b)=>a.season-b.season||a.teamId.localeCompare(b.teamId)).map(r=><div key={`${r.season}:${r.teamId}`}><dt>{r.season}年 · {teamName(r.teamId)}</dt><dd>{comparisonValue(metric, historicalProgression([r], [r.season])[0]?.metrics[metric] ?? null)}</dd></div>)}</dl></details>
    {observedClubChanges(points).length>0&&<details><summary>球団が異なる年度の成績差</summary><p>連続する収録年度で、それぞれ1球団の行がある場合の比較です。移籍日・移籍による効果や完全な在籍期間は判定しません。同年の複数球団や欠損年度を前後関係で並べません。</p>{observedClubChanges(points).map(({before,after})=>{
      const a=before.metrics[metric],b=after.metrics[metric],delta=a!=null&&b!=null?b-a:null;
      const sample=(p:typeof before)=>p.sample==null?"母数未収録":role==="batting"?`${p.sample}打席`:`${comparisonValue("outsRecorded",p.sample)}回`;
      return <section key={after.season}><h4>{before.season}年 {teamName(before.teams[0]!)} → {after.season}年 {teamName(after.teams[0]!)}</h4><dl className="explorer-values"><div><dt>{before.season}年</dt><dd>{comparisonValue(metric,a??null)}<small> · {sample(before)}</small></dd></div><div><dt>{after.season}年</dt><dd>{comparisonValue(metric,b??null)}<small> · {sample(after)}</small></dd></div><div><dt>{label}の差</dt><dd>{delta===null?"比較不能":`${delta>0?"+":delta<0?"−":"±"}${comparisonValue(metric,Math.abs(delta))}`}</dd></div></dl></section>;
    })}</details>}
  </section>;
}
