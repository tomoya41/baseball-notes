import { useEffect, useState } from "react";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";
import type { RecentPeriod } from "../domain/player-recent";
import { readPublishedPlayerStats, type PublishedPlayerStats } from "../application/npb-published-player";
import { DataState, LoadingSkeleton } from "./components";
import { StatTiles } from "./player-recent";

export function PublishedPlayerFallback({ playerId, period, repository, pitcherBatting = false, reason = "api_unavailable", role }: {
  playerId: string; period: RecentPeriod; repository: { findLatestNpb(): Promise<NpbPlayerDirectory> }; pitcherBatting?: boolean;
  reason?: "api_unavailable" | "saved";
  role?: "batting" | "pitching";
}) {
  const [data, setData] = useState<PublishedPlayerStats | null>(null), [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void readPublishedPlayerStats(playerId, period, repository).then(value => { if (active) { setData(value); setState("ready"); } })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [playerId, period, repository, attempt]);
  const retry = () => { setState("loading"); setAttempt(a => a + 1); };
  if (state === "loading") return <LoadingSkeleton />;
  if (state === "error") return <><DataState kind="source-unavailable" title={period === "currentMonth" ? "今月の成績は現在確認できません" : reason === "saved" ? "保存済み成績を読み込めません" : "APIと保存済み成績を読み込めません"} />{period !== "currentMonth" && <button onClick={retry}>保存済み成績を再試行</button>}</>;
  return <section className="stats-section" aria-label="公開保存済みの成績">
    <h2>{period === "season" ? "2026年の保存済みシーズン成績" : `${period.slice(0, -1)}日間の保存済み成績`}</h2>
    <p className="data-notice" role="status">{reason === "api_unavailable" ? "成績の更新を確認できないため、公開済みの保存データを表示しています。" : "公開済みの保存データを表示しています。"}現在の更新状況を確認できていません。</p>
    {!data ? <DataState kind="no-data" title="この選手・期間の公開済み成績は未収録です" /> : <>
      <p>{data.period.from}〜{data.period.to} · 公開基準日 {data.effectiveDate}</p>
      <p className="inline-note">収録状況：{data.coverage.status === "complete" ? "公開時点で収録完了" : data.coverage.status === "partial" ? "一部未収集" : "完了未確認"}。新たな取得成功・現在の完全収録を示しません。</p>
      {role !== "pitching" && data.player.batting && (pitcherBatting ? <details><summary>投手の打撃成績</summary><StatTiles stats={data.player.batting} keys={["G", "PA", "AVG", "H", "HR", "OPS"]} /></details> : <><h3>打撃</h3><StatTiles stats={data.player.batting} keys={["G", "PA", "AVG", "H", "HR", "RBI", "OPS"]} /></>)}
      {role !== "batting" && data.player.pitching && <><h3>投球</h3><StatTiles stats={data.player.pitching} keys={["G", "W", "L", "ERA", "outsRecorded", "SO", "K9"]} labelOverrides={{ G: "登板" }} /></>}
      {role && !data.player[role] && <DataState kind="no-data" title="選択した役割の公開済み成績は未収録です" />}
      <details><summary>公開時点の収録状況</summary><p>完了 {data.coverage.summary.complete}日・部分 {data.coverage.summary.partial}日・失敗 {data.coverage.summary.failed}日・未確認 {data.coverage.summary.unknown}日。日別の詳細証拠はこの公開集計には含まれません。欠損値は「—」、未収録を出場なしとは判定しません。</p><p>データ生成：{data.generatedAt}。既存のnf3保存済みFactsから作成された公開集計です。HOT／ランキングの公開条件は変更していません。</p></details>
    </>}
  </section>;
}
