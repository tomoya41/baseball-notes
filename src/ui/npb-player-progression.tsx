import { useRosterSearchParams } from "./use-roster-search-params";
import { RosterContextLink as Link } from "./roster-navigation";
import { bestObservedSeasons, historicalProgression, observedClubChanges, progressionMetrics, type ProgressionMetric } from "../domain/npb-player-progression";
import type { NpbHistoricalRow } from "../domain/npb-historical";
import { comparisonValue } from "../domain/product-comparison";
import { MetricLabel } from "./components";
import { NpbClubComparison } from "./npb-club-comparison";
import { CollectedRecordWatch } from "./npb-collected-records";

export function NpbPlayerProgression({ rows, years, teamName }: { rows: NpbHistoricalRow[]; years: number[]; teamName: (id: string) => string }) {
  const [params, setParams] = useRosterSearchParams();
  const role = rows[0]?.role ?? "batting";
  const options: ProgressionMetric[] = role === "batting" ? ["OPS", "AVG", "HR", "H", "RBI", "PA", "G"] : ["ERA", "SO", "outsRecorded", "G", "WHIP", "K9", "BB9"];
  const raw = params.get("trendMetric"), metric = options.includes(raw as ProgressionMetric) ? raw as ProgressionMetric : options[0]!;
  const points = historicalProgression(rows, years), best = bestObservedSeasons(points, metric);
  const finite = points.flatMap(p => p.metrics[metric] == null ? [] : [p.metrics[metric]!]);
  const countMetric = ["HR", "H", "RBI", "PA", "G", "SO", "outsRecorded"].includes(metric);
  const peak = Math.max(0, ...finite), max = peak === 0 ? 1 : countMetric ? Math.ceil(peak * 1.12) : Math.ceil(peak * 1.12 * 10) / 10;
  const ticks = [...new Set([0, countMetric ? Math.round(max / 2) : max / 2, max])];
  const firstYear = Math.min(...years), lastYear = Math.max(...years);
  const x = (year: number) => firstYear === lastYear ? 180 : 64 + (year - firstYear) / (lastYear - firstYear) * 240;
  const y = (v: number) => 144 - v / max * 120;
  const label = metric === "outsRecorded" ? "投球回" : metric === "K9" ? "K/9" : metric === "BB9" ? "BB/9" : metric;
  return <section className="player-progression" aria-label="年度別成績の推移">
    <div className="progression-heading"><h3>成績の変化</h3>
    <label>推移指標<select value={metric} onChange={e => setParams(previous => { const next = new URLSearchParams(previous); next.set("trendMetric", e.target.value); return next; })}>{options.filter(k => progressionMetrics.includes(k)).map(k => <option key={k} value={k}>{k === "outsRecorded" ? "投球回" : k}</option>)}</select></label>
    </div><p className="progression-scope"><MetricLabel metric={metric} label={label} /> · 一部収録</p>
    <figure className="progression-chart"><svg viewBox="0 0 336 188" role="img" aria-label={`${label}の年度推移。縦軸は0から。正確な値・球団・母数は下の年度一覧で確認できます`}>
      {ticks.map(t=><g key={t} className="progression-axis"><line x1="64" y1={y(t)} x2="304" y2={y(t)} /><text x="44" y={y(t)+4} textAnchor="end">{comparisonValue(metric,t)}</text></g>)}
      {points.map((p, i) => { const v = p.metrics[metric], previous = points[i - 1], pv = previous?.metrics[metric]; return <g key={p.season}>
        {!countMetric && v != null && pv != null && previous && p.season === previous.season + 1 && <><polygon className="progression-area" points={`${x(previous.season)},144 ${x(previous.season)},${y(pv)} ${x(p.season)},${y(v)} ${x(p.season)},144`} /><line className="progression-segment" x1={x(previous.season)} y1={y(pv)} x2={x(p.season)} y2={y(v)} /></>}
        {v != null && (countMetric?<rect className="progression-bar" x={x(p.season)-14} y={y(v)} width="28" height={144-y(v)} rx="2"><title>{p.season}年 {comparisonValue(metric,v)}</title></rect>:<circle className="progression-point" cx={x(p.season)} cy={y(v)} r="4"><title>{p.season}年 {comparisonValue(metric, v)}</title></circle>)}
        <text className="progression-value" x={x(p.season)} y={v==null?132:y(v)-12} textAnchor="middle">{comparisonValue(metric,v??null)}</text>
        <text className="progression-year" x={x(p.season)} y="176" textAnchor="middle">{p.season}</text>
      </g>; })}
    </svg><figcaption>{years.slice().sort((a,b)=>a-b).join(" / ")}年 · 収録分</figcaption></figure>
    <dl className="explorer-values progression-year-values">{points.map(p => <div key={p.season}><dt><span>{p.season}年</span><small> · {p.teams.length ? p.teams.map(teamName).join(" / ") : "未収録"}</small></dt><dd>{comparisonValue(metric, p.metrics[metric] ?? null)}<small>{p.sample == null ? "母数未収録" : role === "batting" ? `${p.sample}打席` : `${comparisonValue("outsRecorded", p.sample)}回`}</small></dd></div>)}</dl>
    <p className="progression-best"><strong>収録内{["ERA", "WHIP", "BB9"].includes(metric) ? "最小" : "最高"}値</strong><span>{best.length ? best.map(p => `${p.season}年 ${comparisonValue(metric, p.metrics[metric]!)}`).join(" / ") : "母数不足または未収録"}</span></p>
    <details className="progression-method"><summary>集計条件</summary><p>{["AVG", "OPS"].includes(metric) ? "率指標の最高値は収録100打席以上が対象。" : ["ERA", "WHIP", "K9", "BB9"].includes(metric) ? "率指標の最高・最小値は収録30投球回以上が対象。" : ""}公式の規定資格や完全な年度成績ではありません。未収録は「—」。欠損年度は線でつなぎません。{metric==="outsRecorded"&&"投球回の高さはアウト数に比例します。"}</p></details>
    <NpbClubComparison rows={rows} years={years} metric={metric} teamName={teamName} />
    <CollectedRecordWatch rows={rows.filter(r=>years.includes(r.season))} />
    <nav className="history-paths" aria-label="分析を続ける">{rows[0]&&<><Link aria-label="同学年・ドラフト同期の成績と比較" to={`/NPB/history?season=${Math.max(...rows.map(r=>r.season))}&role=${role}&cohort=schoolYear&peer=${rows[0].playerId}`}>同学年・同期</Link><Link aria-label="同じ年齢だったシーズンと比較" to={`/NPB/history?cohort=ageSeason&age=26&role=${role}&recentPlayers=${rows[0].playerId}`}>同年齢</Link></>}<Link to="/NPB/glossary?scope=historical">指標ガイド</Link></nav><details><summary>所属球団別の変化</summary><p>記録された球団別行を表示します。在籍期間や移籍日を推定せず、未収録球団の行を補いません。</p><dl className="explorer-values">{rows.slice().sort((a,b)=>a.season-b.season||a.teamId.localeCompare(b.teamId)).map(r=><div key={`${r.season}:${r.teamId}`}><dt>{r.season}年 · {teamName(r.teamId)}</dt><dd>{comparisonValue(metric, historicalProgression([r], [r.season])[0]?.metrics[metric] ?? null)}</dd></div>)}</dl></details>
    {observedClubChanges(points).length>0&&<details><summary>球団が異なる年度の成績差</summary><p>連続する収録年度で、それぞれ1球団の行がある場合の比較です。移籍日・移籍による効果や完全な在籍期間は判定しません。同年の複数球団や欠損年度を前後関係で並べません。</p>{observedClubChanges(points).map(({before,after})=>{
      const a=before.metrics[metric],b=after.metrics[metric],delta=a!=null&&b!=null?b-a:null;
      const sample=(p:typeof before)=>p.sample==null?"母数未収録":role==="batting"?`${p.sample}打席`:`${comparisonValue("outsRecorded",p.sample)}回`;
      return <section key={after.season}><h4>{before.season}年 {teamName(before.teams[0]!)} → {after.season}年 {teamName(after.teams[0]!)}</h4><dl className="explorer-values"><div><dt>{before.season}年</dt><dd>{comparisonValue(metric,a??null)}<small> · {sample(before)}</small></dd></div><div><dt>{after.season}年</dt><dd>{comparisonValue(metric,b??null)}<small> · {sample(after)}</small></dd></div><div><dt>{label}の差</dt><dd>{delta===null?"比較不能":`${delta>0?"+":delta<0?"−":"±"}${comparisonValue(metric,Math.abs(delta))}`}</dd></div></dl></section>;
    })}</details>}
  </section>;
}
