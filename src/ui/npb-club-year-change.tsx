import { historicalProgression, observedClubChanges, type ProgressionMetric, type SeasonObservation } from "../domain/npb-player-progression";
import type { NpbHistoricalRow } from "../domain/npb-historical";
import { comparisonValue } from "../domain/product-comparison";
import { ComparisonBars } from "./comparison-bars";
import { SaveViewButton } from "./personal-library";
import { RosterContextLink as Link } from "./roster-navigation";
import "./npb-historical-comparison.css";
import "./npb-club-year-change.css";

const pairKey = ({ before, after }: { before: SeasonObservation; after: SeasonObservation }) => `${before.season},${after.season}`;

export function NpbClubYearChange({ points, rows, metric, label, teamName, observedAt, selectedPair, setPair }: {
  points: SeasonObservation[];
  rows: NpbHistoricalRow[];
  metric: ProgressionMetric;
  label: string;
  teamName: (id: string) => string;
  observedAt?: string | undefined;
  selectedPair: string | null;
  setPair: (pair: string) => void;
}) {
  const player = rows[0];
  if (!player) return null;
  const pairs = observedClubChanges(points);
  const pair = pairs.find(candidate => pairKey(candidate) === selectedPair) ?? pairs.at(-1);
  const split = points.filter(point => point.teams.length > 1);
  const recorded = points.filter(point => point.teams.length);
  const gaps = recorded.slice(1).some((point, i) => point.season > recorded[i]!.season + 1);
  const missing = points.filter(point => !point.teams.length);
  if (!pair && !split.length && !missing.length && !(gaps && new Set(recorded.flatMap(point => point.teams)).size > 1)) return null;

  const unit = player.role === "batting" ? "打席" : "回";
  const sample = (point: SeasonObservation) => point.sample === null ? "母数未収録" :
    `${comparisonValue(player.role === "batting" ? "PA" : "outsRecorded", point.sample)}${unit}`;
  const value = (point: SeasonObservation) => comparisonValue(metric, point.metrics[metric] ?? null);
  const seasonLink = (season: number) => `/NPB/players/${player.playerId}/seasons?season=${season}&role=${player.role}&years=${season}&trendMetric=${metric}`;
  const before = pair?.before.metrics[metric], after = pair?.after.metrics[metric];
  const delta = before != null && after != null ? after - before : null;
  const difference = delta === null ? "比較値を計算できません" :
    `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${comparisonValue(metric, Math.abs(delta))}${metric === "outsRecorded" ? "回" : ""}`;
  return <section className="historical-comparison club-year-change" aria-label="球団が異なる年度の成績差">
    <div className="historical-comparison-heading">
      <div><p className="eyebrow">NPB · 過去の公式戦</p><h3>球団が異なる年度を比較</h3></div>
      {pair && pairs.length > 1 && <label>比較する年度<select value={pairKey(pair)} onChange={e => setPair(e.target.value)}>
        {pairs.map(option => <option key={pairKey(option)} value={pairKey(option)}>{option.before.season}年 → {option.after.season}年</option>)}
      </select></label>}
    </div>
    {pair ? <>
      <p className="club-year-delta"><span>{label}の差（{pair.after.season}年 − {pair.before.season}年）</span> <strong>{difference}</strong></p>
      <ComparisonBars metric={metric} rows={[pair.before, pair.after].map(point => ({
        id: String(point.season), name: `${point.season}年 · ${teamName(point.teams[0]!)}`,
        metrics: { [metric]: { value: point.metrics[metric] ?? null, status: point.metrics[metric] == null ? "unavailable" : "partial" } },
      }))} context={{ label, note: "棒は記録値の大きさを示します。差は表示用に丸める前の値から計算します。", render: id => {
        const point = id === String(pair.before.season) ? pair.before : pair.after;
        return <><p className="historical-comparison-period">{sample(point)} · 球団別行の一部収録</p>
          {point.metrics[metric] == null && <p className="historical-comparison-reason">{point.sample === 0 ? "記録された母数が0です。" : "指標の計算に必要な成績が未収録です。"}</p>}
          <div className="historical-comparison-actions"><Link to={seasonLink(point.season)}>{point.season}年の年度成績 →</Link></div></>;
      } }} />
      <SaveViewButton league="NPB" kind="history" params={new URLSearchParams({
        season: String(pair.after.season), role: player.role, player: player.playerId, years: points.map(point => point.season).join(","),
        trendMetric: metric, clubYears: pairKey(pair),
      })} />
    </> : <p>選択した年度に、各年1球団で比較できる連続年はありません。</p>}
    {gaps && <p className="inline-note">比較に含まれない年度があります。各ペアは年が連続する収録行だけを使用します。</p>}
    {missing.length > 0 && <p className="inline-note">{missing.map(point => point.season).join("・")}年はこの役割の成績が未収録です。</p>}
    {split.map(point => <details key={point.season} className="club-year-breakdown">
      <summary>{point.season}年 · {point.teams.length}球団の内訳</summary>
      <dl className="historical-comparison-scope">
        <div><dt>収録行の年度集計</dt><dd>{label} {value(point)} · {sample(point)}</dd></div>
        {rows.filter(row => row.season === point.season).map(row => {
          const club = historicalProgression([row], [row.season])[0]!;
          return <div key={row.teamId}><dt>{teamName(row.teamId)}の球団別行</dt><dd>{label} {value(club)} · {sample(club)}</dd></div>;
        })}
      </dl>
      <p className="inline-note">年度集計の率は収録行の構成値から再計算しています。球団別行の並びは出場順を示しません。</p>
    </details>)}
    <p className="inline-note">過去の公式戦・球団別行の一部収録{observedAt && ` · 保存版 ${observedAt.slice(0, 10)}`}。球団名は収録行の記載に基づきます。移籍の経緯は個別の出典を参照してください。</p>
  </section>;
}
