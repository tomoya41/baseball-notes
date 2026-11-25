import { Link } from "react-router-dom";
import { japanPlayerTournamentRecords } from "../data/international-japan-results";
import { internationalOfficialTournaments, type InternationalDetail } from "../data/international-official-links";
import { tournamentAwardName, tournamentAwardPositions } from "../presentation/international-awards";

function tournamentPath(tournament: string, detail?: InternationalDetail) {
  const params = new URLSearchParams({ season: "2026", view: "international", tournament });
  if (detail) params.set(detail === "batting" || detail === "pitching" ? "statRole" : "section", detail);
  return `/NPB/schedule?${params}`;
}

export function NpbPlayerInternational({ playerId }: { playerId: string }) {
  const editions = japanPlayerTournamentRecords(playerId).flatMap(record => {
    const tournament = internationalOfficialTournaments.find(item => item.id === record.tournamentId);
    return tournament ? [{ ...record, tournament }] : [];
  }).sort((a, b) => b.tournament.year - a.tournament.year);
  if (!editions.length) return null;

  return <details className="advanced-disclosure player-international">
    <summary>侍ジャパン · {editions.length}大会</summary>
    <ul className="row-list">
      {editions.map(({ tournament, selected, confirmedGames, stats, mvp, awards }) => {
        const path = (detail?: InternationalDetail) => tournamentPath(tournament.id, detail);
        const name = tournament.kind === "apbc" ? `APBC ${tournament.year}` : tournament.name;
        return <li className="player-international-edition" key={tournament.id}>
          <h3>{name}</h3>
          <div className="player-international-actions">
            {(mvp || awards.length > 0) && <Link to={path(awards.length ? "awards" : undefined)}>
              {mvp && "大会MVP"}{mvp && awards.length > 0 && " · "}{awards.length > 0 &&
                `${tournamentAwardName(tournament.kind)}（${awards.map(row => tournamentAwardPositions[row.position]).join("・")}）`}
            </Link>}
            {confirmedGames > 0 && <Link to={path("appearances")}>{confirmedGames}試合で出場を確認</Link>}
            {stats.map(row => <Link key={row.role} to={path(row.role)}>
              {row.role === "batting" ? `打撃 · ${row.gamesPlayed}試合` : `投球 · ${row.gamesPlayed}登板`}
            </Link>)}
            {selected && <Link to={path("selections")}>代表に選出</Link>}
          </div>
        </li>;
      })}
    </ul>
  </details>;
}
