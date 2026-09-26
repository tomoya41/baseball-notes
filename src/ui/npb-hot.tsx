import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { NpbHotPayload } from "../application/npb-hot-payload";
import { expectedNpbHotDate } from "../domain/npb-hot-date";
import { formatDate } from "../presentation/formatters";
import { DataState, LoadingSkeleton, SectionHeader } from "./components";

type Entry = NpbHotPayload["batting"][number] | NpbHotPayload["starters"][number] |
  NpbHotPayload["relievers"][number];

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
  const stale = payload && payload.effectiveDate !== expectedNpbHotDate(now);
  return <section className="home-section home-section--compact npb-hot-section" aria-label="HOT">
    <SectionHeader title="HOT" />
    {state === "loading" && <LoadingSkeleton />}
    {state === "error" && <DataState kind="source-unavailable" title="HOTデータを取得できませんでした" />}
    {state === "ready" && payload && <>
      <p className="standings-asof">{formatDate(payload.effectiveDate, true)}終了時点 · 直近7日</p>
      {payload.readiness.status === "not_ready" ?
        <DataState kind="no-data" title="HOTランキング準備中"
          detail="直近7日分のデータが揃うと表示されます" /> : stale ?
        <DataState kind="no-data" title="HOTデータを更新中です"
          detail="新しい集計が公開されるまでお待ちください" /> :
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
