import type { ToggleEvent } from "react";
import { Link } from "react-router-dom";
import type { JapanSeriesBoxScore, japanSeriesPlayerGames } from "../data/npb-japan-series-box-scores";
import { japanSeriesPlayerId } from "../data/npb-japan-series-box-scores";
import { npbGamePlayerLinks, type NpbGamePlayerContext } from "../domain/npb-game-player-journey";
import { formatOuts } from "../domain/player-game-log";
import { NpbGamePlayerLink } from "./npb-game-player-link";
import { npbTeamShortName } from "./npb-team-names";
import { StatTable } from "./stat-table";

const decisions: Record<string, string> = { 勝: "勝利投手", 敗: "敗戦投手", S: "セーブ", H: "ホールド" };
type BoxSelection = Pick<NpbGamePlayerContext, "side" | "role">;
type PlayerGame = ReturnType<typeof japanSeriesPlayerGames>[number];
const battingLabels = ["打数", "安打", "本塁打", "打点"];
const pitchingLabels = ["投球回", "奪三振", "自責点"];

const battingValues = (row: JapanSeriesBoxScore["teams"][number]["batting"][number]) =>
  [row.atBats ?? "—", row.hits, row.homeRuns, row.rbi];
const pitchingValues = (row: JapanSeriesBoxScore["teams"][number]["pitching"][number]) =>
  [formatOuts(row.outs), row.strikeouts ?? "—", row.earnedRuns];

export function JapanSeriesBoxScoreTables({ box, selection, onSelection }: {
  box: JapanSeriesBoxScore;
  selection?: BoxSelection | undefined;
  onSelection?: (value: BoxSelection | undefined) => void;
}) {
  const hasUncollected = box.teams.some(team =>
    team.batting.some(row => row.atBats === null) || team.pitching.some(row => row.strikeouts === null));
  return <section className="box-primary japan-series-box-score" aria-labelledby="japan-box-score-title">
    <h2 id="japan-box-score-title">個人成績</h2>
    {hasUncollected && <p className="inline-note">「—」は、出典間で値が一致せず未収録の項目です。</p>}
    {box.teams.map((team, index) => {
      const name = npbTeamShortName(team.teamId);
      const side = index === 0 ? "away" : "home";
      const selectionFor = (role: BoxSelection["role"]) => {
        const selected = selection?.side === side && selection.role === role;
        return {
          open: selected,
          onToggle: (event: ToggleEvent<HTMLDetailsElement>) => {
            const { open } = event.currentTarget;
            if (open !== selected) onSelection?.(open ? { side, role } : undefined);
          },
        };
      };
      const player = (recordedName: string, role: BoxSelection["role"]) => {
        const playerId = japanSeriesPlayerId(team.teamId, role, recordedName);
        return playerId
          ? <NpbGamePlayerLink name={recordedName} playerId={playerId} recorded
              context={{ gameId: box.gameId, date: box.date, side, stage: "japan_series", role }} />
          : recordedName;
      };
      return <div key={team.teamId}>
        <details className="advanced-disclosure" {...selectionFor("batting")}>
          <summary>{name}の打撃</summary>
          <StatTable>
            <caption className="sr-only">{name}の打撃成績</caption>
            <thead><tr><th>選手</th>{battingLabels.map(label => <th key={label}>{label}</th>)}</tr></thead>
            <tbody>{team.batting.map(row => <tr key={row.name}>
              <th>{player(row.name, "batting")}</th>{battingValues(row).map((value, index) => <td key={battingLabels[index]}>{value}</td>)}
            </tr>)}</tbody>
          </StatTable>
        </details>
        <details className="advanced-disclosure" {...selectionFor("pitching")}>
          <summary>{name}の投球</summary>
          <StatTable>
            <caption className="sr-only">{name}の投球成績</caption>
            <thead><tr><th>選手</th>{pitchingLabels.map(label => <th key={label}>{label}</th>)}</tr></thead>
            <tbody>{team.pitching.map(row => <tr key={row.name}>
              <th>{player(row.name, "pitching")}{row.decision && <small>{decisions[row.decision]}</small>}</th>
              {pitchingValues(row).map((value, index) => <td key={pitchingLabels[index]}>{value}</td>)}
            </tr>)}</tbody>
          </StatTable>
        </details>
      </div>;
    })}
  </section>;
}

export function JapanSeriesPlayerBoxScores({ games, playerId, role, preferredGameId }: {
  games: PlayerGame[]; playerId: string; role: BoxSelection["role"]; preferredGameId?: string | undefined;
}) {
  const labels = role === "batting" ? battingLabels : pitchingLabels;
  return <div className="box-primary japan-series-box-score">
    <StatTable>
      <caption className="sr-only">日本シリーズの試合別{role === "batting" ? "打撃" : "投球"}成績</caption>
      <thead><tr><th>試合</th>{labels.map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{games.map(game => {
        const { box, side } = game;
        const href = npbGamePlayerLinks(playerId, { gameId: box.gameId, date: box.date, side, role, stage: "japan_series" }).game;
        return <tr key={box.gameId}>
          <th><Link className="game-player-link" to={href} aria-current={preferredGameId === box.gameId ? "true" : undefined}>
            第{box.gameNumber}戦 · {Number(box.date.slice(5, 7))}月{Number(box.date.slice(8))}日
          </Link></th>
          {(game.role === "batting" ? battingValues(game.stats) : pitchingValues(game.stats)).map((value, index) =>
            <td key={labels[index]}>{value}</td>)}
        </tr>;
      })}</tbody>
    </StatTable>
  </div>;
}
