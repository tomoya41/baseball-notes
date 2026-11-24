import type { JapanSeriesBoxScore } from "../data/npb-japan-series-box-scores";
import { formatOuts } from "../domain/player-game-log";
import { npbTeamShortName } from "./npb-team-names";
import { StatTable } from "./stat-table";

const decisions: Record<string, string> = { 勝: "勝利投手", 敗: "敗戦投手", S: "セーブ", H: "ホールド" };

export function JapanSeriesBoxScoreTables({ box }: { box: JapanSeriesBoxScore }) {
  const hasUncollected = box.teams.some(team =>
    team.batting.some(row => row.atBats === null) || team.pitching.some(row => row.strikeouts === null));
  return <section className="box-primary" aria-labelledby="japan-box-score-title">
    <h2 id="japan-box-score-title">個人成績</h2>
    {hasUncollected && <p className="inline-note">「—」は、出典間で値が一致せず未収録の項目です。</p>}
    {box.teams.map(team => {
      const name = npbTeamShortName(team.teamId);
      return <div key={team.teamId}>
        <details className="advanced-disclosure">
          <summary>{name}の打撃</summary>
          <StatTable>
            <caption className="sr-only">{name}の打撃成績</caption>
            <thead><tr><th>選手</th><th>打数</th><th>安打</th><th>本塁打</th><th>打点</th></tr></thead>
            <tbody>{team.batting.map(row => <tr key={row.name}>
              <th>{row.name}</th><td>{row.atBats ?? "—"}</td><td>{row.hits}</td><td>{row.homeRuns}</td><td>{row.rbi}</td>
            </tr>)}</tbody>
          </StatTable>
        </details>
        <details className="advanced-disclosure">
          <summary>{name}の投球</summary>
          <StatTable>
            <caption className="sr-only">{name}の投球成績</caption>
            <thead><tr><th>選手</th><th>投球回</th><th>奪三振</th><th>自責点</th></tr></thead>
            <tbody>{team.pitching.map(row => <tr key={row.name}>
              <th>{row.name}{row.decision && <small>{decisions[row.decision]}</small>}</th>
              <td>{formatOuts(row.outs)}</td><td>{row.strikeouts ?? "—"}</td><td>{row.earnedRuns}</td>
            </tr>)}</tbody>
          </StatTable>
        </details>
      </div>;
    })}
  </section>;
}
