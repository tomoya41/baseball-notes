import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { onPersonalRestored } from "../app/personal-events";
import { RouteErrorBoundary, RouteFocus } from "./route-reliability";
import { House, Search, Trophy, UserRound, CalendarDays } from "lucide-react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { Services } from "../app/services";
import type { Favorite, League } from "../domain/models";
import { favoriteMatches, leagueSwitchPath } from "../domain/cross-league";
import { LoadingSkeleton } from "./components";
import { MySettings, ThemeControl } from "./design-system";
import { NotificationSettings, PrivacyScreen, RuntimeStatus } from "./runtime-status";
import { PersonalLibraryProvider } from "./library-provider";
import { ShareLink } from "./product-sharing";
import { PersonalWatchProvider, WatchSummary } from "./watch-shell";
import { WebAppUpdateNotice, WebOfflineInfo } from "./web-offline";
type FavoriteTarget = Pick<Favorite, "kind" | "entityId" | "league">;
const MlbLeagueView = lazy(() => import("./mlb-foundation").then(module => ({ default: module.MlbLeagueView })));
const NpbRoutes = lazy(() => import("./npb-routes").then(module => ({ default: module.NpbRoutes })));
const NpbGameDetailScreen = lazy(() => import("./npb-game-detail").then(module => ({ default: module.NpbGameDetailScreen })));
const CollectionDashboard = lazy(() => import("./collection-dashboard").then(module => ({ default: module.CollectionDashboard })));
const PersonalLibraryScreen = lazy(() => import("./personal-library").then(module => ({ default: module.PersonalLibraryScreen })));
const WatchCenter = lazy(() => import("./personal-watch").then(module => ({ default: module.WatchCenter })));
const PersonalBackupSettings = lazy(() => import("./personal-backup").then(module => ({ default: module.PersonalBackupSettings })));
const navItems = [
  { label: "ホーム", segment: "home", icon: House }, { label: "試合", segment: "schedule", icon: CalendarDays },
  { label: "選手", segment: "search", icon: Search }, { label: "記録", segment: "records", icon: Trophy }, { label: "My", segment: "my", icon: UserRound },
] as const;
export function App({ services }: { services: Services }) {
  const location = useLocation();
  const league: League = location.pathname.split("/")[1] === "MLB" ? "MLB" : "NPB";
  const section = location.pathname.split("/")[2] ?? "home";
  const experience = ["postseason", "cs", "talent", "draft", "history"].includes(section) ? "editorial" : ["games", "schedule"].includes(section) ? "game" : ["my", "favorites", "library", "watch-center"].includes(section) ? "personal" : ["players", "search", "teams"].includes(section) ? "player" : ["analysis", "compare", "matchup", "team-compare", "season-compare", "data", "records", "ranking", "form", "milestones"].includes(section) ? "data" : "reference";
  const currentNav = ["games", "schedule", "postseason", "cs"].includes(section) ? "schedule" : ["ranking", "milestones"].includes(section) ? "records" : ["players", "teams", "analysis", "compare", "team-compare", "season-compare", "data", "history", "glossary"].includes(section) || league === "NPB" && section === "talent" ? "search" : ["favorites", "library", "watch-center"].includes(section) ? "my" : section;
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  useEffect(() => { const refresh = () => { services.product.invalidateCatalog(); setRefreshVersion(v => v + 1); };
    window.addEventListener("baseball:refresh-data", refresh); return () => window.removeEventListener("baseball:refresh-data", refresh); }, [services]);
  const [saving, setSaving] = useState(false);
  const [favoriteMessage, setFavoriteMessage] = useState("");
  const [favoriteError, setFavoriteError] = useState(false);
  const favoriteRead = useRef(0);
  useEffect(() => {
    if (!favoriteMessage || favoriteError) return;
    const timer = window.setTimeout(() => setFavoriteMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [favoriteMessage, favoriteError]);
  useEffect(() => {
    let active = true; const refresh = () => { const version = ++favoriteRead.current;
      void services.favorites.list().then(items => { if (active && version === favoriteRead.current) { setFavorites(items); setFavoritesReady(true); setFavoriteError(false); } })
        .catch(() => { if (active && version === favoriteRead.current) { setFavoriteMessage("お気に入りを読み込めません。保存データは保持しています。"); setFavoriteError(true); } }); };
    refresh(); const unsubscribe = onPersonalRestored(refresh);
    return () => { active = false; unsubscribe(); };
  }, [services]);
  const toggle = useCallback((target: FavoriteTarget) => {
    const version = ++favoriteRead.current;
    setSaving(true);
    void services.favorites.toggle(target).then((items) => {
      if (version !== favoriteRead.current) return;
      setFavorites(items); setFavoriteError(false);
      setFavoriteMessage(items.some((item) => favoriteMatches(item, target))
        ? "お気に入りを保存しました。" : "お気に入りから削除しました。");
    }).catch(() => { setFavoriteError(true); setFavoriteMessage("お気に入りを保存できません。端末の保存領域を確認してください。"); })
      .finally(() => setSaving(false));
  }, [services]);
  const switchPath = (next: League) => leagueSwitchPath(location.pathname, location.search, next);
  return <PersonalLibraryProvider store={services.personalLibrary}><PersonalWatchProvider store={services.personalWatch}><div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={(event) => {
      event.preventDefault(); document.getElementById("main-content")?.focus();
    }}>本文へ移動</a>
    <header className="app-header"><Link className="brand" to={`/${league}/home`} aria-label="Baseball Notes ホーム">
      <span><strong>BASEBALL</strong><small>NOTES</small></span>
    </Link><div className="app-header-actions"><nav className="league-switch" aria-label="リーグ切替">{(["NPB", "MLB"] as const).map(item => <Link key={item} to={switchPath(item)} aria-current={league === item ? "true" : undefined}>{item}</Link>)}</nav><ThemeControl /><ShareLink compact key={location.pathname + location.search} /></div></header>
    {favoriteMessage && <p className={`toast${favoriteError ? " toast--error" : ""}`}
      role={favoriteError ? "alert" : "status"}>{favoriteMessage}</p>}
    <RuntimeStatus />
    <WebAppUpdateNotice />
    <main id="main-content" data-experience={experience} tabIndex={-1}>
    <RouteFocus />
    <RouteErrorBoundary key={`screen:${location.pathname}`}>
    <Suspense fallback={<LoadingSkeleton />}><Routes key={refreshVersion}>
      <Route path="/NPB/watch-center" element={<WatchCenter key="NPB" league="NPB" services={services} favorites={favorites} ready={favoritesReady} />} />
      <Route path="/MLB/watch-center" element={<WatchCenter key="MLB" league="MLB" services={services} favorites={favorites} ready={favoritesReady} />} />
      <Route path="/NPB/library" element={<PersonalLibraryScreen league="NPB" />} />
      <Route path="/MLB/library" element={<PersonalLibraryScreen league="MLB" />} />
      <Route path="/NPB/library/collections/:collectionId" element={<CollectionDashboard league="NPB" services={services} favorites={favorites} />} />
      <Route path="/MLB/library/collections/:collectionId" element={<CollectionDashboard league="MLB" services={services} favorites={favorites} />} />
      <Route path="/privacy" element={<PrivacyScreen />} />
      <Route path="/NPB/games/:gameId" element={<NpbGameDetailScreen key={location.pathname} repository={services.gameDetail} summaryRepository={services.gameSummary} services={services} favorites={favorites} toggle={toggle} saving={saving} />} />
      <Route path="/NPB/*" element={<NpbRoutes services={services}
        favorites={favorites} toggle={toggle} saving={saving} />} />
      <Route path="/MLB/*" element={<Suspense fallback={<LoadingSkeleton />}><MlbLeagueView key="MLB"
        favorites={favorites} toggle={toggle} saving={saving} /></Suspense>} />
      <Route path="*" element={<Navigate to="/NPB/home" replace />} />
    </Routes></Suspense>
    </RouteErrorBoundary>
    {section === "home" && <WatchSummary league={league} />}
    {section === "my" && <details className="my-settings-disclosure"><summary>設定・バックアップ</summary><Suspense fallback={<LoadingSkeleton />}><PersonalBackupSettings transfer={services.personalBackup} /></Suspense><MySettings /><WebOfflineInfo /><NotificationSettings favorites={favorites} ready={favoritesReady} visible /></details>}
    <footer className="app-footer"><Link to="/MLB/sources">データ提供元</Link><Link to={`/${league}/explore`}>機能一覧 ↗</Link></footer></main>
    <nav className="bottom-nav" aria-label="基本ナビゲーション">{navItems.map(({ label, segment, icon: Icon }) =>
      <Link key={segment} to={`/${league}/${segment}`} aria-current={currentNav === segment ? "page" : undefined}>
        <Icon size={21} strokeWidth={1.9} aria-hidden="true" /><span>{label}</span>
      </Link>)}</nav>
  </div></PersonalWatchProvider></PersonalLibraryProvider>;
}
