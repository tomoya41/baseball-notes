import { Link, useLocation, useNavigate } from "react-router-dom";
import type { CompetitionType } from "../domain/competition";
import { useHistoricalCompetition } from "./historical-competition-context";
import { hasHistoricalPostseason, usePostseasonAvailability } from "./postseason-availability";
function competitionTarget(pathname: string, search: string, scope: CompetitionType) {
  const p = new URLSearchParams(search);
  p.delete("date"); p.delete("asOfDate");
  if (scope === "postseason") p.set("competition", scope); else p.delete("competition");
  return `${pathname}?${p}`;
}
export function CompetitionSelect({ season }: { season: number }) {
  const location = useLocation(), navigate = useNavigate(), competition = useHistoricalCompetition();
  const availability = usePostseasonAvailability();
  const change = (scope: CompetitionType) => { const p=new URLSearchParams(location.search);p.set("season",String(season));navigate(competitionTarget(location.pathname,p.toString(),scope)); };
  return <label><span className="sr-only">集計対象</span><select aria-label="集計対象" value={competition} onChange={e => change(e.target.value === "postseason" ? "postseason" : "regular")}><option value="regular">公式戦</option>{(competition === "postseason" || hasHistoricalPostseason(availability, season)) && <option value="postseason">ポストシーズン</option>}</select></label>;
}
export function CompetitionTabs() {
  const location = useLocation(), competition = useHistoricalCompetition();
  const availability = usePostseasonAvailability(), year = new URLSearchParams(location.search).get("season");
  const target = (scope: CompetitionType) => {
    return competitionTarget(location.pathname, location.search, scope);
  };
  return <nav className="profile-tabs competition-tabs" aria-label="集計対象">
    <Link to={target("regular")} aria-current={competition === "regular" ? "page" : undefined}>Regular Season</Link>
    {hasHistoricalPostseason(availability, year ? Number(year) : undefined) && <Link to={target("postseason")} aria-current={competition === "postseason" ? "page" : undefined}>Postseason</Link>}
  </nav>;
}
