import { Link } from "react-router-dom";
import type { NpbJapanSeries } from "../domain/npb-japan-series";
import { japanSeriesRecap } from "../presentation/japan-series-recap";
import { japanSeriesGameUrl } from "../presentation/japan-series-home";
import { npbTeamShortName as name } from "./npb-team-names";

export function JapanSeriesRecap({data}:{data:NpbJapanSeries}) {
  const r=japanSeriesRecap(data);
  if(!r)return null;
  return <section className="series-recap" aria-labelledby="series-recap-title">
    <h2 id="series-recap-title">シリーズ総括</h2>
    <p><strong>{name(r.winnerId)}、{r.wins===r.games?`${r.wins}連勝`:`${r.wins}勝${r.losses}敗${r.ties?`${r.ties}分`:""}`}で日本一</strong></p>
    <dl className="series-recap-facts">{[[`${name(r.winnerId)}の総得点`,r.winnerRuns],[`${name(r.opponentId)}の総得点`,r.opponentRuns],["延長戦",`${r.extraInningGames}試合`],["1点差",`${r.oneRunGames}試合`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {!!r.firstExtraStreak&&<p>初戦から{r.firstExtraStreak}試合連続で延長戦。</p>}
    {r.firstScore&&<p>第{r.closingGame.gameNumber}戦は{name(r.firstScore.teamId)}が{r.firstScore.inning}回{r.firstScore.half}に{r.firstScore.runs}点を先制。{r.turn&&<>{name(r.turn.teamId)}は{r.turn.inning}回{r.turn.half}の{r.turn.runs}得点で逆転{r.following.length?`し、${r.following.slice(0,2).map(f=>`${f.inning}回${f.half}に${f.runs}点`).join("、")}を追加。`:"。"}</>}</p>}
    <Link className="section-action" to={japanSeriesGameUrl(r.closingGame.gameId)}>第{r.closingGame.gameNumber}戦の試合詳細 →</Link>
    <p className="inline-note">全{r.games}試合の結果・イニング別得点から集計。個人成績は未収録です。</p>
  </section>;
}
