import { Link, useLocation } from "react-router-dom";
import type { CompetitionType } from "../domain/competition";
import { useHistoricalCompetition } from "./historical-competition-context";
import { hasHistoricalPostseason, usePostseasonAvailability } from "./postseason-availability";
export function CompetitionTabs() {
  const location = useLocation(), competition = useHistoricalCompetition();
  const availability = usePostseasonAvailability(), year = new URLSearchParams(location.search).get("season");
  const target = (scope: CompetitionType) => {
    const p = new URLSearchParams(location.search);
    p.delete("date"); p.delete("asOfDate");
    if (scope === "postseason") p.set("competition", scope); else p.delete("competition");
    return `${location.pathname}?${p}`;
  };
  return <nav className="profile-tabs competition-tabs" aria-label="集計対象">
    <Link to={target("regular")} aria-current={competition === "regular" ? "page" : undefined}>Regular Season</Link>
    {hasHistoricalPostseason(availability, year ? Number(year) : undefined) && <Link to={target("postseason")} aria-current={competition === "postseason" ? "page" : undefined}>Postseason</Link>}
  </nav>;
}
