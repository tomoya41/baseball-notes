import { Link } from "react-router-dom";
import type { Favorite } from "../domain/models";
import type { HistoricalPlayer } from "../data/mlb-historical";
import { historicalPositions } from "../presentation/historical-player";
import { FavoriteButton, MetricLabel } from "./components";
import { Monogram } from "./design-system";
import { useHistoricalStatic } from "./use-mlb-historical";
type Values = Record<string, { value: number | null }>;

function FollowStatLine({ values, pitching }: { values: Values; pitching: boolean }) {
  return <div className="follow-statline">
    <small>{pitching ? "投球" : "打撃"}</small>
    {(pitching ? ["ERA", "SO"] : ["OPS", "HR"]).map(key => <div key={key}>
      <strong>{values[key]?.value == null ? "—" : values[key]!.value!.toFixed(key === "OPS" ? 3 : key === "ERA" ? 2 : 0)}</strong>
      <span><MetricLabel metric={key} label={key === "HR" ? "本塁打" : key === "SO" ? "奪三振" : key} /></span>
    </div>)}
  </div>;
}

export function MlbFollowPlayer({ player, season, favorites, toggle, saving }: {
  player: Pick<HistoricalPlayer,"id"|"name"|"positions"|"seasons"> & { postseasonOnly?: boolean }; season: number; favorites: Favorite[];
  toggle: (target: Pick<Favorite,"league"|"kind"|"entityId">) => void; saving: boolean;
}) {
  // A maximum of four existing profile payloads, never the multi-megabyte all-player Season payload.
  const profile = useHistoricalStatic<{ seasonTotals: Record<string,{batting:Values|null;pitching:Values|null}> }>(`${player.postseasonOnly ? "postseason/" : ""}players/${player.id.replaceAll(":","_")}.json`);
  const totals = profile.value?.seasonTotals[String(season)];
  const hasBatting = totals?.batting != null && totals.batting.PA?.value !== 0;
  const year = player.seasons.includes(season) ? season : player.seasons.at(-1)!;
  return <article className="follow-player">
    <Link className="follow-player-identity" to={`/MLB/players/${encodeURIComponent(player.id)}?season=${year}${player.postseasonOnly ? "&competition=postseason" : ""}`}>
      <Monogram name={player.name} />
      <span><strong>{player.name}</strong><small>{historicalPositions(player.positions).split("・").slice(0, 2).join("・")}{player.postseasonOnly && " · Postseason"}</small></span>
    </Link>
    <FavoriteButton active={favorites.some(f => f.league === "MLB" && f.entityId === player.id)} saving={saving}
      label={player.name} onClick={() => toggle({ league: "MLB", kind: "player", entityId: player.id })} />
    <div className="follow-player-stats">{profile.status === "ready" ? <>
      {hasBatting && totals?.batting && <FollowStatLine values={totals.batting} pitching={false} />}
      {totals?.pitching && <FollowStatLine values={totals.pitching} pitching />}
      {!hasBatting && !totals?.pitching && <small>{season}年の成績は未収録</small>}
    </> : <><small>{profile.status === "loading" ? "成績を読み込み中" : "成績を読み込めません"}</small>{profile.status === "error" && <button className="text-button" onClick={profile.retry} aria-label={`${player.name}の成績を再読み込み`}>再読み込み</button>}</>}</div>
  </article>;
}
