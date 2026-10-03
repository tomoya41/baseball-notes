import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { formatOuts } from "../domain/player-game-log";
import type { NpbGameDetail } from "../domain/npb-game-detail";
import { formatDate } from "../presentation/formatters";
import { DataState, LoadingSkeleton, MetricLabel } from "./components";
import { ScoreHero } from "./design-system";
import type { Services } from "../app/services";
import { GameRecap, GameTeamLinks, NpbGamePreview } from "./game-story";
import type { FavoriteActions } from "./team-favorite";

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

export function NpbGameDetailView({ payload, state, services, actions }: { payload: NpbGameDetail | null; state: DetailState; services?: Services; actions?: FavoriteActions }) {
  if (state === "loading") return <div className="screen game-detail" aria-label="試合詳細の読み込み中"><LoadingSkeleton /></div>;
  if (state === "missing") return <div className="screen game-detail"><h1>試合詳細</h1>
    <DataState kind="no-data" title="試合が見つかりません" /></div>;
  if (state === "error" || !payload) return <div className="screen game-detail"><h1>試合詳細</h1>
    <DataState kind="source-unavailable" title="試合データを取得できませんでした" /></div>;
  const hasBox = payload.status === "final";
  return <div className="screen game-detail">
    <a className="back-link" href={`#/NPB/schedule?date=${payload.date}`}>日程・結果に戻る</a>
    <header className="game-detail__header"><p>NPB / 試合詳細</p><h1>{formatDate(payload.date, true)}の試合</h1>
      <p>{statusName[payload.status]}{payload.gameNumber > 1 ? ` · 第${payload.gameNumber}試合` : ""}</p></header>
    <ScoreHero away={payload.away.shortName} home={payload.home.shortName} awayScore={payload.away.score} homeScore={payload.home.score} status={statusName[payload.status]} />
    {actions && <GameTeamLinks league="NPB" teams={[payload.away, payload.home]} {...actions} />}
    {payload.status === "scheduled" && services && <NpbGamePreview game={payload} services={services} favorites={actions?.favorites ?? []} />}
    {hasBox && <GameRecap league="NPB" complete={payload.completeness === "complete"} favorites={actions?.favorites ?? []} batting={[...payload.batting.away, ...payload.batting.home]} pitching={[...payload.pitching.away, ...payload.pitching.home].map(p => ({ ...p, outs: p.outsRecorded, so: p.strikeouts }))} />}
    {payload.status !== "final" && <p className="game-detail__note">{statusName[payload.status]}のため、試合別成績はありません。</p>}
    {hasBox && payload.completeness !== "complete" && <p className="game-detail__note" role="status">
      {payload.completeness === "partial" || payload.completeness === "failed" ?
        "一部の成績を取得できていません。" : "この試合の成績収集完了を確認できていません。"}</p>}
    {hasBox && (["away", "home"] as const).map((side) => {
      const team = payload[side], batting = payload.batting[side], pitching = payload.pitching[side];
      return <section className="game-detail__team" key={side} aria-label={`${side === "away" ? "ビジター" : "ホーム"} ${team.shortName}のボックススコア`}>
        <h2>{side === "away" ? "ビジター" : "ホーム"} · {team.shortName}</h2>
        <p className="game-detail__totals">チーム合計：{value(team.totals.runs)}得点 · {value(team.totals.hits)}安打 ·
          {value(team.totals.homeRuns)}本塁打 · PA {value(team.totals.pa)}
          {team.totals.paSource === "opponentBf" ? "（相手投手BFから確認）" : ""} · AB {value(team.totals.ab)}</p>
        <h3>打撃</h3><p className="table-scroll-hint">横にスワイプして成績を見る →</p>{batting.length ? <>
          <div className="mlb-stat-scroll box-primary" tabIndex={0} role="region" aria-label={`${team.shortName}の打撃成績。横スクロールできます`}><table><thead><tr><th>打順</th><th>選手</th><th><MetricLabel metric="PA" /></th><th><MetricLabel metric="AB" /></th><th>H</th><th>HR</th><th>RBI</th></tr></thead><tbody>{batting.map(row => <tr key={`${row.playerId}:${row.teamId}`}><td>{row.battingOrder === null ? "—" : `${row.battingOrder}番`}</td><th scope="row"><a href={`#/NPB/players/${encodeURIComponent(row.playerId)}`}>{row.name}</a><small>{row.starter === true ? "先発" : row.starter === false ? "途中出場" : "出場形態未確認"}{row.pa === 0 && row.ab === 0 && " · 打席なし"}</small></th>{[row.pa,row.ab,row.hits,row.homeRuns,row.rbi].map((n,i) => <td key={i}>{value(n)}</td>)}</tr>)}</tbody></table></div>
          <details><summary>詳しい打撃成績</summary><div className="mlb-stat-scroll" tabIndex={0} role="region" aria-label={`${team.shortName}の打撃詳細`}><table><thead><tr><th>選手</th>{battingDetails.map(c => <th key={c.key}><MetricLabel metric={c.label} /></th>)}</tr></thead><tbody>{batting.map(row => <tr key={`${row.playerId}:${row.teamId}`}><th scope="row">{row.name}</th>{battingDetails.map(c => <td key={c.key}>{value(row[c.key])}</td>)}</tr>)}</tbody></table></div></details>
        </> : <p className="game-detail__note">保存済み打撃成績はありません。</p>}
        <h3>投球</h3>{pitching.length ? <>
          <div className="mlb-stat-scroll box-primary" tabIndex={0} role="region" aria-label={`${team.shortName}の投球成績。横スクロールできます`}><table><thead><tr><th>選手</th><th><MetricLabel metric="IP" /></th><th>SO</th><th>R</th><th>ER</th></tr></thead><tbody>{pitching.map(row => <tr key={`${row.playerId}:${row.teamId}`}><th scope="row"><a href={`#/NPB/players/${encodeURIComponent(row.playerId)}`}>{row.name}</a><small>{roleName[row.role]}{row.decision && row.decision !== "none" && ` · ${decisionName[row.decision]}`}</small></th><td>{formatOuts(row.outsRecorded)}回</td>{[row.strikeouts,row.runs,row.earnedRuns].map((n,i) => <td key={i}>{value(n)}</td>)}</tr>)}</tbody></table></div>
          <details><summary>詳しい投球成績</summary><div className="mlb-stat-scroll" tabIndex={0} role="region" aria-label={`${team.shortName}の投球詳細`}><table><thead><tr><th>選手</th>{pitchingDetails.map(c => <th key={c.key}><MetricLabel metric={c.label} /></th>)}</tr></thead><tbody>{pitching.map(row => <tr key={`${row.playerId}:${row.teamId}`}><th scope="row">{row.name}</th>{pitchingDetails.map(c => <td key={c.key}>{value(row[c.key])}</td>)}</tr>)}</tbody></table></div></details>
        </> : <p className="game-detail__note">保存済み投球成績はありません。</p>}
        <p className="game-detail__minor">同じ打順の交代順・救援投手の登板順は表示順から判断できません。</p>
      </section>;
    })}
  </div>;
}

export function NpbGameDetailScreen({ repository, services, favorites = [], toggle, saving = false }: { repository: { find(gameId: string): Promise<NpbGameDetail | null> }; services?: Services; favorites?: FavoriteActions["favorites"]; toggle?: FavoriteActions["toggle"]; saving?: boolean }) {
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
  return <NpbGameDetailView payload={payload} state={state} {...services ? { services } : {}} {...toggle ? { actions: { favorites, toggle, saving } } : {}} />;
}
