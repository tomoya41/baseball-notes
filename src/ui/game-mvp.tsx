import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { selectGameMvp, type GameMvpInput } from "../domain/game-mvp";
import "./game-mvp.css";

export function UnavailableGameMvp({ reason = "選手成績未収録のため、選出していません。" }: { reason?: string }) {
  return <section className="game-mvp" aria-label="この試合のMVP"><h2><Trophy size={16} aria-hidden="true" />この試合のMVP <small>アプリ独自選出</small></h2><p className="inline-note">{reason}</p></section>;
}
export function GameMvp({ input, playerScope = "" }: { input: GameMvpInput; playerScope?: string }) {
  const result = selectGameMvp(input);
  if (result.status === "unavailable") return <UnavailableGameMvp reason={result.reason} />;
  const groups = [...new Map(result.players.map(p => [p.playerId, result.players.filter(v => v.playerId === p.playerId)])).values()];
  const row = (group: typeof result.players) => { const p = group[0]!; return <div className="game-mvp__player" key={p.playerId}><Link to={`/${input.league}/players/${encodeURIComponent(p.playerId)}${playerScope}`}>{p.name}</Link>{group.map(v => <span key={v.role}>{v.reason}</span>)}</div>; };
  return <section className="game-mvp" aria-label="この試合のMVP"><h2><Trophy size={16} aria-hidden="true" />この試合のMVP <small>アプリ独自選出</small></h2>
    {groups.slice(0, 2).map(row)}{groups.length > 2 && <details><summary>同点の選手をすべて見る（{groups.length}人）</summary>{groups.slice(2).map(row)}</details>}
    <details><summary>選考の根拠</summary><p>この試合の両チームの収録済み打撃・投手成績から選出。同点は併記します。公式表彰・日別MVP・HOTランキングとは別です。</p><p>打者：安打＋本塁打×3＋打点。投手：投球回＋奪三振÷2−失点×2。守備・走塁・打席の重要度は未評価です。</p><p>根拠の数値と出典は、この試合のボックススコアをご覧ください。公式戦とポストシーズンは合算しません。</p></details>
  </section>;
}
