import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
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
import { NpbLifecycleExplorer } from "./npb-lifecycle";
const NpbCsScreen = lazy(()=>import("./npb-cs").then(m=>({default:m.NpbCsScreen})));
const NpbPostseasonScreen = lazy(()=>import("./npb-postseason").then(m=>({default:m.NpbPostseasonScreen})));
const NpbPlayerEventsScreen = lazy(()=>import("./npb-player-events").then(m=>({default:m.NpbPlayerEventsScreen})));
const NpbDraftEventScreen = lazy(()=>import("./npb-draft-event").then(m=>({default:m.NpbDraftEventScreen})));
const NpbPlayerSeasons = lazy(()=>import("./npb-historical").then(m=>({default:m.NpbPlayerSeasons})));
const NpbTeamPlayers = lazy(()=>import("./npb-team-players").then(m=>({default:m.NpbTeamPlayers})));
type FavoriteTarget = Pick<Favorite, "kind" | "entityId" | "league">;
function NpbSearchEntry(props: Parameters<typeof NpbRoutes>[0]) {
  const [params] = useSearchParams();
  return ["team", "game", "series"].includes(params.get("kind") ?? "")
    ? <NpbDiscovery services={props.services} />
    : <NpbPlayerSearch repository={props.services.directory} favorites={props.favorites} toggle={props.toggle} saving={props.saving} />;
}
export function NpbRoutes({ services, favorites, toggle, saving }: { services: Services; favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean }) {
  const location = useLocation();
  const legacyParams=new URLSearchParams(location.search);
  const legacyCsQuery = legacyParams.get("stage")!=="japan_series"&&["role", "q", "page"].some(key => legacyParams.has(key));
  return <Routes>
    <Route path="moves" element={<Suspense fallback={<p role="status">選手の動きを読み込み中…</p>}><NpbPlayerEventsScreen favorites={favorites} /></Suspense>} />
    <Route path="cs" element={<Suspense fallback={<p role="status">CSの収録データを読み込み中…</p>}><NpbCsScreen /></Suspense>} />
    <Route path="postseason" element={<Suspense fallback={<p role="status">シリーズ情報を読み込み中…</p>}>{legacyCsQuery ? <NpbCsScreen /> : <NpbPostseasonScreen />}</Suspense>} />
    <Route path="postseason/series/:seriesId" element={<Suspense fallback={<p role="status">シリーズ情報を読み込み中…</p>}><NpbPostseasonScreen /></Suspense>} />
    <Route path="postseason/*" element={<PostseasonUnavailable league="NPB" />} />
    <Route path="explore" element={<ExploreScreen league="NPB" />} />
    <Route path="milestones/*" element={<NpbMilestonesScreen repository={services.product} />} />
    <Route path="talent/2026" element={<Suspense fallback={<p role="status">読み込み中…</p>}><NpbDraftEventScreen/></Suspense>} />
    <Route path="talent/*" element={new URLSearchParams(location.search).get("tab") === "1" ? <FutureFeatureScreen feature="talent" league="NPB" /> : <NpbLifecycleExplorer services={services} />} />
    {(["preseason", "matchup", "watch"] as const).map(feature => <Route key={feature} path={`${feature}/*`} element={<FutureFeatureScreen feature={feature} league="NPB" />} />)}
    {(["career", "advanced"] as const).map(feature => <Route key={feature} path={`players/:playerId/${feature}`} element={<FutureFeatureScreen feature={feature} league="NPB" />} />)}
    <Route path="home" element={<NpbHome services={services} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="schedule" element={<NpbScheduleScreen repository={services.gameSurface} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="search" element={<NpbSearchEntry services={services} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="data" element={<NpbDataExplorer services={services} />} />
    <Route path="history" element={<NpbSeasonExplorer cohortRepository={services.product} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="team-compare" element={<NpbTeamCompare services={services} favoriteTeams={favorites.filter(f => f.league === "NPB" && f.kind === "team").map(f => f.entityId)} />} />
    <Route path="season-compare" element={<SeasonCompare league="NPB" services={services} />} />
    <Route path="glossary" element={<StatGlossary league="NPB" />} />
    <Route path="analysis" element={<Navigate to="/NPB/search" replace />} />
    <Route path="players/:playerId/seasons" element={<Suspense fallback={<p role="status">年度別成績を読み込み中…</p>}><NpbPlayerSeasons key={location.pathname} repository={services.directory} profileRepository={services.product} /></Suspense>} />
    <Route path="players/:playerId/:section?" element={<NpbPlayer key={location.pathname.split("/")[3]} services={services} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="teams/:teamId" element={<NpbTeam services={services} hub favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="teams/:teamId/players" element={<Suspense fallback={<p role="status">選手一覧を読み込み中…</p>}><NpbTeamPlayers services={services} favorites={favorites} /></Suspense>} />
    <Route path="teams" element={<NpbTeams services={services} />} />
    <Route path="compare" element={<NpbPlayerCompare services={services} />} />
    <Route path="records" element={<NpbRecordsScreen repository={services.gameSurface} />} />
    <Route path="ranking" element={<Navigate to="/NPB/records" replace />} />
    <Route path="my" element={<div className="screen"><header><p className="eyebrow">NPB / My</p><h1>My</h1></header>{favorites.some(f => f.league === "NPB") ? <><NpbPersonalDashboard services={services} favorites={favorites} toggle={toggle} saving={saving} /><NpbSavedPlayers heading={false} repository={services.directory} favorites={favorites} toggle={toggle} saving={saving} /></> : <section className="my-start"><p>選手・球団をフォローすると、ここで成績や変化を追えます。</p><div className="hub-links"><Link to="/NPB/search">選手を探す →</Link><Link to="/NPB/teams">球団を探す →</Link></div></section>}<Link className="section-action" to="/NPB/moves?follow=1">フォローに関連する選手の動き →</Link><MyLibrary league="NPB" /></div>} />
    <Route path="favorites" element={<Navigate to="/NPB/my" replace />} />
    <Route path="players" element={<Navigate to="/NPB/search" replace />} />
    <Route path="*" element={<Navigate to="/NPB/home" replace />} />
  </Routes>;
}
