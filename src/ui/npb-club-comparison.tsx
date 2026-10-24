import { RosterContextLink as Link } from "./roster-navigation";

import type { NpbHistoricalRow } from "../domain/npb-historical";
import { historicalClubComparison, type ProgressionMetric } from "../domain/npb-player-progression";
import { comparisonValue, type ComparisonRow } from "../domain/product-comparison";
import { ComparisonBars } from "./comparison-bars";
import { MetricLabel } from "./components";

/** Reuses the annual view's already validated rows; opening this comparison makes no request. */
export function NpbClubComparison({ rows, years, metric, teamName }: {
  rows: NpbHistoricalRow[]; years: number[]; metric: ProgressionMetric; teamName: (id: string) => string;
}) {
  const { clubs, missingSeasons } = historicalClubComparison(rows, years), player = rows[0];
  if (!player || clubs.length < 2) return null;
  const comparison: ComparisonRow[] = clubs.map(club => ({
    id: club.teamId, name: teamName(club.teamId), season: club.seasons.at(-1)!,
    date: club.seasons.join(" / "), coverage: "partial",
    metrics: Object.fromEntries(Object.entries(club.metrics).map(([key, value]) => [key, { value, status: value === null ? "unavailable" : "partial" }])),
  }));
  return <details className="advanced-disclosure">
    <summary>球団別に見比べる · {clubs.length}球団</summary>
    <p>選択した年度の、収録済みの球団別成績です。同じ球団の行をまとめ、率は構成項目から再計算しています。集計年度・出場母数は球団ごとに異なります。</p>
    <ComparisonBars rows={comparison} metric={metric} />
    <div className="row-list">{clubs.map(club => <section key={club.teamId} aria-label={`${teamName(club.teamId)}の収録成績`}>
      <h4>{teamName(club.teamId)}</h4>
      <p>収録年度：{club.seasons.join(" / ")}年 · {club.sample === null ? "母数未収録" : player.role === "batting" ? `${club.sample}打席` : `${comparisonValue("outsRecorded", club.sample)}回`}</p>
      <dl className="explorer-values">{(player.role === "batting" ? ["G", "HR", "AVG", "OPS"] : ["G", "SO", "ERA", "WHIP"]).map(key => <div key={key}><dt><MetricLabel metric={key} /></dt><dd>{comparisonValue(key, club.metrics[key] ?? null)}</dd></div>)}</dl>
      <div className="hub-links">{club.seasons.map(year => <Link key={year} to={`/NPB/players/${player.playerId}/seasons?season=${year}&role=${player.role}&years=${year}`}>
        {year}年の球団別内訳 →
      </Link>)}</div>
    </section>)}</div>
    {missingSeasons.length > 0 && <p className="data-notice">{missingSeasons.join(" / ")}年のこの役割は未収録です。出場なし・ゼロとは扱いません。</p>}
    <p className="inline-note">同一年の複数球団も別々に表示します。連続した在籍期間・移籍日・移籍理由や、移籍による成績への効果は示しません。再加入の前後も、同じ球団の収録行として合計します。全キャリア通算や公式の球団別記録ではありません。</p>
    <button type="button" className="text-link" onClick={() => {
      const source = document.getElementById("historical-comparison-sources");
      source?.focus({ preventScroll: true }); source?.scrollIntoView({ block: "start" });
    }}>この比較の出典・利用条件</button>
  </details>;
}
