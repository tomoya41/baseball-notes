import { useState } from "react";
import { comparisonPeriods, type ComparisonPeriod, type PlayerPeriodComparison } from "../domain/player-period-comparison";
import type { PlayerHomeAway } from "../domain/player-home-away";
import { opponentChoice, type PlayerOpponent } from "../domain/player-opponent";
import { battingOrderChoice, type PlayerBattingOrder } from "../domain/player-batting-order";
import type { PlayerPitcherRole } from "../domain/player-pitcher-role";
import type { PlayerBatterRole } from "../domain/player-batter-role";
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

const opponentPrimary = {
  batting: [{ key: "OPS", label: "OPS" }, { key: "AVG", label: "AVG" },
    { key: "PA", label: "PA" }, { key: "G", label: "試合" }],
  pitching: [{ key: "ERA", label: "ERA" }, { key: "K9", label: "K/9" },
    { key: "outsRecorded", label: "IP" }, { key: "BF", label: "BF" },
    { key: "appearances", label: "登板" }],
} as const;
const opponentDetails = {
  batting: [{ key: "AB", label: "打数" }, { key: "H", label: "安打" },
    { key: "2B", label: "二塁打" }, { key: "3B", label: "三塁打" },
    { key: "HR", label: "HR" }, { key: "RBI", label: "打点" }, { key: "BB", label: "四球" },
    { key: "HBP", label: "死球" }, { key: "SO", label: "三振" },
    { key: "OBP", label: "OBP" }, { key: "SLG", label: "SLG" }],
  pitching: [{ key: "GS", label: "先発" }, { key: "H", label: "被安打" },
    { key: "HR", label: "被本塁打" }, { key: "SO", label: "奪三振" },
    { key: "R", label: "失点" }, { key: "ER", label: "自責点" },
    { key: "pitchCount", label: "投球数" }, { key: "W", label: "勝" },
    { key: "L", label: "敗" }, { key: "HLD", label: "HLD" }, { key: "SV", label: "SV" }],
} as const;

function OpponentRole({ role, selected, total, teamName }: { role: Role; selected: SplitResult | null;
  total: SplitResult | null; teamName: string }) {
  if (!selected) return null;
  const label = role === "batting" ? "打撃" : "投球";
  return <section className="analysis-opponent-role" aria-label={`${teamName}戦の${label}成績`}>
    <h3>{label}</h3>
    <div className="analysis-opponent-table" role="group" aria-label={`${teamName}戦と分類できた30日全体の比較`}>
      <div className="analysis-opponent-table__head"><span>指標</span><strong>対{teamName}</strong><strong>30日全体</strong></div>
      {opponentPrimary[role].map(({ key, label: name }) => <div className="analysis-opponent-table__row" key={key}>
        <span>{name}</span><strong>{splitMetric(selected, key)}</strong><span>{splitMetric(total, key)}</span>
      </div>)}
    </div>
    <details className="analysis-split-details"><summary>詳しい成績</summary>
      <dl>{opponentDetails[role].map(({ key, label: name }) => <div key={key}><dt>{name}</dt>
        <dd>{splitMetric(selected, key)}</dd></div>)}</dl></details>
  </section>;
}

export function NpbPlayerOpponentSection({ payload, state, teamNames, teamOrder }: {
  payload: PlayerOpponent | null; state: AnalysisState; teamNames: ReadonlyMap<string, string>;
  teamOrder: readonly string[];
}) {
  const [selection, setSelection] = useState<string | null>(null);
  const choices = payload ? opponentChoice(payload, teamOrder) : null;
  const selectedId = payload?.opponents.some((item) => item.teamId === selection)
    ? selection : choices?.defaultTeamId;
  const selected = payload?.opponents.find((item) => item.teamId === selectedId);
  const factCount = payload ? payload.batting.totalFactCount + payload.pitching.totalFactCount : 0;
  const unknownCount = payload ? payload.batting.unknownOpponentFactCount + payload.pitching.unknownOpponentFactCount : 0;
  const teamName = selected ? teamNames.get(selected.teamId) ?? "球団名不明" : "";
  return <section className="analysis-opponent" aria-label="対戦相手別分析">
    <SectionHeader title="対戦相手別" />
    <p className="analysis-period-note">保存済みの直近30日試合成績を対戦球団ごとに表示します。</p>
    {state === "loading" && <div aria-live="polite"><LoadingSkeleton /></div>}
    {state === "error" && <DataState kind="source-unavailable" title="対戦相手別成績を取得できませんでした" />}
    {state === "missing" && <DataState kind="no-data" title="分析できる試合データがまだありません" />}
    {state === "ready" && payload && (!factCount
      ? <DataState kind="no-data" title="分析できる試合データがまだありません" />
      : <><p className="analysis-period-note">{formatDate(payload.from, true)}〜{formatDate(payload.to, true)} · {formatDate(payload.asOfDate, true)}終了時点</p>
        {!selected ? <DataState kind="no-data" title="対戦相手を判定できる記録がありません" /> : <>
          {choices && choices.options.length > 1 ? <label className="analysis-opponent-select">対戦相手
            <select value={selectedId ?? ""} onChange={(event) => setSelection(event.target.value)}>
              {choices.options.map((item) => <option key={item.teamId} value={item.teamId}>
                {teamNames.get(item.teamId) ?? "球団名不明"}</option>)}
            </select></label> : <p className="analysis-opponent-single">対戦相手：<strong>{teamName}</strong></p>}
          <OpponentRole role="batting" selected={selected.batting} total={payload.batting.classifiedTotal} teamName={teamName} />
          <OpponentRole role="pitching" selected={selected.pitching} total={payload.pitching.classifiedTotal} teamName={teamName} />
          <p className="analysis-period-note">30日全体は対戦相手を判定できた保存済み記録の合計です。</p>
        </>}
        {unknownCount > 0 && <p className="analysis-period-note">対戦相手を判定できない記録：{unknownCount}件</p>}
        {payload.coverage.status !== "complete" && <p className={`analysis-period-coverage analysis-period-coverage--${payload.coverage.status}`}>
          {coverageNames[payload.coverage.status]}。表示値は保存済み記録から算出しています。</p>}
      </>)}
  </section>;
}

export function NpbPlayerBattingOrderSection({ payload, state, battingAvailable }: {
  payload: PlayerBattingOrder | null; state: AnalysisState; battingAvailable: boolean | undefined;
}) {
  const [selection, setSelection] = useState<number | null>(null);
  if (battingAvailable === false || (state === "ready" && payload?.totalFactCount === 0)) return null;
  const choices = payload ? battingOrderChoice(payload) : null;
  const selectedOrder = payload?.orders.some((item) => item.battingOrder === selection)
    ? selection : choices?.defaultOrder;
  const selected = payload?.orders.find((item) => item.battingOrder === selectedOrder);
  return <section className="analysis-batting-order" aria-label="打順別分析">
    <SectionHeader title="打順別" />
    <p className="analysis-period-note">保存済みの直近30日打撃成績を、記録された打順ごとに表示します。</p>
    {state === "loading" && <div aria-live="polite"><LoadingSkeleton /></div>}
    {state === "error" && <DataState kind="source-unavailable" title="打順別成績を取得できませんでした" />}
    {state === "missing" && <DataState kind="no-data" title="分析できる試合データがまだありません" />}
    {state === "ready" && payload && <>
      <p className="analysis-period-note">{formatDate(payload.from, true)}〜{formatDate(payload.to, true)} · {formatDate(payload.asOfDate, true)}終了時点</p>
      {!selected ? <DataState kind="no-data" title="打順を判定できる記録がありません" /> : <>
        {choices && choices.options.length > 1 ? <label className="analysis-opponent-select">打順
          <select value={selectedOrder ?? ""} onChange={(event) => setSelection(Number(event.target.value))}>
            {choices.options.map((item) => <option key={item.battingOrder} value={item.battingOrder}>
              {item.battingOrder}番</option>)}</select></label> :
          <p className="analysis-opponent-single">打順：<strong>{selected.battingOrder}番</strong></p>}
        <section className="analysis-opponent-role" aria-label={`${selected.battingOrder}番の打撃成績`}>
          <div className="analysis-opponent-table" role="group" aria-label={`${selected.battingOrder}番と分類できた30日全体の比較`}>
            <div className="analysis-opponent-table__head"><span>指標</span><strong>{selected.battingOrder}番</strong><strong>30日全体</strong></div>
            {([{ key: "OPS", label: "OPS" }, { key: "AVG", label: "AVG" }, { key: "PA", label: "PA" },
              { key: "G", label: "試合" }, { key: "HR", label: "HR" }] as const).map(({ key, label }) =>
              <div className="analysis-opponent-table__row" key={key}><span>{label}</span>
                <strong>{splitMetric(selected.stats, key)}</strong><span>{splitMetric(payload.classifiedTotal, key)}</span></div>)}
          </div>
          <details className="analysis-split-details"><summary>詳しい成績</summary><dl>
            {opponentDetails.batting.map(({ key, label }) => <div key={key}><dt>{label}</dt>
              <dd>{splitMetric(selected.stats, key)}</dd></div>)}
          </dl></details>
        </section>
        <p className="analysis-period-note">30日全体は打順を判定できた保存済み記録の合計です。</p>
      </>}
      {payload.unknownBattingOrderFactCount > 0 && <p className="analysis-period-note">打順不明の記録：
        {payload.unknownBattingOrderFactCount}件{payload.unknownBattingOrderPa !== null &&
          `・${payload.unknownBattingOrderPa}打席`}</p>}
      {payload.coverage.status !== "complete" && <p className={`analysis-period-coverage analysis-period-coverage--${payload.coverage.status}`}>
        {coverageNames[payload.coverage.status]}。表示値は保存済み記録から算出しています。</p>}
    </>}
  </section>;
}

const pitcherRoleDetails = [{ key: "BF", label: "BF" }, { key: "H", label: "被安打" },
  { key: "HR", label: "被本塁打" }, { key: "SO", label: "奪三振" },
  { key: "R", label: "失点" }, { key: "ER", label: "自責点" },
  { key: "pitchCount", label: "投球数" }, { key: "W", label: "勝" },
  { key: "L", label: "敗" }, { key: "HLD", label: "HLD" }, { key: "SV", label: "SV" }] as const;

const batterRoleDetails = [{ key: "AB", label: "打数" }, { key: "R", label: "得点" },
  { key: "H", label: "安打" }, { key: "2B", label: "二塁打" }, { key: "3B", label: "三塁打" },
  { key: "HR", label: "本塁打" }, { key: "RBI", label: "打点" }, { key: "BB", label: "四球" },
  { key: "HBP", label: "死球" }, { key: "SH", label: "犠打" }, { key: "SF", label: "犠飛" },
  { key: "SO", label: "三振" }, { key: "SB", label: "盗塁" }, { key: "CS", label: "盗塁死" },
  { key: "OBP", label: "出塁率" }, { key: "SLG", label: "長打率" }] as const;

export function NpbPlayerBatterRoleSection({ payload, state, battingAvailable }: {
  payload: PlayerBatterRole | null; state: AnalysisState; battingAvailable: boolean | undefined;
}) {
  if (battingAvailable === false || (state === "ready" && payload?.totalFactCount === 0)) return null;
  return <section className="analysis-batter-role" aria-label="打者の出場形態別分析">
    <SectionHeader title="先発 / 途中出場" />
    <p className="analysis-period-note">保存済みの直近30日打撃成績を、記録された出場形態で分けて表示します。交代順は含みません。</p>
    {state === "loading" && <div aria-live="polite"><LoadingSkeleton /></div>}
    {state === "error" && <DataState kind="source-unavailable" title="出場形態別成績を取得できませんでした" />}
    {state === "missing" && <DataState kind="no-data" title="分析できる試合データがまだありません" />}
    {state === "ready" && payload && <>
      <p className="analysis-period-note">{formatDate(payload.from, true)}〜{formatDate(payload.to, true)} · {formatDate(payload.asOfDate, true)}終了時点</p>
      <div className="analysis-split-grid">{(["starter", "substitute"] as const).map((role) => {
        const result = payload[role];
        const name = role === "starter" ? "先発" : "途中出場";
        return <div className="analysis-split-card" key={role} role="group" aria-label={`${name}打撃成績`}>
          <h3>{name}</h3>{result ? <>
            <div className="analysis-split-primary">{([
              { key: "OPS", label: "OPS" }, { key: "AVG", label: "AVG" },
              { key: "PA", label: "PA" }, { key: "G", label: "試合" },
            ] as const).map(({ key, label }) => <div key={key}><span>{label}</span>
              <strong>{splitMetric(result,key)}</strong></div>)}</div>
            <p className="analysis-split-sample">{splitMetric(result,"G")}試合 · {splitMetric(result,"PA")}打席</p>
            <details className="analysis-split-details"><summary>詳しい成績</summary><dl>
              {batterRoleDetails.map(({ key, label }) => <div key={key}><dt>{label}</dt>
                <dd>{splitMetric(result,key)}</dd></div>)}
            </dl></details>
          </> : <p className="muted">保存済み{name}成績なし</p>}</div>;
      })}</div>
      {payload.unknownRoleFactCount > 0 && <p className="analysis-period-note">出場形態を判定できない記録：{payload.unknownRoleFactCount}件</p>}
      {payload.coverage.status !== "complete" && <p className={`analysis-period-coverage analysis-period-coverage--${payload.coverage.status}`}>
        {coverageNames[payload.coverage.status]}。表示値は保存済み記録から算出しています。</p>}
    </>}
  </section>;
}

export function NpbPlayerPitcherRoleSection({ payload, state, pitchingAvailable }: {
  payload: PlayerPitcherRole | null; state: AnalysisState; pitchingAvailable: boolean | undefined;
}) {
  if (pitchingAvailable === false || (state === "ready" && payload?.totalFactCount === 0)) return null;
  return <section className="analysis-pitcher-role" aria-label="先発・救援別分析">
    <SectionHeader title="先発 / 救援" />
    <p className="analysis-period-note">保存済みの直近30日投球成績を、記録された役割で分けて表示します。</p>
    {state === "loading" && <div aria-live="polite"><LoadingSkeleton /></div>}
    {state === "error" && <DataState kind="source-unavailable" title="先発・救援別成績を取得できませんでした" />}
    {state === "missing" && <DataState kind="no-data" title="分析できる試合データがまだありません" />}
    {state === "ready" && payload && <>
      <p className="analysis-period-note">{formatDate(payload.from, true)}〜{formatDate(payload.to, true)} · {formatDate(payload.asOfDate, true)}終了時点</p>
      <div className="analysis-split-grid">{(["starter", "reliever"] as const).map((role) => {
        const result = payload[role];
        const name = role === "starter" ? "先発" : "救援";
        return <div className="analysis-split-card" key={role} role="group" aria-label={`${name}投球成績`}>
          <h3>{name}</h3>{result ? <>
            <div className="analysis-split-primary">{([
              { key: "ERA", label: "ERA" }, { key: "K9", label: "K/9" },
              { key: "outsRecorded", label: "IP" },
              role === "starter" ? { key: "GS", label: "先発" } : { key: "appearances", label: "登板" },
            ] as const).map(({ key, label }) => <div key={key}><span>{label}</span>
              <strong>{splitMetric(result, key)}</strong></div>)}</div>
            <p className="analysis-split-sample">{role === "starter" ? `先発 ${splitMetric(result, "GS")}` :
              `登板 ${splitMetric(result, "appearances")}`} · IP {splitMetric(result, "outsRecorded")} · BF {splitMetric(result, "BF")}</p>
            <details className="analysis-split-details"><summary>詳しい成績</summary><dl>
              {pitcherRoleDetails.map(({ key, label }) => <div key={key}><dt>{label}</dt>
                <dd>{splitMetric(result, key)}</dd></div>)}
            </dl></details>
          </> : <p className="muted">保存済み{name}登板なし</p>}</div>;
      })}</div>
      {payload.unknownRoleAppearances > 0 && <p className="analysis-period-note">役割不明の登板：
        {payload.unknownRoleAppearances}件 · IP {payload.unknownRoleOuts === null ? "—" :
          `${Math.floor(payload.unknownRoleOuts / 3)}.${payload.unknownRoleOuts % 3}`} · BF {payload.unknownRoleBf ?? "—"}</p>}
      {payload.coverage.status !== "complete" && <p className={`analysis-period-coverage analysis-period-coverage--${payload.coverage.status}`}>
        {coverageNames[payload.coverage.status]}。表示値は保存済み記録から算出しています。</p>}
    </>}
  </section>;
}
