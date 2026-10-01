import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { normalizePlayerSearch } from "../domain/npb-player-directory";
import { seasonCheckpointLabels, type NpbSeasonMilestones } from "../domain/npb-season-milestones";
import type { NpbSeasonMilestonesReader } from "../application/npb-season-milestones";
import { DataState, LoadingSkeleton, PageHeading } from "./components";
import { FutureFeatureScreen } from "./future-surfaces";

export function NpbMilestonesView({ payload, query, onQuery }: { payload: NpbSeasonMilestones;
  query: string; onQuery: (value: string) => void }) {
  const [expanded, setExpanded] = useState({ query, limit: 40 });
  const limit = expanded.query === query ? expanded.limit : 40;
  const needle = normalizePlayerSearch(query);
  const players = payload.players.filter(p => normalizePlayerSearch(p.displayName).includes(needle));
  return <>
    <p className="inline-note">{payload.season}シーズン · {payload.period.from}〜{payload.period.to}の保存済み成績</p>
    <p className="inline-note">{payload.coverage.status !== "complete" ? "未収録・確認中の試合があります。表示値は保存済み分のみです。" : "収録済み公式戦の集計です。"}
      通算記録・公式達成日・順位を示すものではありません。</p>
    <label className="search-field"><Search size={20} aria-hidden="true" /><span className="sr-only">節目を確認する選手名</span>
      <input type="search" placeholder="選手名を入力" value={query} onChange={e => onQuery(e.target.value)} /></label>
    <div className="list-heading"><strong>シーズンの節目</strong><span>{players.length}人 · 選手名順</span></div>
    {players.length ? <div className="row-list">{players.slice(0, limit).map(p => <details className="advanced-disclosure" key={p.playerId}>
      <summary><span>{p.displayName}<small> · {p.teamName ?? "所属未登録"}</small></span></summary><Link className="text-link" to={`/NPB/players/${encodeURIComponent(p.playerId)}/stats`}>選手のシーズン成績</Link>
      <dl className="profile-facts">{p.checkpoints.map(c => <div key={c.metric}><dt>{seasonCheckpointLabels[c.metric]}</dt>
        <dd><strong>{c.count}</strong><small> · 節目 {c.previousCheckpoint > 0 ? `${c.previousCheckpoint} / ` : ""}{c.nextCheckpoint}</small></dd></div>)}</dl>
    </details>)}</div> : <DataState kind="no-data" title="表示できる保存済み成績はありません" />}
    {players.length > limit && <button className="button button--secondary" onClick={() => setExpanded({ query, limit: limit + 40 })}>さらに40人を表示</button>}
    <details className="advanced-disclosure"><summary>節目の表示について</summary>
      <p>安打・打点・奪三振は50、勝利は5、その他は10刻みの目安です。公式記録の認定や今後の達成予測ではありません。不明な項目は表示しません。</p>
    </details>
  </>;
}
export function NpbMilestonesScreen({ repository }: { repository: NpbSeasonMilestonesReader }) {
  const [params, setParams] = useSearchParams(), career = params.get("tab") === "1", query = params.get("q") ?? "";
  const [payload, setPayload] = useState<NpbSeasonMilestones | null>(null), [state, setState] = useState<"loading" | "ready" | "error" | "unavailable">("loading");
  useEffect(() => {
    if (career) return;
    let active = true;
    void Promise.resolve().then(() => { if (active) setState("loading"); return repository.capabilities(); }).then(async capability => {
      if (!capability.data.seasonMilestones?.available) { if (active) setState("unavailable"); return; }
      const value = await repository.seasonMilestones(Number(capability.effectiveDate.slice(0, 4)));
      if (value.effectiveDate !== capability.effectiveDate) throw Error("Milestone effective date mismatch");
      if (active) { setPayload(value); setState("ready"); }
    }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [repository, career]);
  if (career) return <FutureFeatureScreen feature="milestones" league="NPB" />;
  return <div className="screen"><Link className="back-link" to="/NPB/explore">← 野球をもっと知る</Link>
    <PageHeading eyebrow="NPB" title="達成記録" />
    <nav className="profile-tabs" aria-label="達成記録の表示切替"><Link to="/NPB/milestones?tab=0" aria-current="page">シーズン</Link><Link to="/NPB/milestones?tab=1">キャリア <span className="soon-badge">Soon</span></Link></nav>
    {state === "loading" && <LoadingSkeleton />}
    {state === "error" && <DataState kind="source-unavailable" title="保存済み成績を読み込めません" />}
    {state === "unavailable" && <DataState kind="not-implemented" title="シーズンの節目は準備中です" />}
    {state === "ready" && payload && <NpbMilestonesView payload={payload} query={query} onQuery={q => {
      const next = new URLSearchParams(params); if (q) next.set("q", q); else next.delete("q"); setParams(next, { replace: true });
    }} />}
  </div>;
}
