import {PlayerHonors} from "./player-honors";
import { RosterContextLink as Link } from "./roster-navigation";
import { useEffect, useState } from "react";
import { LicensedPlayerPhoto } from "./licensed-player-photo";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { playerListReturnPath } from "../presentation/team-player-list";
import type { Services } from "../app/services";
import type { Favorite } from "../domain/models";
import type { PlayerRecentResponse, RecentPeriod } from "../domain/player-recent";
import type { PlayerGameLogResponse } from "../domain/player-game-log";
import type { PlayerAnalysisBundle } from "../domain/player-analysis-bundle";
import type { NpbCatalog } from "../domain/npb-product-contract";
import { NpbPlayerInternational } from "./npb-player-international";
import { FavoriteButton, DataState, LoadingSkeleton } from "./components";
import { CollectionButton } from "./personal-library";
import { PlayerTabs } from "./design-system";
import { NpbProfileDetails } from "./npb-product";
import { PlayerLifecycle } from "./npb-lifecycle";
import { NpbPlayerEventHistory } from "./npb-player-event-history";
import { PlayerFutureLinks } from "./future-surfaces";
import { NpbPlayerProfileFacts } from "./npb-player-profile";
import { PlayerRecentView } from "./player-recent";
import { PlayerSeasonView } from "./player-season";
import { PublishedPlayerFallback, PublishedPlayerStatsView } from "./npb-published-player";
import { HeadlineStats, PlayerContextBar, PlayerIdentity, PlayerQuickActions } from "./signature";
import { formatRecentMetric } from "../presentation/recent-formatter";
import { positionDefinitions } from "../domain/baseball-terms";
import { npbGamePlayerContext, npbGamePlayerLinks } from "../domain/npb-game-player-journey";
import { PlayerGameLogView } from "./player-game-log";
import { NpbPlayerTrends } from "./player-trends";
import { NpbPlayerAnalysisScreen, NpbPlayerHomeAwaySection, NpbPlayerOpponentSection, NpbPlayerBattingOrderSection, NpbPlayerPitcherRoleSection, NpbPlayerBatterRoleSection } from "./npb-player-analysis";
import { useNpbPlayerDirectory } from "./use-npb-player-directory";
import { useNpbPlayerSeasonPublication } from "./use-npb-player-season-publication";
import "./npb-player-experience.css";
import "./npb-game-player.css";
export function NpbPlayer({ services, favorites, toggle, saving }: { services: Services; favorites: Favorite[]; toggle: (target: Pick<Favorite, "kind" | "entityId" | "league">) => void; saving: boolean }) {
  const { playerId, section } = useParams();
  const location = useLocation(), rosterBack = playerListReturnPath(location.state);
  const gameContext = npbGamePlayerContext(new URLSearchParams(location.search));
  const postseasonVisit = gameContext !== null && gameContext.stage !== "regular";
  const canonical = !!playerId && /^[0-9a-f-]{36}$/i.test(playerId);
  const { directory, state: directoryState, checkedRevision } = useNpbPlayerDirectory(services.directory, canonical);
  const directoryPlayer = directory?.players.find(item => item.playerId === playerId);
  const directoryTeam = directory?.teams.find(item => item.id === directoryPlayer?.teamId);
  const profileKey = directory ? `${directory.effectiveDate}:${directory.generatedAt}` : "";
  const directoryLoading = directoryState === "loading";
  const [profile, setProfile] = useState<{ key: string; player: NpbCatalog["players"][number] | null; unavailable: boolean } | null>(null);
  const profilePlayer = profile?.key === profileKey ? profile.player : null;
  const product = profilePlayer && (!directory || (profilePlayer.displayName === directoryPlayer?.displayName &&
    profilePlayer.membership.teamId === directoryPlayer.teamId)) ? profilePlayer : null;
  useEffect(() => {
    if (!canonical || !playerId || directoryLoading) return;
    let active = true;
    void services.product.player(playerId, directory ?? undefined).then(player => {
      if (active) setProfile({ key: profileKey, player, unavailable: false });
    }).catch(() => {
      if (active) setProfile(previous => ({ key: profileKey, player: previous?.key === profileKey ? previous.player : null, unavailable: true }));
    });
    return () => { active = false; };
  }, [canonical, checkedRevision, directory, directoryLoading, playerId, profileKey, services.product]);
  const [period, setPeriod] = useState<RecentPeriod>("7d");
  const [recent, setRecent] = useState<PlayerRecentResponse | null>(null);
  const [identity, setIdentity] = useState<PlayerRecentResponse["player"] | null>(null);
  const [recentState, setRecentState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [season, setSeason] = useState<PlayerRecentResponse | null>(null);
  const [seasonState, setSeasonState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [gameLog, setGameLog] = useState<PlayerGameLogResponse | null>(null);
  const [gameLogState, setGameLogState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [analysisBundle, setAnalysisBundle] = useState<PlayerAnalysisBundle | null>(null);
  const [analysisState, setAnalysisState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [recentCache] = useState(() => new Map<string, PlayerRecentResponse | null>());
  const wantsSeason = canonical && !postseasonVisit && (!section || section === "stats");
  const apiSeasonAsOf = seasonState === "ready" && (season?.batting || season?.pitching) ? season.asOfDate : null;
  const checkPublication = wantsSeason && !!directory && seasonState !== "loading" &&
    (!apiSeasonAsOf || directory.effectiveDate > apiSeasonAsOf);
  const publication = useNpbPlayerSeasonPublication(playerId, directory, checkedRevision, checkPublication);
  const publishedSeason = checkPublication && publication.data &&
    (publication.data.player.batting || publication.data.player.pitching) &&
    (!apiSeasonAsOf || publication.data.effectiveDate > apiSeasonAsOf) ? publication.data : null;
  useEffect(() => {
    if (!wantsSeason || !playerId) return;
    let active=true;
    queueMicrotask(()=>{if(active){setSeason(null);setSeasonState("loading");}});
    void services.recent.find(playerId,"season").then(value=>{
      if(!active) return;
      recentCache.set(`${playerId}:season`,value);setSeason(value);setSeasonState(value?"ready":"missing");
    }).catch(()=>{if(active)setSeasonState("error");});
    return ()=>{active=false;};
  },[playerId,recentCache,services,wantsSeason]);
  useEffect(() => {
    if (postseasonVisit || !canonical || !playerId || section !== "analysis") return;
    let active = true;
    queueMicrotask(() => { if (active) { setAnalysisBundle(null); setAnalysisState("loading"); } });
    void services.analysisBundle.find(playerId).then((value) => {
      if (active) { setAnalysisBundle(value); setAnalysisState(value ? "ready" : "missing"); }
    }).catch(() => { if (active) setAnalysisState("error"); });
    return () => { active = false; };
  }, [canonical, playerId, postseasonVisit, section, services]);
  useEffect(() => {
    if (postseasonVisit || !canonical || !playerId) return;
    let active = true;
    const cacheKey = `${playerId}:${period}`;
    if (recentCache.has(cacheKey)) {
      const value = recentCache.get(cacheKey) ?? null;
      queueMicrotask(() => { if (active) { setRecent(value); setRecentState(value ? "ready" : "missing");
        if (value) setIdentity(value.player); } });
      return () => { active = false; };
    }
    void services.recent.find(playerId, period).then((value) => {
      if (!active) return;
      recentCache.set(cacheKey, value);
      setRecent(value); setRecentState(value ? "ready" : "missing");
      if (value) setIdentity(value.player);
    }).catch(() => { if (active) setRecentState("error"); });
    return () => { active = false; };
  }, [canonical, playerId, period, postseasonVisit, recentCache, services]);
  useEffect(() => {
    if (postseasonVisit || !canonical || !playerId) return;
    let active = true;
    void services.gameLog.find(playerId).then((value) => {
      if (active) { setGameLog(value); setGameLogState(value ? "ready" : "missing"); }
    }).catch(() => { if (active) setGameLogState("error"); });
    return () => { active = false; };
  }, [canonical, playerId, postseasonVisit, services]);

  if (!canonical) return <DataState kind="no-data" title="選手が見つかりません" action="選手を探す" to="/NPB/search" />;
  if (!directoryPlayer && !identity && directoryState === "loading") return <LoadingSkeleton />;
  const player = { id: playerId!, name: directoryPlayer?.displayName ?? identity?.name ?? product?.displayName };
  if (!player.name) return <DataState kind={directoryState === "error" ? "source-unavailable" : "no-data"} title={directoryState === "error" ? "選手情報を読み込めません" : "選手が見つかりません"} action="選手を探す" to="/NPB/search" />;
  if (section && !["stats", "analysis", "more", "game-log", "trends"].includes(section)) return <Navigate to={`/NPB/players/${player.id}`} replace />;
  const base = `/NPB/players/${player.id}`;
  const gameLinks = gameContext && npbGamePlayerLinks(player.id, gameContext);
  const seasonRole = gameContext?.role ?? (directoryPlayer?.position === "P" || directoryPlayer?.playerType === "pitcher" ||
    directoryPlayer?.pitchingAvailable && !directoryPlayer.battingAvailable ? "pitching" : "batting");
  const seasonsTo = gameLinks?.annual ?? `${base}/seasons?season=2026&role=${seasonRole}`;
  const compareTo = gameLinks ? gameLinks.compare : `/NPB/compare?players=${encodeURIComponent(player.id)}&role=${seasonRole}`;
  const trendsTo = `${base}/trends${gameLinks?.search ?? ""}`;
  const directoryTeams = directory?.teams ?? [];
  const gameLogTeams = new Map(directoryTeams.map(t => [t.id, t.shortName]));
  const pitcherBatting = directoryPlayer?.position === "P";
  const hasSeason = !!apiSeasonAsOf || !!publishedSeason;
  const waitingForSeason = !hasSeason && (publication.pending || (seasonState === "error" && directoryState === "loading"));
  const confirmedEmpty = checkPublication && !hasSeason && !publication.pending && !publication.failed;
  let seasonContent = <PlayerSeasonView payload={season}
    state={waitingForSeason ? "loading" : confirmedEmpty ? "missing" : seasonState} pitcherBatting={pitcherBatting} />;
  if (publishedSeason) {
    seasonContent = <PublishedPlayerStatsView data={publishedSeason} period="season" pitcherBatting={pitcherBatting}
      reason={apiSeasonAsOf && !publication.failed ? "newer_publication" : "api_unavailable"} />;
  } else if (seasonState === "error" && !directory && directoryState !== "loading") {
    seasonContent = <PublishedPlayerFallback key={`${player.id}:season`} playerId={player.id} period="season"
      repository={services.directory} pitcherBatting={pitcherBatting} />;
  }
  const seasonView = <>
    {checkPublication && publication.failed && <>
      {hasSeason && <p className="inline-note" role="status">成績の更新を確認できないため、確認済みの成績を表示しています。</p>}
      <button type="button" className="button button--secondary" onClick={publication.retry}>公開成績を再確認</button>
    </>}
    {seasonContent}
  </>;
  const headlineStats = (["batting", "pitching"] as const).map(role => {
    if (publishedSeason) {
      const stats = publishedSeason.player[role];
      return stats && { metrics: stats.metrics, to: publishedSeason.period.to, partial: publishedSeason.coverage.status !== "complete" };
    }
    const stats = seasonState === "ready" ? season?.[role] : null;
    return stats && { metrics: stats.metrics, to: stats.to, partial: stats.coverage.status !== "complete" };
  });
  const isFavorite = favorites.some(f => f.league === "NPB" && f.kind === "player" && f.entityId === player.id);
  const affiliation = directory && directoryTeam ? `所属は${directory.effectiveDate}時点` : null;
  const background = <section className="player-background" aria-label="経歴と保存した選手への移動">
    <div className="player-snapshot-heading"><h2>選手の歩み</h2><Link to="/NPB/my">Myへ →</Link></div>
    <nav className="player-background-links" aria-label="経歴と出場記録">
      {section !== "more" && <Link to={`${base}/more${gameLinks?.search ?? ""}`}>プロフィール・球歴<span>学校・ドラフト・所属の記録</span></Link>}
      <Link to={`/NPB/moves?player=${player.id}`}>選手の動き<span>契約・移籍などの記録</span></Link>
    </nav>
    <NpbPlayerInternational playerId={player.id}/>
    <PlayerHonors league="NPB" playerId={player.id}/>
  </section>;
  return <div className="screen player-screen npb-player-experience"><PlayerContextBar backTo={gameLinks?.game ?? rosterBack ?? "/NPB/search"} tools={<>{compareTo && <Link to={compareTo}>比較に追加</Link>}{!postseasonVisit && <Link to={trendsTo} aria-current={section === "trends" ? "page" : undefined}>推移・連続記録</Link>}<Link to={seasonsTo}>年度別・シリーズ別成績</Link>{!postseasonVisit && <Link to={`/NPB/season-compare?kind=player&entity=${encodeURIComponent(player.id)}&role=${seasonRole}`}>保存年度を比較</Link>}{directoryTeam && <Link to={`/NPB/teams/${encodeURIComponent(directoryTeam.id)}`}>球団を見る</Link>}<CollectionButton league="NPB" playerId={player.id} name={player.name} /></>}><Link className="player-fixed-scope" to={seasonsTo}>{gameLinks?.scope ?? "2026年 · 公式戦"} ▾</Link></PlayerContextBar>
    <PlayerIdentity uniformNumber={directoryTeam ? product?.membership.uniformNumber ?? null : null} name={player.name} context={`NPB · ${directoryTeam?.shortName ?? (directory ? "所属未確認" : identity?.teamName ?? "所属未確認")}`} detail={[directoryPlayer?.position ? positionDefinitions[directoryPlayer.position] : null, affiliation].filter(Boolean).join(" · ")} visual={product?.visual.photo.usage === "allowed" ? <img className="profile-photo" src={product.visual.photo.url!} alt={player.name} /> : <LicensedPlayerPhoto playerId={player.id} season={2026} />} favorite={<FavoriteButton active={isFavorite} saving={saving} label={player.name} onClick={() => toggle({ league: "NPB", kind: "player", entityId: player.id })} />} />
    {directoryState === "error" && directory && <p className="inline-note" role="status">更新を確認できないため、保存済みの選手情報を表示しています。</p>}
    {gameLinks && <section className="game-player-context" aria-label="試合から選手を確認">
      <p>{gameLinks.scope}</p><nav aria-label="試合からの分析">
        <Link to={seasonsTo}>年度・区分の成績</Link>
        {compareTo && <Link to={compareTo}>同年度で比較</Link>}
        {postseasonVisit && <Link to={base}>公式戦の選手ページ</Link>}
        <Link to={gameLinks.game}>試合詳細へ戻る</Link>
      </nav>
    </section>}
    {!postseasonVisit && <PlayerTabs base={base} section={section} search={gameLinks?.search ?? ""} />}
    {!section && !postseasonVisit && <section className="player-snapshot" aria-label="主な成績と分析への入口">
      <div className="player-snapshot-heading"><h2>保存済みの主な成績</h2><span>2026年 · 公式戦</span></div>
      {headlineStats.map((stats, i) => {
        if (!stats || (i === 0 && pitcherBatting)) return null;
        const batting = i === 0;
        const title = [batting ? "打撃" : "投球", `${stats.to}まで`];
        if (batting && stats.metrics.PA?.status === "complete" && stats.metrics.PA.value != null)
          title.push(`${formatRecentMetric("PA", stats.metrics.PA)}打席`);
        const metrics = batting ? [["OPS", "OPS"], ["HR", "本塁打"], ["AVG", "打率"]] as const
          : [["ERA", "防御率"], ["outsRecorded", "投球回"], ["SO", "奪三振"]] as const;
        return <HeadlineStats key={i} title={title.join(" · ")} partial={stats.partial}
          stats={metrics.map(([metric, label]) => ({ metric, label, value: formatRecentMetric(metric, stats.metrics[metric]) }))} />;
      })}
      {publishedSeason && <p className="inline-note">公開基準日 <time dateTime={publishedSeason.effectiveDate}>{publishedSeason.effectiveDate}</time></p>}
      {!gameLinks && compareTo && <PlayerQuickActions compareTo={compareTo} trendsTo={trendsTo} historyTo={seasonsTo} />}
    </section>}
    {!section && background}
    {section === "trends" && !postseasonVisit && <NpbPlayerTrends services={services} playerId={player.id} />}
    {!section && !postseasonVisit && <div className="profile-content">{!hasSeason && seasonView}<PlayerRecentView period={period} onPeriodChange={next => { if (next === period) return; setRecentState("loading"); setPeriod(next); }} payload={recent} state={recentState} fallback={<PublishedPlayerFallback key={`${player.id}:${period}`} playerId={player.id} period={period} repository={services.directory} pitcherBatting={pitcherBatting} />} noFactKnown={directoryPlayer?.recentAvailable === false} pitcherBatting={pitcherBatting} />{hasSeason && <details className="profile-season-details"><summary>シーズン成績・収録状態</summary>{seasonView}</details>}
      <PlayerGameLogView payload={gameLog ? { ...gameLog, batting: gameLog.batting.slice(0, 3), pitching: gameLog.pitching.slice(0, 3) } : null} state={gameLogState} teams={gameLogTeams} /><Link className="button button--secondary" to={`${base}/game-log`}>すべての試合別成績を見る</Link></div>}
    {section === "stats" && !postseasonVisit && seasonView}
    {section === "game-log" && !postseasonVisit && <PlayerGameLogView payload={gameLog} state={gameLogState} teams={gameLogTeams} />}
    {section === "more" && <>{profile?.key === profileKey && profile.unavailable && <p className="inline-note" role="status">詳しいプロフィールの更新を確認できません。</p>}{product ? <><NpbProfileDetails player={product} /><PlayerLifecycle player={product} /></> : directoryPlayer ? <section className="surface-card"><h2>プロフィール</h2><NpbPlayerProfileFacts player={directoryPlayer} /></section> : <DataState kind="no-data" title="プロフィールを確認できません" />}<NpbPlayerEventHistory playerId={player.id} /><PlayerFutureLinks base={base} /></>}
    {section === "analysis" && !postseasonVisit && <div className="profile-content profile-content--analysis">{canonical
      ? <><NpbPlayerAnalysisScreen payload={analysisBundle?.comparison.status === "ready" ? analysisBundle.comparison.payload : null}
          state={analysisState === "ready" ? analysisBundle?.comparison.status === "ready" ? "ready" : "error" : analysisState} />
          {directoryPlayer?.recentAvailable !== false && <div className="analysis-conditions"><h2>条件別</h2>
          <details className="analysis-condition" open><summary>ホーム / ビジター</summary>
          <NpbPlayerHomeAwaySection payload={analysisBundle?.homeAway.status === "ready" ? analysisBundle.homeAway.payload : null}
            state={analysisState === "ready" ? analysisBundle?.homeAway.status === "ready" ? "ready" : "error" : analysisState} /></details>
          <details className="analysis-condition"><summary>対戦相手</summary>
          <NpbPlayerOpponentSection key={player.id} payload={analysisBundle?.opponent.status === "ready" ? analysisBundle.opponent.payload : null}
            state={analysisState === "ready" ? analysisBundle?.opponent.status === "ready" ? "ready" : "error" : analysisState} teamNames={gameLogTeams}
            teamOrder={directoryTeams.length ? directoryTeams.map((item) => item.id) : []} /></details>
          {directoryPlayer?.battingAvailable !== false && <details className="analysis-condition"><summary>打順</summary>
          <NpbPlayerBattingOrderSection key={player.id} payload={analysisBundle?.battingOrder.status === "ready" ? analysisBundle.battingOrder.payload : null}
            state={analysisState === "ready" ? analysisBundle?.battingOrder.status === "ready" ? "ready" : "error" : analysisState}
            battingAvailable={directoryPlayer?.battingAvailable} /></details>}
          <details className="analysis-condition"><summary>出場形態</summary>
          <NpbPlayerBatterRoleSection payload={analysisBundle?.batterRole.status === "ready" ? analysisBundle.batterRole.payload : null}
            state={analysisState === "ready" ? analysisBundle?.batterRole.status === "ready" ? "ready" : "error" : analysisState}
            battingAvailable={directoryPlayer?.battingAvailable} />
          <NpbPlayerPitcherRoleSection payload={analysisBundle?.pitcherRole.status === "ready" ? analysisBundle.pitcherRole.payload : null}
            state={analysisState === "ready" ? analysisBundle?.pitcherRole.status === "ready" ? "ready" : "error" : analysisState}
            pitchingAvailable={directoryPlayer?.pitchingAvailable} /></details></div>}</>
      : null}</div>}
    {section && background}
  </div>;
}

