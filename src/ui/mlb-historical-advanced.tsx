import { useState } from "react";
import { Link } from "react-router-dom";
import { normalizePlayerSearch } from "../domain/cross-league";
import type { AdvancedPlayerPayload, PaAnalysisLine } from "../domain/mlb-pa-analysis";
import { DataState, LoadingSkeleton } from "./components";
import { useHistoricalStatic } from "./use-mlb-historical";

const labels: Record<string, string> = { "inning:1–3": "1〜3回", "inning:4–6": "4〜6回", "inning:7–9": "7〜9回", "inning:extra": "延長",
  "outs:0": "0アウト", "outs:1": "1アウト", "outs:2": "2アウト", "bases:empty": "走者なし", "bases:runners": "走者あり", "bases:risp": "得点圏に走者",
  "score:ahead": "リード", "score:tied": "同点", "score:behind": "ビハインド" };
export function PaMetricTable({ metrics, pitching = false }: { metrics: PaAnalysisLine; pitching?: boolean }) {
  return <><p>{metrics.PA} PA · {metrics.H} 安打 · {metrics.HR} 本塁打 · {pitching ? "被打率" : "AVG"} {metrics.AVG?.toFixed(3) ?? "—"}</p>
    <details><summary>対戦打撃成績の詳細</summary><div className="mlb-stat-scroll"><table>
      <thead><tr>{Object.keys(metrics).map(key => <th key={key}>{key}</th>)}</tr></thead><tbody><tr>{Object.entries(metrics).map(([key, value]) =>
        <td key={key}>{value === null ? "—" : ["AVG", "OBP", "SLG", "OPS"].includes(key) ? value.toFixed(3) : value}</td>)}</tr></tbody>
    </table></div><p className="inline-note">PAは対戦打席数。AVGは安打/打数、OBPは出塁率、SLGは長打率、OPSはOBPとSLGの合計です。投手表示は相手打者の打撃成績です。</p></details></>;
}
export function HistoricalAdvancedAnalysis({ playerId, season, hasBatting, hasPitching }: {
  playerId: string; season: number; hasBatting: boolean; hasPitching: boolean;
}) {
  const [open, setOpen] = useState(false), [scope, setScope] = useState<"season" | "range">("season");
  const [selectedRole, setSelectedRole] = useState<"batting" | "pitching">("batting");
  const [mode, setMode] = useState<"bvp" | "inning" | "outs" | "bases" | "score">("bvp");
  const [query, setQuery] = useState(""), [opponentId, setOpponentId] = useState("");
  const [splitKey, setSplitKey] = useState("");
  const role = !hasBatting ? "pitching" : !hasPitching ? "batting" : selectedRole;
  const result = useHistoricalStatic<AdvancedPlayerPayload>(open ? `advanced/${scope === "range" ? "range" : season}/${playerId.replaceAll(":", "_")}.json` : null);
  const section = result.value?.[role];
  const opponents = (section?.opponents ?? []).filter(row => normalizePlayerSearch(row.name).includes(normalizePlayerSearch(query)));
  const opponent = section?.opponents.find(row => row.playerId === opponentId);
  const splits = section?.splits.filter(row => row.key.startsWith(`${mode}:`)) ?? [];
  const split = splits.find(row => row.key === splitKey) ?? splits[0];
  return <section className="surface-card"><h2>高度分析</h2>
    <button className="button" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "閉じる" : "対戦・状況別を見る"}</button>
    {open && <>
      <div className="mlb-controls"><label>対象期間<select value={scope} onChange={event => setScope(event.target.value as "season" | "range")}>
        <option value="season">{season}年</option><option value="range">収録期間内 2020〜2025</option></select></label>
        {hasBatting && hasPitching && <label>成績の種類<select value={role} onChange={event => setSelectedRole(event.target.value as "batting" | "pitching")}>
          <option value="batting">打者として</option><option value="pitching">投手として</option></select></label>}</div>
      <div className="chip-list" role="group" aria-label="高度分析の条件">{(["bvp", "inning", "outs", "bases", "score"] as const).map(key =>
        <button className="filter-chip" type="button" key={key} aria-pressed={mode === key} onClick={() => setMode(key)}>
          {({ bvp: role === "batting" ? "対戦投手" : "対戦打者", inning: "イニング", outs: "アウト", bases: "走者", score: "得点差" })[key]}</button>)}</div>
      {result.status === "loading" ? <LoadingSkeleton /> : result.status !== "ready" ?
        <DataState kind={result.status === "error" ? "source-unavailable" : "no-data"} title="高度分析を読み込めません" /> :
        mode === "bvp" ? result.value!.directBvp !== "ready" ? <DataState kind="unsupported" title="対戦成績を確認中です" /> : <>
          <label className="mlb-asof">{role === "batting" ? "対戦投手を検索" : "対戦打者を検索"}
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="相手の名前で絞り込む" /></label>
          <p className="inline-note">{opponents.length}人。実際に対戦した相手だけを表示します。</p>
          {opponent && <div><h3>{opponent.name}</h3><PaMetricTable metrics={opponent.metrics} pitching={role === "pitching"} />
            <Link to={`/MLB/players/${encodeURIComponent(opponent.playerId)}`}>選手ページへ</Link></div>}
          <div className="row-list">{opponents.slice(0, 40).map(row => <button className="ranking-entry" type="button" key={row.playerId}
            aria-pressed={row.playerId === opponentId} onClick={() => setOpponentId(row.playerId)}>{row.name} · {row.metrics.PA} PA</button>)}</div>
          {!opponents.length && <DataState kind="no-data" title="該当する対戦相手はいません" />}
          {opponents.length > 40 && <p className="inline-note">先頭40人を表示。名前で絞り込めます。</p>}
        </> : result.value!.situations !== "ready" ? <DataState kind="unsupported" title="状況別成績を確認中です" /> : !split ?
          <DataState kind="no-data" title="この条件の打席はありません" /> : <>
            <label className="mlb-asof">状況<select value={split.key} onChange={event => setSplitKey(event.target.value)}>
              {splits.map(row => <option key={row.key} value={row.key}>{labels[row.key] ?? row.key}</option>)}</select></label>
            <PaMetricTable metrics={split.metrics} pitching={role === "pitching"} />
            {split.unknownPa > 0 && <p className="inline-note">開始状況を確定できない{split.unknownPa}打席はこの分類から除外しています。</p>}
            <p className="inline-note">PA開始時の状況。得点差は選手の所属球団を基準にします。</p>
          </>}
      <p className="inline-note">収録期間内の対戦記録です。少ない打席数から得意・苦手を判定するものではありません。</p>
    </>}
  </section>;
}
