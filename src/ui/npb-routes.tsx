import { Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import type { Services } from "../app/services";
import type { Favorite } from "../domain/models";
import { NpbHome, NpbTeam } from "./npb-product";
import { NpbPlayer } from "./npb-player";
import { NpbPlayerSearch } from "./npb-player-search";
import { NpbScheduleScreen, NpbRecordsScreen } from "./npb-game-surface";
import { NpbSavedPlayers } from "./npb-my";
import { ExploreScreen, FutureFeatureScreen } from "./future-surfaces";
import { NpbMilestonesScreen } from "./npb-milestones";
import { PostseasonUnavailable } from "./postseason";
import { NpbPlayerCompare } from "./player-compare";
import { NpbTeams } from "./team-hub";
import { NpbPersonalDashboard } from "./daily-dashboard";
import { NpbDataExplorer } from "./data-explorer";
import { NpbSeasonExplorer } from "./season-explorer";
import { NpbDiscovery } from "./discovery";
import { StatGlossary } from "./stat-glossary";
import { MyLibrary } from "./personal-library";
import { NpbTeamCompare, SeasonCompare } from "./team-season-compare";
type FavoriteTarget = Pick<Favorite, "kind" | "entityId" | "league">;
function NpbSearchEntry(props: Parameters<typeof NpbRoutes>[0]) {
  const [params] = useSearchParams();
  return ["team", "game", "series"].includes(params.get("kind") ?? "")
    ? <NpbDiscovery services={props.services} />
    : <NpbPlayerSearch repository={props.services.directory} favorites={props.favorites} toggle={props.toggle} saving={props.saving} />;
}
export function NpbRoutes({ services, favorites, toggle, saving }: { services: Services; favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean }) {
  const location = useLocation();
  return <Routes>
    <Route path="postseason/*" element={<PostseasonUnavailable league="NPB" />} />
    <Route path="explore" element={<ExploreScreen league="NPB" />} />
    <Route path="milestones/*" element={<NpbMilestonesScreen repository={services.product} />} />
    {(["moves", "talent", "preseason", "matchup", "watch"] as const).map(feature => <Route key={feature} path={`${feature}/*`} element={<FutureFeatureScreen feature={feature} league="NPB" />} />)}
    {(["career", "advanced"] as const).map(feature => <Route key={feature} path={`players/:playerId/${feature}`} element={<FutureFeatureScreen feature={feature} league="NPB" />} />)}
    <Route path="home" element={<NpbHome services={services} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="schedule" element={<NpbScheduleScreen repository={services.gameSurface} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="search" element={<NpbSearchEntry services={services} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="data" element={<NpbDataExplorer services={services} />} />
    <Route path="history" element={<NpbSeasonExplorer />} />
    <Route path="team-compare" element={<NpbTeamCompare services={services} favoriteTeams={favorites.filter(f => f.league === "NPB" && f.kind === "team").map(f => f.entityId)} />} />
    <Route path="season-compare" element={<SeasonCompare league="NPB" services={services} />} />
    <Route path="glossary" element={<StatGlossary league="NPB" />} />
    <Route path="analysis" element={<Navigate to="/NPB/search" replace />} />
    <Route path="players/:playerId/:section?" element={<NpbPlayer key={location.pathname.split("/")[3]} services={services} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="teams/:teamId" element={<NpbTeam services={services} hub favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="teams" element={<NpbTeams services={services} />} />
    <Route path="compare" element={<NpbPlayerCompare services={services} />} />
    <Route path="records" element={<NpbRecordsScreen repository={services.gameSurface} />} />
    <Route path="ranking" element={<Navigate to="/NPB/records" replace />} />
    <Route path="my" element={<div className="screen"><header><p className="eyebrow">NPB / My</p><h1>My</h1></header><MyLibrary league="NPB" /><NpbPersonalDashboard services={services} favorites={favorites} toggle={toggle} saving={saving} /><NpbSavedPlayers heading={false} repository={services.directory} favorites={favorites} toggle={toggle} saving={saving} /></div>} />
    <Route path="favorites" element={<Navigate to="/NPB/my" replace />} />
    <Route path="players" element={<Navigate to="/NPB/search" replace />} />
    <Route path="*" element={<Navigate to="/NPB/home" replace />} />
  </Routes>;
}
