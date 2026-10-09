import { StatTable } from "./stat-table";
import { useEffect, useState } from "react";
import type { Services } from "../app/services";
import type { PlayerGameLogResponse } from "../domain/player-game-log";
import { formatOuts } from "../domain/player-game-log";
import { buildBattingTrends, buildPitchingTrends, type TrendBatting, type TrendPitching, type Streak } from "../domain/player-trends";
import { DataState, LoadingSkeleton, MetricLabel } from "./components";

export function TrendChart({ points, label }: { points: { date: string; value: number | null }[]; label: string }) {
  const values = points.flatMap(p => p.value === null ? [] : [p.value]);
  if (!values.length) return <DataState kind="no-data" title="推移を計算できる記録がありません" />;
  const max = Math.max(...values, 0.01), width = 300, height = 110;
  const position = (i: number, value: number) => `${10 + i * 280 / Math.max(1, points.length - 1)},${100 - value * 85 / max}`;
  const segments: string[] = []; let segment: string[] = [];
  for (const [i, p] of points.entries()) { if (p.value === null) { if (segment.length) segments.push(segment.join(" ")); segment = []; } else segment.push(position(i, p.value)); }
  if (segment.length) segments.push(segment.join(" "));
  return <figure className="trend-chart"><figcaption>{label}</figcaption><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}。数値は下の記録表で確認できます。`}>
    <line x1="10" y1="100" x2="290" y2="100" className="trend-axis" />
    {segments.map((p, i) => <polyline key={i} points={p} fill="none" className="trend-line" />)}
    {points.map((p, i) => p.value === null ? null : <circle key={i} cx={Number(position(i, p.value).split(",")[0])} cy={Number(position(i, p.value).split(",")[1])} r="2.5" className="trend-dot"><title>{p.date}: {p.value.toFixed(3)}</title></circle>)}
    </svg><div className="trend-range"><span>{points[0]?.date}</span><span>{points.at(-1)?.date}</span></div></figure>;
}
const showStreak = (value: Streak) => value.count === null ? "—" : `${value.count}${value.atLeast ? "+" : ""}`;
const number = (n: number | null, digits = 0) => n === null ? "—" : n.toFixed(digits);
export function PlayerTrends({ batting, pitching, coverageComplete, scope }: { batting: TrendBatting[]; pitching: TrendPitching[]; coverageComplete: boolean; scope: string }) {
  const [window, setWindow] = useState<5 | 10>(5), [selectedRole, setRole] = useState("batting");
  const role = !batting.length ? "pitching" : !pitching.length ? "batting" : selectedRole;
  const bats = buildBattingTrends(batting, window, coverageComplete), pitches = buildPitchingTrends(pitching, coverageComplete);
  const hasRows = role === "batting" ? bats.rows.length > 0 : pitches.rows.length > 0;
  return <section className="stats-section player-trends"><h2>推移・連続記録</h2><p className="inline-note">{scope}</p>
    {!!batting.length && !!pitching.length && <div className="segmented" aria-label="推移の記録種類">{["batting", "pitching"].map(r => <button key={r} aria-pressed={role === r} onClick={() => setRole(r)}>{r === "batting" ? "打撃" : "投球"}</button>)}</div>}
    {!(role === "batting" ? bats.ordered : pitches.ordered) ? <DataState kind="unsupported" title="同日の試合順または重複を確定できないため、推移は表示できません" /> : !hasRows ? <DataState kind="no-data" title="出場記録はありません" /> : <>
    {!coverageComplete && <p className="data-notice">収集状況が不完全なため、連続記録は未確定です。推移は保存済み試合のみ。</p>}
    <div className="metric-grid">{(role === "batting" ? [["安打のある試合", bats.hitting], ["出塁のある試合", bats.onBase], ["本塁打のある試合", bats.homeRuns]] : [["無失点登板", pitches.scoreless]]).map(([label, streak]) => <div className="metric-tile" key={String(label)}><span>{String(label)}</span><strong className="metric-tile__value">{showStreak(streak as Streak)}</strong><small>記録末尾の連続数</small></div>)}</div>
    <details className="source-note"><summary>連続記録の数え方</summary><p>保存済みの出場記録の末尾から数えます。打撃は打席がある試合が対象。安打・出塁（安打＋四球＋死球）・本塁打のある試合が続く数です。公式の連続試合安打規定とは異なります。投手は失点Rが0の登板を数え、0アウトの登板も含みます。「+」は読み込んだ記録の範囲より前へ続く可能性を表します。欠測値は0として扱いません。</p></details>
    {role === "batting" ? <><div className="segmented" aria-label="移動集計の試合数">{([5, 10] as const).map(n => <button key={n} aria-pressed={window === n} onClick={() => setWindow(n)}>直近{n}試合</button>)}</div>
      <div className="metric-grid">{["G", "PA", "H", "HR", "AVG", "OPS"].map(k => <div className="metric-tile" key={k}><MetricLabel metric={k} /><strong className="metric-tile__value">{number(bats.recent[k as keyof typeof bats.recent], ["AVG", "OPS"].includes(k) ? 3 : 0)}</strong></div>)}</div>
      <TrendChart label={`${window}出場試合 移動OPS`} points={bats.points.map(p => ({ date: p.date, value: p.fullWindow ? p.OPS : null }))} />
      <details><summary>試合ごとの数値</summary><div className="mlb-stat-scroll" role="region" aria-label="打撃の推移表" tabIndex={0}><StatTable><thead><tr><th>日付</th><th>PA</th><th>H</th><th>HR</th><th><MetricLabel metric="AVG" label={`${window}試合AVG`} /></th><th><MetricLabel metric="OPS" label={`${window}試合OPS`} /></th></tr></thead><tbody>{[...bats.points].reverse().map(p => <tr key={p.gameId}><th>{p.date}</th><td>{number(bats.rows.find(r => r.gameId === p.gameId)!.pa)}</td><td>{number(bats.rows.find(r => r.gameId === p.gameId)!.hits)}</td><td>{number(bats.rows.find(r => r.gameId === p.gameId)!.homeRuns)}</td><td>{p.fullWindow ? number(p.AVG, 3) : "—"}</td><td>{p.fullWindow ? number(p.OPS, 3) : "—"}</td></tr>)}</tbody></StatTable></div></details>
    </> : <><TrendChart label="登板ごとの失点" points={pitches.points.map(p => ({ date: p.date, value: p.runs }))} /><div className="mlb-stat-scroll" role="region" aria-label="投球の推移表" tabIndex={0}><StatTable><thead><tr><th>日付</th><th>IP</th><th>R</th><th>ER</th><th>SO</th></tr></thead><tbody>{[...pitches.rows].reverse().map(p => <tr key={p.gameId}><th>{p.date}</th><td>{formatOuts(p.outsRecorded)}</td><td>{number(p.runs)}</td><td>{number(p.earnedRuns)}</td><td>{number(p.strikeouts)}</td></tr>)}</tbody></StatTable></div></>}
    </>}
  </section>;
}
export function NpbPlayerTrends({ services, playerId }: { services: Services; playerId: string }) {
  const [state, setState] = useState<{ log: PlayerGameLogResponse | null; complete: boolean } | null>(null), [error, setError] = useState(false);
  useEffect(() => { let active = true; void Promise.all([services.gameLog.find(playerId, 50), services.recent.find(playerId, "season")]).then(([log, season]) => {
    const stats = [season?.batting, season?.pitching].filter(s => s != null);
    if (active) setState({ log, complete: stats.length > 0 && stats.every(s => s.coverage.status === "complete") });
  }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [services, playerId]);
  if (error) return <DataState kind="source-unavailable" title="推移を読み込めません" />;
  if (!state) return <LoadingSkeleton />;
  return <PlayerTrends batting={state.log?.batting ?? []} pitching={state.log?.pitching ?? []} coverageComplete={state.complete} scope="NPB 公式戦 · 保存済みの直近最大50出場。未収集試合は含まれません。" />;
}
