import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { House, Search, Trophy, UserRound, CalendarDays } from "lucide-react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { Services } from "../app/services";
import type { Favorite, League } from "../domain/models";
import { favoriteMatches, leagueSwitchPath } from "../domain/cross-league";
import { BaseballIcon } from "./baseball-icons";
import { LoadingSkeleton } from "./components";
import { MySettings } from "./design-system";
import { NotificationSettings, PrivacyScreen, RuntimeStatus } from "./runtime-status";
import { NpbHome, NpbTeam } from "./npb-product";
import { NpbPlayer } from "./npb-player";
import { NpbPlayerSearch } from "./npb-player-search";
import { NpbScheduleScreen, NpbRecordsScreen } from "./npb-game-surface";
import { NpbGameDetailScreen } from "./npb-game-detail";
import { NpbSavedPlayers } from "./npb-my";
import { ExploreScreen, FutureFeatureScreen } from "./future-surfaces";
import { NpbMilestonesScreen } from "./npb-milestones";
import { PostseasonUnavailable } from "./postseason";
type FavoriteTarget = Pick<Favorite, "kind" | "entityId" | "league">;
const MlbLeagueView = lazy(() => import("./mlb-foundation").then(module => ({ default: module.MlbLeagueView })));
function NpbRoutes({ services, favorites, toggle, saving }: { services: Services; favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean }) {
  const location = useLocation();
  return <Routes>
    <Route path="postseason/*" element={<PostseasonUnavailable league="NPB" />} />
    <Route path="explore" element={<ExploreScreen league="NPB" />} />
    <Route path="milestones/*" element={<NpbMilestonesScreen repository={services.product} />} />
    {(["moves", "talent", "preseason", "matchup", "watch"] as const).map(feature => <Route key={feature} path={`${feature}/*`} element={<FutureFeatureScreen feature={feature} league="NPB" />} />)}
    {(["career", "advanced"] as const).map(feature => <Route key={feature} path={`players/:playerId/${feature}`} element={<FutureFeatureScreen feature={feature} league="NPB" />} />)}
    <Route path="home" element={<NpbHome services={services} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="schedule" element={<NpbScheduleScreen repository={services.gameSurface} />} />
    <Route path="search" element={<NpbPlayerSearch repository={services.directory} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="analysis" element={<Navigate to="/NPB/search" replace />} />
    <Route path="players/:playerId/:section?" element={<NpbPlayer key={location.pathname.split("/")[3]} services={services} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="teams/:teamId" element={<NpbTeam services={services} />} />
    <Route path="records" element={<NpbRecordsScreen repository={services.gameSurface} />} />
    <Route path="ranking" element={<Navigate to="/NPB/records" replace />} />
    <Route path="my" element={<div className="screen"><NpbSavedPlayers repository={services.directory} favorites={favorites} toggle={toggle} saving={saving} /></div>} />
    <Route path="favorites" element={<Navigate to="/NPB/my" replace />} />
    <Route path="players" element={<Navigate to="/NPB/search" replace />} />
    <Route path="*" element={<Navigate to="/NPB/home" replace />} />
  </Routes>;
}
const navItems = [
  { label: "ホーム", segment: "home", icon: House }, { label: "試合", segment: "schedule", icon: CalendarDays },
  { label: "選手", segment: "search", icon: Search }, { label: "記録", segment: "records", icon: Trophy }, { label: "My", segment: "my", icon: UserRound },
] as const;
export function App({ services }: { services: Services }) {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  const league: League = location.pathname.split("/")[1] === "MLB" ? "MLB" : "NPB";
  const section = location.pathname.split("/")[2] ?? "home";
  const currentNav = ["games", "schedule", "postseason"].includes(section) ? "schedule" : ["ranking", "milestones"].includes(section) ? "records" : ["players", "teams", "analysis"].includes(section) ? "search" : section === "favorites" ? "my" : section;
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  useEffect(() => { const refresh = () => { services.product.invalidateCatalog(); setRefreshVersion(v => v + 1); };
    window.addEventListener("baseball:refresh-data", refresh); return () => window.removeEventListener("baseball:refresh-data", refresh); }, [services]);
  const [saving, setSaving] = useState(false);
  const [favoriteMessage, setFavoriteMessage] = useState("");
  const [favoriteError, setFavoriteError] = useState(false);
  useEffect(() => {
    if (!favoriteMessage || favoriteError) return;
    const timer = window.setTimeout(() => setFavoriteMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [favoriteMessage, favoriteError]);
  useEffect(() => {
    let active = true;
    void services.favorites.list().then((items) => { if (active) { setFavorites(items); setFavoritesReady(true); } })
      .catch(() => { if (active) { setFavoriteMessage("お気に入りを読み込めません。保存データは保持しています。"); setFavoriteError(true); } });
    return () => { active = false; };
  }, [services]);
  const toggle = useCallback((target: FavoriteTarget) => {
    setSaving(true);
    void services.favorites.toggle(target).then((items) => {
      setFavorites(items); setFavoriteError(false);
      setFavoriteMessage(items.some((item) => favoriteMatches(item, target))
        ? "お気に入りを保存しました。" : "お気に入りから削除しました。");
    }).catch(() => { setFavoriteError(true); setFavoriteMessage("お気に入りを保存できません。端末の保存領域を確認してください。"); })
      .finally(() => setSaving(false));
  }, [services]);
  const switchPath = (next: League) => leagueSwitchPath(location.pathname, location.search, next);
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={(event) => {
      event.preventDefault(); document.getElementById("main-content")?.focus();
    }}>本文へ移動</a>
    <header className="app-header"><Link className="brand" to={`/${league}/home`} aria-label="Baseball Notes ホーム">
      <span className="brand-mark"><BaseballIcon /></span><span><strong>BASEBALL</strong><small>NOTES</small></span>
    </Link><nav className="league-switch" aria-label="リーグ切替">{(["NPB", "MLB"] as const).map(item => <Link key={item} to={switchPath(item)} aria-current={league === item ? "true" : undefined}>{item}</Link>)}</nav></header>
    {favoriteMessage && <p className={`toast${favoriteError ? " toast--error" : ""}`}
      role={favoriteError ? "alert" : "status"}>{favoriteMessage}</p>}
    <RuntimeStatus />
    <main id="main-content" tabIndex={-1}>

    <Routes key={refreshVersion}>
      <Route path="/privacy" element={<PrivacyScreen />} />
      <Route path="/NPB/games/:gameId" element={<NpbGameDetailScreen key={location.pathname} repository={services.gameDetail} />} />
      <Route path="/NPB/*" element={<NpbRoutes services={services}
        favorites={favorites} toggle={toggle} saving={saving} />} />
      <Route path="/MLB/*" element={<Suspense fallback={<LoadingSkeleton />}><MlbLeagueView key="MLB"
        favorites={favorites} toggle={toggle} saving={saving} /></Suspense>} />
      <Route path="*" element={<Navigate to="/NPB/home" replace />} />
    </Routes>
    {section === "my" && <><MySettings /><NotificationSettings favorites={favorites} ready={favoritesReady} visible /></>}
    <footer className="app-footer"><span>BASEBALL NOTES</span><Link to={`/${league}/explore`}>野球をもっと知る ↗</Link></footer></main>
    <nav className="bottom-nav" aria-label="基本ナビゲーション">{navItems.map(({ label, segment, icon: Icon }) =>
      <Link key={segment} to={`/${league}/${segment}`} aria-current={currentNav === segment ? "page" : undefined}>
        <Icon size={21} strokeWidth={1.9} aria-hidden="true" /><span>{label}</span>
      </Link>)}</nav>
  </div>;
}
