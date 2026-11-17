import { Link } from "react-router-dom";
import type { Favorite } from "../domain/models";
import { historicalOnlyPlayers, historicalPlayerRoute } from "../data/npb-historical-identity-index";
import { LoadingSkeleton, SectionHeader } from "./components";
import { useNpbPlayerDirectory, type DirectoryReader } from "./use-npb-player-directory";

export function NpbHomeFollowing({ repository, favorites }: {
  repository: DirectoryReader; favorites: readonly Favorite[];
}) {
  const followed = favorites.filter(f => f.league === "NPB");
  const hasFollows = followed.length > 0;
  const { directory, state } = useNpbPlayerDirectory(repository, hasFollows);
  const failed = state === "error";
  const players = followed.filter(f => f.kind === "player").slice(0, 2), teams = followed.filter(f => f.kind === "team").slice(0, 2);
  return <section className="home-following" aria-label="フォローから開く">
    <SectionHeader title={hasFollows ? "フォローから開く" : "好きな選手からはじめる"} action={hasFollows ? "Myへ" : "選手を探す"} to={hasFollows ? "/NPB/my" : "/NPB/search"}/>
    {!hasFollows ? <p className="inline-note">選手や球団の★から、成績と歩みを追えます。</p> : !directory && !failed ? <LoadingSkeleton/> : <>
      {failed && <p role="status" className="inline-note">{directory ? "選手・球団情報の更新を確認できないため、保存済みの情報を表示しています。" : "フォローは保存されています。選手・球団情報を読み込めません。"}</p>}
      <div className="home-following-players">{players.map(f => {
        const player = directory?.players.find(p => p.playerId === f.entityId), historical = historicalOnlyPlayers.get(f.entityId);
        const name = player?.displayName ?? historical?.article ?? "保存した選手", role = player?.playerType === "pitcher" ? "pitching" : "batting";
        const to = historical ? historicalPlayerRoute(f.entityId) : `/NPB/players/${f.entityId}`;
        return <article className="home-following-player" key={f.entityId}>
          <Link to={to}><strong>{name}</strong><small>{historical ? "過去年度の成績" : player?.teamId ? `${directory?.teams.find(t => t.id === player.teamId)?.shortName ?? "球団未確認"} · 保存済み所属` : "所属未確認"}</small></Link>
          <Link className="home-following-action" to={historical ? to : `${to}/seasons?season=2026&role=${role}`}>年度成績<span aria-hidden="true"> ↗</span></Link>
        </article>;
      })}</div>
      {teams.length > 0 && <div className="home-following-teams">{teams.map(f => <Link key={f.entityId} to={`/NPB/teams/${encodeURIComponent(f.entityId)}`}>{directory?.teams.find(t => t.id === f.entityId)?.shortName ?? "保存した球団"}<span aria-hidden="true"> →</span></Link>)}</div>}
    </>}
  </section>;
}
