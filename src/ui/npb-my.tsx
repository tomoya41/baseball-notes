import { Link } from "react-router-dom";
import type { Favorite } from "../domain/models";
import { canonicalEntityRefSchema } from "../domain/cross-league";
import { positionDefinitions } from "../domain/baseball-terms";
import { DataState, FavoriteButton, LoadingSkeleton, PageHeading } from "./components";
import { Monogram } from "./design-system";
import { historicalOnlyPlayers, historicalPlayerRoute } from "../data/npb-historical-identity-index";
import { useNpbPlayerDirectory, type DirectoryReader } from "./use-npb-player-directory";
import "./npb-personal-records.css";

type Target = Pick<Favorite, "entityId" | "kind" | "league">;
export function NpbSavedPlayers({ repository, favorites, toggle, saving, compact = false, heading = true }: {
  repository: DirectoryReader;
  favorites: Favorite[]; toggle: (target: Target) => void; saving: boolean; compact?: boolean; heading?: boolean;
}) {
  const ids = [...new Set(favorites.filter(item => item.league === "NPB" && item.kind === "player").map(item => item.entityId))];
  const visible = compact ? ids.slice(0, 2) : ids;
  const needsDirectory = visible.some(id => !historicalOnlyPlayers.has(id));
  const { directory, state, retry, retrying } = useNpbPlayerDirectory(repository, needsDirectory);
  const error = needsDirectory && state === "error";

  return <>
    {!compact && heading && <PageHeading eyebrow="NPB / My" title="お気に入り選手" detail="この端末に保存しています" />}
    {error && directory && visible.length > 0 && <p className="inline-note" role="status">更新を確認できないため、保存済みの選手情報を表示しています。</p>}
    {error && visible.length > 0 && <button type="button" className="button button--secondary" onClick={retry} disabled={retrying}>
      {retrying ? "選手情報を確認中" : "選手情報を再読み込み"}
    </button>}
    {!ids.length ? <DataState kind="no-data" title="お気に入りはまだありません" action="選手を探す" to="/NPB/search" /> : <div className="row-list saved-player-list">
      {visible.map(id => {
        const player = directory?.players.find(item => item.playerId === id), historical = historicalOnlyPlayers.get(id);
        const role = player?.playerType === "pitcher" ? "pitching" : "batting";
        const base = player ? `/NPB/players/${encodeURIComponent(player.playerId)}` : null;
        const unresolvedLink = !directory && error && canonicalEntityRefSchema.safeParse({ league: "NPB", kind: "player", id }).success;
        return <article className="saved-player-entry" key={id}>
          <div className="surface-favorite">
            {historical ? <Link className="player-row" to={historicalPlayerRoute(id)}><span className="player-row__body"><strong>{historical.article}</strong><small>過去年度の成績 · 所属は年度別に表示</small></span></Link> : player && base ? <Link className="player-row" to={base}>
              <Monogram name={player.displayName} /><span className="player-row__body"><strong>{player.displayName}</strong>
                <small>{directory?.teams.find(team => team.id === player.teamId)?.shortName ?? "所属未確認"}{player.teamId ? " · 保存済み" : ""}{player.position ? ` · ${positionDefinitions[player.position]}` : ""}</small>
              </span>
            </Link> : unresolvedLink ? <Link className="player-row" to={`/NPB/players/${encodeURIComponent(id)}`}>
              <span className="player-row__body"><strong>保存した選手を開く</strong><small>選手情報を読み込めません</small></span>
            </Link> : !directory && !error ? <LoadingSkeleton /> : <span className="saved-player-unavailable">{error ? "選手情報を読み込めません。保存したお気に入りは保持しています。" : "選手情報を確認できません"}</span>}
            <FavoriteButton active saving={saving} label={player?.displayName ?? historical?.article ?? "登録済み選手"} onClick={() => toggle({ kind: "player", league: "NPB", entityId: id })} />
          </div>
          {!compact && !historical && player && base && <nav className="saved-player-actions" aria-label={`${player.displayName}から調べる`}>
            <Link to={`${base}/seasons?season=2026&role=${role}`}>年度成績</Link>
            <Link to={`/NPB/compare?players=${encodeURIComponent(id)}&role=${role}`}>比較</Link>
            <Link to={`/NPB/moves?player=${encodeURIComponent(id)}`}>選手の動き</Link>
          </nav>}
        </article>;
      })}
    </div>}
  </>;
}
