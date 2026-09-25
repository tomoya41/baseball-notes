import { ChevronRight } from "lucide-react";
import type { PlayerRecentResponse, RecentPeriod } from "../domain/player-recent";
import { formatDate } from "../presentation/formatters";
import { formatRecentMetric } from "../presentation/recent-formatter";
import { DataState, LoadingSkeleton, SectionHeader } from "./components";

type PeriodStats = NonNullable<PlayerRecentResponse["batting"]>;
type RecentState = "loading" | "ready" | "missing" | "error";

const battingPrimary = ["G", "PA", "AVG", "OBP", "SLG", "OPS", "H", "HR", "RBI", "BB", "SO"] as const;
const battingDetail = ["AB", "R", "2B", "3B", "HBP", "SH", "SF", "SB", "CS"] as const;
const pitchingPrimary = ["G", "GS", "outsRecorded", "ERA", "SO", "K9", "BF", "H", "HR", "R", "ER", "pitchCount"] as const;
const pitchingDetail = ["W", "L", "HLD", "SV"] as const;
const labels: Record<string, string> = { G: "試合", PA: "打席", AB: "打数", R: "得点", H: "安打", "2B": "二塁打",
  "3B": "三塁打", HR: "HR", RBI: "打点", BB: "四球", HBP: "死球", SH: "犠打", SF: "犠飛", SO: "三振",
  SB: "盗塁", CS: "盗塁死", GS: "先発", outsRecorded: "IP", ERA: "ERA", K9: "K/9", BF: "対戦打者",
  ER: "自責点", pitchCount: "投球数", W: "勝", L: "敗", HLD: "HLD", SV: "SV" };

function StatTiles({ stats, keys }: { stats: PeriodStats; keys: readonly string[] }) {
  return <div className="metric-grid recent-metrics">{keys.map((key) => <div className="metric-tile" key={key}>
    <span className="metric-tile__label">{labels[key] ?? key}</span>
    <strong className="metric-tile__value">{formatRecentMetric(key, stats.metrics[key])}</strong>
  </div>)}</div>;
}

function CoverageNote({ stats }: { stats: PeriodStats }) {
  const status = stats.coverage.status;
  if (status === "complete") return null;
  const label = status === "partial" ? "一部データ未収集" : status === "unknown"
    ? "収集済みデータから算出" : "収集状況を確認できません";
  const detail = status === "partial" ? "期間内に収集が完了していない試合があります。表示値は取得済みの記録から計算しています。"
    : status === "unknown" ? "この期間の一部について収集完了を証明する履歴がありません。表示値は取得済みの記録から計算しています。"
      : "期間内の収集状況を評価できません。表示値は取得済みの記録から計算しています。";
  return <details className={`recent-coverage recent-coverage--${status}`}>
    <summary>{label}<ChevronRight size={16} aria-hidden="true" /></summary><p>{detail}</p>
  </details>;
}

export function PlayerRecentView({ period, onPeriodChange, payload, state }: {
  period: RecentPeriod; onPeriodChange: (period: RecentPeriod) => void;
  payload: PlayerRecentResponse | null; state: RecentState;
}) {
  const stats = [payload?.batting, payload?.pitching].filter((item): item is PeriodStats => item !== null && item !== undefined);
  return <section className="stats-section player-recent" aria-label="最近の成績">
    <SectionHeader title="最近の成績" />
    <div className="segmented recent-periods" role="group" aria-label="集計期間">
      {(["7d", "14d", "30d"] as const).map((item) => <button key={item} type="button" aria-label={`直近${item.slice(0, -1)}日`}
        aria-pressed={period === item} onClick={() => onPeriodChange(item)}>{item.slice(0, -1)}日</button>)}
    </div>
    {state === "loading" && <div aria-live="polite"><LoadingSkeleton /></div>}
    {state === "error" && <DataState kind="source-unavailable" title="最近の成績を読み込めません" />}
    {state === "missing" && <DataState kind="no-data" title="この期間の出場データはありません" />}
    {state === "ready" && payload && <>
      <p className="recent-dates">{formatDate(payload.asOfDate, true)}終了時点 · {formatDate(stats[0]?.from ?? null, true)}〜{formatDate(stats[0]?.to ?? null, true)}</p>
      {stats.length === 0 && <DataState kind="no-data" title="この期間の出場データはありません" />}
      {payload.batting && <div className="recent-group"><h3>打撃</h3>
        <StatTiles stats={payload.batting} keys={battingPrimary} />
        <CoverageNote stats={payload.batting} />
        <details className="advanced-disclosure"><summary>詳細成績<ChevronRight size={18} aria-hidden="true" /></summary>
          <StatTiles stats={payload.batting} keys={battingDetail} /></details>
      </div>}
      {payload.pitching && <div className="recent-group"><h3>投球</h3>
        <StatTiles stats={payload.pitching} keys={pitchingPrimary} />
        <CoverageNote stats={payload.pitching} />
        <details className="advanced-disclosure"><summary>勝敗・セーブ<ChevronRight size={18} aria-hidden="true" /></summary>
          <StatTiles stats={payload.pitching} keys={pitchingDetail} /></details>
      </div>}
    </>}
  </section>;
}
