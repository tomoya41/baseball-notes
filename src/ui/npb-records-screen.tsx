import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { GameSurfaceReader } from "../application/game-surface";
import type { NpbRecords } from "../domain/npb-records";
import { readinessReasonLabel } from "../presentation/baseball-language";
import { DataState, LoadingSkeleton, MetricLabel } from "./components";
import "./npb-personal-records.css";

const metricNames = { HR: "本塁打", H: "安打", RBI: "打点", SB: "盗塁", SO: "奪三振", W: "勝利", SV: "セーブ", HLD: "ホールド" } as const;

export function RecordsView({ payload }: { payload: NpbRecords }) {
  return <>
    <p className="records-scope">{payload.season}年 · 公式戦 · 保存済み成績 <time dateTime={payload.effectiveDate}>{payload.effectiveDate}まで</time></p>
    {payload.readiness !== "ready" ? <section className="records-gate" aria-labelledby="records-gate-title">
      <span className="records-status-label">順位の公開待ち</span>
      <h2 id="records-gate-title">{payload.season}年シーズン集計を確認中</h2>
      <p>収録範囲と規定到達の確認が揃った順位を掲載します。</p>
      <details className="records-gate-detail"><summary>確認している条件</summary>
        <p>シーズンの収録 {payload.coverage === "complete" ? "確認済み" : "確認中"} · 規定到達 {payload.qualifierStatus === "verified" ? "確認済み" : "確認中"}</p>
        {payload.reasons.length > 0 && <ul>{[...new Set(payload.reasons)].map(reason => <li key={reason}>{readinessReasonLabel(reason)}</li>)}</ul>}
      </details>
    </section> : <div className="records-categories">{payload.categories.map(category => <section className="records-category" key={`${category.role}:${category.metric}`}>
      <header><div><p className="eyebrow">{category.role === "batting" ? "打撃" : "投球"}</p><h2>{metricNames[category.metric]}</h2></div><MetricLabel metric={category.metric} label={`${category.metric}の見方`} /></header>
      {category.rows.length ? <ol className="records-ranking">{category.rows.map(row => <li key={row.playerId}>
        <Link to={`/NPB/players/${encodeURIComponent(row.playerId)}`}>
          <span className="records-rank"><strong>{row.rank}</strong><small>位</small></span>
          <span className="records-player-name">{row.displayName}</span>
          <strong className="records-value">{row.value.toLocaleString("ja-JP")}</strong>
        </Link>
      </li>)}</ol> : <p className="inline-note">この項目の順位は未収録です。</p>}
    </section>)}</div>}
  </>;
}

export function NpbRecordsScreen({ repository }: { repository: Pick<GameSurfaceReader, "records"> }) {
  const [payload, setPayload] = useState<NpbRecords | null>(null), [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void repository.records().then(value => { if (active) { setPayload(value); setError(false); } }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [repository, attempt]);

  return <div className="screen npb-records-screen">
    <header className="personal-records-heading"><p className="eyebrow">NPB / Records</p><h1>記録をたどる</h1><p>シーズンの数字から、選手の歩みへ。</p></header>
    <nav className="records-paths" aria-label="記録の種類">
      <Link to="/NPB/awards"><small>受賞年度から</small><strong>タイトル・表彰</strong><span aria-hidden="true">↗</span></Link>
      <Link to="/NPB/milestones"><small>保存済みの数字から</small><strong>シーズンの節目</strong><span aria-hidden="true">↗</span></Link>
      <Link to="/NPB/history?season=2025"><small>年度ごとに</small><strong>過去の成績を比較</strong><span aria-hidden="true">↗</span></Link>
    </nav>
    <section className="records-season-section" aria-labelledby="records-season-title">
      <div className="personal-section-heading"><h2 id="records-season-title">シーズン記録</h2><span>公式戦</span></div>
      {error ? <><DataState kind="source-unavailable" title="記録データを読み込めません" /><button type="button" className="button button--secondary" onClick={() => { setError(false); setPayload(null); setAttempt(value => value + 1); }}>再試行</button></> : payload ? <RecordsView payload={payload} /> : <LoadingSkeleton />}
    </section>
  </div>;
}
