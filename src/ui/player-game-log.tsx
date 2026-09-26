import { ChevronRight } from "lucide-react";
import { formatOuts, type PlayerBattingLog, type PlayerGameLogResponse, type PlayerPitchingLog } from "../domain/player-game-log";
import { formatDate } from "../presentation/formatters";
import { DataState, LoadingSkeleton, SectionHeader } from "./components";

type LogState = "loading" | "ready" | "missing" | "error";
const value = (number: number | null) => number === null ? "—" : String(number);
const label: Record<string, string> = { pa: "PA", ab: "AB", runs: "R", hits: "H", doubles: "2B",
  triples: "3B", homeRuns: "HR", rbi: "RBI", walks: "BB", hbp: "HBP",
  sacrificeHits: "SH", sacrificeFlies: "SF", strikeouts: "SO", stolenBases: "SB",
  caughtStealing: "CS", battersFaced: "BF", earnedRuns: "ER", pitchCount: "投球数",
  walksAndHitByPitch: "四死" };
const battingKeys = ["pa", "ab", "runs", "hits", "doubles", "triples", "homeRuns", "rbi", "walks",
  "hbp", "sacrificeHits", "sacrificeFlies", "strikeouts", "stolenBases", "caughtStealing"] as const;
const pitchingKeys = ["battersFaced", "hits", "homeRuns", "strikeouts", "runs", "earnedRuns",
  "pitchCount", "walksAndHitByPitch"] as const;
const statusLabel: Record<string, string> = { final: "試合終了", scheduled: "開始前", postponed: "延期",
  canceled: "中止", suspended: "中断", unknown: "状態未確認" };
const resultLabel: Record<string, string> = { win: "勝", loss: "負", tie: "引分" };
const decisionLabel: Record<string, string> = { win: "勝", loss: "敗", hold: "H", save: "S" };

function gameHeader(row: PlayerBattingLog | PlayerPitchingLog, teams: ReadonlyMap<string, string>) {
  const opponent = teams.get(row.opponentTeamId) ?? "相手球団未登録";
  const own = row.side === "home" ? row.homeScore : row.awayScore;
  const other = row.side === "home" ? row.awayScore : row.homeScore;
  return <div className="game-log-card__header"><div>
    <strong>{formatDate(row.date, true)} · 対{opponent}</strong>
    <small>{row.side === "home" ? "ホーム" : "ビジター"} · {statusLabel[row.status]}
      {row.gameNumber > 1 ? ` · 第${row.gameNumber}試合` : ""}</small>
  </div><span className="game-log-card__result">{row.result ? resultLabel[row.result] : "—"}
    {own !== null && other !== null ? ` ${own}–${other}` : ""}</span></div>;
}

function details(row: PlayerBattingLog | PlayerPitchingLog, keys: readonly string[]) {
  const record = row as unknown as Record<string, number | null>;
  return <details className="game-log-card__details"><summary aria-label={`${row.date}の詳細成績`}>詳細成績
    <ChevronRight size={16} aria-hidden="true" /></summary><dl className="game-log-card__metrics">
      {keys.map((key) => <div key={key}><dt>{label[key]}</dt><dd>{value(record[key] ?? null)}</dd></div>)}
    </dl></details>;
}

function battingSummary(row: PlayerBattingLog): string {
  if (row.pa === 0 && row.ab === 0) return row.starter === false ? "途中出場 / 打席なし" : "打席なし";
  const parts = [row.ab !== null && row.hits !== null ? `${row.ab}打数${row.hits}安打` :
    row.hits !== null ? `${row.hits}安打` : "打撃記録あり"];
  if (row.homeRuns && row.homeRuns > 0) parts.push(`${row.homeRuns}本塁打`);
  if (row.rbi && row.rbi > 0) parts.push(`${row.rbi}打点`);
  return parts.join(" · ");
}
function pitchingSummary(row: PlayerPitchingLog): string {
  const parts = [row.outsRecorded === null ? "投球回不明" : `${formatOuts(row.outsRecorded)}回`];
  if (row.hits !== null) parts.push(`${row.hits}安打`);
  if (row.runs === 0) parts.push("無失点");
  else if (row.runs !== null) parts.push(`${row.runs}失点`);
  if (row.strikeouts !== null) parts.push(`${row.strikeouts}奪三振`);
  return parts.join(" · ");
}

export function PlayerGameLogView({ payload, state, teams }: { payload: PlayerGameLogResponse | null;
  state: LogState; teams: ReadonlyMap<string, string> }) {
  const empty = payload?.batting.length === 0 && payload.pitching.length === 0;
  return <section className="stats-section player-game-log" aria-label="試合別成績">
    <SectionHeader title="試合別成績" />
    <p className="game-log-note">保存済みデータの最新試合・登板</p>
    {state === "loading" && <div aria-live="polite"><LoadingSkeleton /></div>}
    {state === "error" && <DataState kind="source-unavailable" title="試合別成績を読み込めません" />}
    {state === "missing" && <DataState kind="no-data" title="選手の試合別成績が見つかりません" />}
    {state === "ready" && empty && <DataState kind="no-data" title="保存済みの試合別成績はありません" />}
    {state === "ready" && payload?.batting.length ? <div className="game-log-group"><h3>打撃</h3>
      <ol className="game-log-list">{payload.batting.map((row) => <li className="game-log-card" key={row.gameId}>
        {gameHeader(row, teams)}<p className="game-log-card__summary">{battingSummary(row)}</p>
        <p className="game-log-card__meta">{row.battingOrder !== null ? `${row.battingOrder}番` : ""}
          {row.starter === true ? " · 先発" : row.starter === false ? " · 途中出場" : ""}
          {row.walks !== null && row.walks > 0 ? ` · ${row.walks}四球` : ""}
          {row.strikeouts !== null && row.strikeouts > 0 ? ` · ${row.strikeouts}三振` : ""}</p>
        {details(row, battingKeys)}
      </li>)}</ol></div> : null}
    {state === "ready" && payload?.pitching.length ? <div className="game-log-group"><h3>投球</h3>
      <ol className="game-log-list">{payload.pitching.map((row) => <li className="game-log-card" key={row.gameId}>
        {gameHeader(row, teams)}<p className="game-log-card__summary">{pitchingSummary(row)}</p>
        <p className="game-log-card__meta">{row.role === "starter" ? "先発" : row.role === "reliever" ? "救援" : ""}
          {row.decision && row.decision !== "none" ? ` · ${decisionLabel[row.decision]}` : ""}</p>
        {details(row, pitchingKeys)}
      </li>)}</ol></div> : null}
  </section>;
}
