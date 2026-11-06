import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { NpbHotPayload } from "../application/npb-hot-payload";
import { expectedNpbHotDate } from "../domain/npb-hot-date";
import { formatDate } from "../presentation/formatters";
import { DataState, LoadingSkeleton, SectionHeader } from "./components";

type Entry = NpbHotPayload["batting"][number] | NpbHotPayload["starters"][number] |
  NpbHotPayload["relievers"][number];

const readinessDetails: Record<NpbHotPayload["readiness"]["reasons"][number], string> = {
  coverage_not_complete: "対象期間の収録が未確認です",
  no_production_eligible_players: "成績・出場数の条件を満たす選手を確認できません",
  category_not_ready: "一部の部門で成績・出場数の条件が未達です",
  scheduled_production_evidence_pending: "定時収集・配信は未確認です",
  display_metadata_unavailable: "選手名・球団等の表示情報を確認中",
};

function innings(outs: number): string { return `${Math.floor(outs / 3)}.${outs % 3}`; }

function HotCard({ entry }: { entry: Entry }) {
  const isBatter = entry.role === "batter";
  return <Link className="npb-hot-card" to={`/NPB/players/${encodeURIComponent(entry.playerId)}`}
    aria-label={`${entry.rank}位 ${entry.displayName} ${entry.teamName} 選手ページへ`}>
    <span className="npb-hot-card__rank">{entry.rank}</span>
    <span className="npb-hot-card__body"><strong>{entry.displayName}</strong>
      <small>{entry.teamName} · {isBatter ? `${entry.sample.pa}打席 / ${entry.sample.hr}本塁打` :
        `${entry.sample.appearances}登板 / ${innings(entry.sample.outsRecorded)}回 / K/9 ${entry.sample.k9.toFixed(1)}`}</small>
      <span>{entry.reason}</span></span>
    <strong className="npb-hot-card__metric">{isBatter ? entry.primaryMetric.value.toFixed(3) :
      entry.primaryMetric.value.toFixed(2)}<small>{isBatter ? "OPS" : "ERA"}</small></strong>
  </Link>;
}

export function NpbHotView({ payload, state, now = new Date() }: {
  payload: NpbHotPayload | null; state: "loading" | "ready" | "error"; now?: Date;
}) {
  const expectedDate = expectedNpbHotDate(now);
  const stale = payload && payload.effectiveDate < expectedDate;
  const future = payload && payload.effectiveDate > expectedDate;
  return <section className="home-section home-section--compact npb-hot-section" aria-label="HOT">
    <SectionHeader title="HOT" />
    {state === "loading" && <LoadingSkeleton />}
    {state === "error" && <DataState kind="source-unavailable" title="HOTデータを取得できませんでした" />}
    {state === "ready" && future && <DataState kind="source-unavailable" title="HOTデータの基準日を確認できません" />}
    {state === "ready" && payload && !future && <>
      <p className="standings-asof">{formatDate(payload.effectiveDate, true)}終了時点 · 直近7日{stale && " · 更新未確認"}</p>
      {payload.readiness.status === "not_ready" ?
        <DataState kind="no-data" title="HOTランキングは現在表示できません"
          detail={`${payload.readiness.reasons.map(reason => readinessDetails[reason]).join("。")}。`} /> : stale ?
        <DataState kind="no-data" title="最新のHOT集計を確認できません" /> :
        <div className="npb-hot-groups">{([
          ["注目打者", payload.batting], ["注目先発", payload.starters],
          ["注目救援", payload.relievers],
        ] as const).map(([title, entries]) => <div className="npb-hot-group" key={title}>
          <h3>{title}</h3>
          <div className="npb-hot-list">{entries.slice(0, 3).map((entry) =>
            <HotCard key={`${entry.role}:${entry.playerId}`} entry={entry} />)}</div>
        </div>)}</div>}
    </>}
  </section>;
}

export function NpbHotSection({ repository }: { repository: { findLatestNpb(): Promise<NpbHotPayload> } }) {
  const [payload, setPayload] = useState<NpbHotPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    void repository.findLatestNpb().then((value) => {
      if (active) { setPayload(value); setState("ready"); }
    }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [repository]);
  return <NpbHotView payload={payload} state={state} />;
}
