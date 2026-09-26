import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { formatOuts } from "../domain/player-game-log";
import type { NpbGameDetail } from "../domain/npb-game-detail";
import { formatDate } from "../presentation/formatters";
import { DataState, LoadingSkeleton } from "./components";

type DetailState = "loading" | "ready" | "missing" | "error";
const value = (number: number | null) => number === null ? "—" : String(number);
const statusName: Record<NpbGameDetail["status"], string> = { final: "試合終了", scheduled: "開始前",
  postponed: "延期", canceled: "中止", suspended: "中断", unknown: "状態未確認" };
const roleName = { starter: "先発", reliever: "救援", unknown: "役割未確認" };
const decisionName = { win: "勝", loss: "敗", hold: "H", save: "S", none: "" };
const battingDetails = [{ key: "pa", label: "PA" }, { key: "runs", label: "得点" },
  { key: "doubles", label: "2B" }, { key: "triples", label: "3B" },
  { key: "walks", label: "BB" }, { key: "hbp", label: "HBP" },
  { key: "sacrificeHits", label: "SH" }, { key: "sacrificeFlies", label: "SF" },
  { key: "strikeouts", label: "SO" }, { key: "stolenBases", label: "SB" },
  { key: "caughtStealing", label: "CS" }] as const;
const pitchingDetails = [{ key: "bf", label: "BF" }, { key: "hits", label: "被安打" },
  { key: "homeRuns", label: "被本塁打" }, { key: "strikeouts", label: "奪三振" },
  { key: "runs", label: "失点" }, { key: "earnedRuns", label: "自責点" },
  { key: "pitchCount", label: "投球数" }, { key: "walksAndHitByPitch", label: "四死" }] as const;

export function NpbGameDetailView({ payload, state }: { payload: NpbGameDetail | null; state: DetailState }) {
  if (state === "loading") return <div className="screen game-detail" aria-label="試合詳細の読み込み中"><LoadingSkeleton /></div>;
  if (state === "missing") return <div className="screen game-detail"><h1>試合詳細</h1>
    <DataState kind="no-data" title="試合が見つかりません" /></div>;
  if (state === "error" || !payload) return <div className="screen game-detail"><h1>試合詳細</h1>
    <DataState kind="source-unavailable" title="試合データを取得できませんでした" /></div>;
  const hasBox = payload.status === "final";
  return <div className="screen game-detail">
    <header className="game-detail__header"><p>NPB / 試合詳細</p><h1>{formatDate(payload.date, true)}の試合</h1>
      <p>{statusName[payload.status]}{payload.gameNumber > 1 ? ` · 第${payload.gameNumber}試合` : ""}</p></header>
    <div className="game-detail__score" aria-label={`${payload.away.shortName} ${value(payload.away.score)}、${payload.home.shortName} ${value(payload.home.score)}`}>
      <div><span>ビジター · {payload.away.shortName}</span><strong>{value(payload.away.score)}</strong></div>
      <div><span>ホーム · {payload.home.shortName}</span><strong>{value(payload.home.score)}</strong></div>
    </div>
    {payload.status !== "final" && <p className="game-detail__note">{statusName[payload.status]}のため、試合別成績はありません。</p>}
    {hasBox && payload.completeness !== "complete" && <p className="game-detail__note" role="status">
      {payload.completeness === "partial" || payload.completeness === "failed" ?
        "一部の成績を取得できていません。" : "この試合の成績収集完了を確認できていません。"}</p>}
    {hasBox && (["away", "home"] as const).map((side) => {
      const team = payload[side], batting = payload.batting[side], pitching = payload.pitching[side];
      return <section className="game-detail__team" key={side} aria-label={`${side === "away" ? "ビジター" : "ホーム"} ${team.shortName}のボックススコア`}>
        <h2>{side === "away" ? "ビジター" : "ホーム"} · {team.shortName}</h2>
        <p className="game-detail__totals">チーム合計：{value(team.totals.runs)}得点 · {value(team.totals.hits)}安打 ·
          {value(team.totals.homeRuns)}本塁打 · PA {value(team.totals.pa)} · AB {value(team.totals.ab)}</p>
        <h3>打撃</h3>{batting.length ? <ol className="game-detail__list">{batting.map((row) => <li className="game-detail__line" key={`${row.playerId}:${row.teamId}`}>
          <div className="game-detail__line-main"><span className="game-detail__order">{row.battingOrder === null ? "—" : `${row.battingOrder}番`}</span>
            <a href={`#/NPB/players/${encodeURIComponent(row.playerId)}`}>{row.name}</a>
            <span className="game-detail__numbers">{value(row.ab)}打数 {value(row.hits)}安打 · {value(row.rbi)}打点 · {value(row.homeRuns)}HR</span></div>
          {row.pa === 0 && row.ab === 0 && <p className="game-detail__minor">打席なし{row.starter === false ? " · 途中出場" : ""}</p>}
          <details><summary>詳しい打撃成績</summary><dl>{battingDetails.map(({ key, label }) =>
            <div key={key}><dt>{label}</dt><dd>{value(row[key])}</dd></div>)}</dl></details>
        </li>)}</ol> : <p className="game-detail__note">保存済み打撃成績はありません。</p>}
        <h3>投球</h3>{pitching.length ? <ol className="game-detail__list">{pitching.map((row) => <li className="game-detail__line" key={`${row.playerId}:${row.teamId}`}>
          <div className="game-detail__line-main"><span className="game-detail__order">{roleName[row.role]}</span>
            <a href={`#/NPB/players/${encodeURIComponent(row.playerId)}`}>{row.name}</a>
            <span className="game-detail__numbers">{formatOuts(row.outsRecorded)}回 · {value(row.hits)}安打 · {value(row.runs)}失点 · {value(row.strikeouts)}奪三振</span></div>
          {row.decision && row.decision !== "none" && <p className="game-detail__minor">{decisionName[row.decision]}</p>}
          <details><summary>詳しい投球成績</summary><dl>{pitchingDetails.map(({ key, label }) =>
            <div key={key}><dt>{label}</dt><dd>{value(row[key])}</dd></div>)}</dl></details>
        </li>)}</ol> : <p className="game-detail__note">保存済み投球成績はありません。</p>}
      </section>;
    })}
  </div>;
}

export function NpbGameDetailScreen({ repository }: { repository: { find(gameId: string): Promise<NpbGameDetail | null> } }) {
  const { gameId } = useParams();
  const [payload, setPayload] = useState<NpbGameDetail | null>(null);
  const [state, setState] = useState<DetailState>("loading");
  useEffect(() => {
    if (!gameId) return;
    let active = true;
    void repository.find(gameId).then((value) => {
      if (active) { setPayload(value); setState(value ? "ready" : "missing"); }
    }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [gameId, repository]);
  return <NpbGameDetailView payload={payload} state={state} />;
}
