import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { canonicalEntityRefSchema } from "../domain/cross-league";
import { npbGamePlayerLinks, type NpbGamePlayerContext } from "../domain/npb-game-player-journey";
import "./npb-game-player.css";

export function NpbGamePlayerLink({ playerId, name, context, recorded }: {
  playerId: string;
  name: string;
  context: NpbGamePlayerContext;
  recorded: boolean;
}) {
  const canonical = canonicalEntityRefSchema.safeParse({ league: "NPB", kind: "player", id: playerId }).success;
  return <>
    {canonical ? <Link className="game-player-link" to={npbGamePlayerLinks(playerId, context).profile}>{name}<ChevronRight size={14} aria-hidden="true" /></Link> : <span>{name}</span>}
    {!recorded && <small>出場確認 · 個人成績の数値は未収録</small>}
  </>;
}
