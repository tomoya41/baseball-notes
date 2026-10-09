import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import type { Services } from "../app/services";
import type { Favorite } from "../domain/models";
import type { PlayerRecentResponse, RecentPeriod } from "../domain/player-recent";
import type { PlayerGameLogResponse } from "../domain/player-game-log";
import type { PlayerAnalysisBundle } from "../domain/player-analysis-bundle";
import type { NpbDirectoryPlayer, NpbPlayerDirectory } from "../domain/npb-player-directory";
import type { NpbCatalog } from "../domain/npb-product-contract";
import { FavoriteButton, DataState, LoadingSkeleton } from "./components";
import { CollectionButton } from "./personal-library";
import { Monogram, PlayerTabs } from "./design-system";
import { NpbProfileDetails } from "./npb-product";
import { PlayerFutureLinks } from "./future-surfaces";
import { NpbPlayerProfileFacts } from "./npb-player-profile";
import { PlayerRecentView } from "./player-recent";
import { PlayerSeasonView } from "./player-season";
import { PlayerGameLogView } from "./player-game-log";
import { NpbPlayerTrends } from "./player-trends";
import { NpbPlayerAnalysisScreen, NpbPlayerHomeAwaySection, NpbPlayerOpponentSection, NpbPlayerBattingOrderSection, NpbPlayerPitcherRoleSection, NpbPlayerBatterRoleSection } from "./npb-player-analysis";
export function NpbPlayer({ services, favorites, toggle, saving }: { services: Services; favorites: Favorite[]; toggle: (target: Pick<Favorite, "kind" | "entityId" | "league">) => void; saving: boolean }) {
  const { playerId, section } = useParams();
  const canonical = !!playerId && /^[0-9a-f-]{36}$/i.test(playerId);
  const [product, setProduct] = useState<NpbCatalog["players"][number] | null>(null);
  useEffect(() => { if (!canonical || !playerId) return; let active = true; void services.product.player(playerId).then(p => { if (active) setProduct(p); }).catch(() => {}); return () => { active = false; }; }, [canonical, playerId, services]);
  const [period, setPeriod] = useState<RecentPeriod>("7d");
  const [recent, setRecent] = useState<PlayerRecentResponse | null>(null);
  const [identity, setIdentity] = useState<PlayerRecentResponse["player"] | null>(null);
  const [directoryPlayer, setDirectoryPlayer] = useState<NpbDirectoryPlayer | null>(null);
  const [directoryTeam, setDirectoryTeam] = useState<NpbPlayerDirectory["teams"][number] | null>(null);
  const [directoryTeams, setDirectoryTeams] = useState<NpbPlayerDirectory["teams"]>([]);
  const [directoryState, setDirectoryState] = useState<"loading" | "ready" | "error">("loading");
  const [recentState, setRecentState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [season, setSeason] = useState<PlayerRecentResponse | null>(null);
  const [seasonState, setSeasonState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [gameLog, setGameLog] = useState<PlayerGameLogResponse | null>(null);
  const [gameLogState, setGameLogState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [analysisBundle, setAnalysisBundle] = useState<PlayerAnalysisBundle | null>(null);
  const [analysisState, setAnalysisState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [recentCache] = useState(() => new Map<string, PlayerRecentResponse | null>());
  useEffect(() => {
    if (!canonical || !playerId || (section && section !== "stats")) return;
    let active=true;
    queueMicrotask(()=>{if(active){setSeason(null);setSeasonState("loading");}});
    void services.recent.find(playerId,"season").then(value=>{
      if(!active) return;
      recentCache.set(`${playerId}:season`,value);setSeason(value);setSeasonState(value?"ready":"missing");
    }).catch(()=>{if(active)setSeasonState("error");});
    return ()=>{active=false;};
  },[canonical,playerId,recentCache,section,services]);
  useEffect(() => {
    if (!canonical || !playerId) return;
    let active = true;
    void services.directory.findLatestNpb().then((value) => {
      if (!active) return;
      const found = value.players.find((item) => item.playerId === playerId) ?? null;
      setDirectoryPlayer(found);
      setDirectoryTeam(value.teams.find((item) => item.id === found?.teamId) ?? null);
      setDirectoryTeams(value.teams);
      setDirectoryState("ready");
    }).catch(() => { if (active) setDirectoryState("error"); });
    return () => { active = false; };
  }, [canonical, playerId, services]);
  useEffect(() => {
    if (!canonical || !playerId || section !== "analysis") return;
    let active = true;
    queueMicrotask(() => { if (active) { setAnalysisBundle(null); setAnalysisState("loading"); } });
    void services.analysisBundle.find(playerId).then((value) => {
      if (active) { setAnalysisBundle(value); setAnalysisState(value ? "ready" : "missing"); }
    }).catch(() => { if (active) setAnalysisState("error"); });
    return () => { active = false; };
  }, [canonical, playerId, section, services]);
  useEffect(() => {
    if (!canonical || !playerId) return;
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
  }, [canonical, playerId, period, recentCache, services]);
  useEffect(() => {
    if (!canonical || !playerId) return;
    let active = true;
    void services.gameLog.find(playerId).then((value) => {
      if (active) { setGameLog(value); setGameLogState(value ? "ready" : "missing"); }
    }).catch(() => { if (active) setGameLogState("error"); });
    return () => { active = false; };
  }, [canonical, playerId, services]);

  if (!canonical) return <DataState kind="no-data" title="選手が見つかりません" action="選手を探す" to="/NPB/search" />;
  if (!directoryPlayer && !identity && directoryState === "loading") return <LoadingSkeleton />;
  const player = { id: playerId!, name: directoryPlayer?.displayName ?? identity?.name ?? product?.displayName };
  if (!player.name) return <DataState kind={directoryState === "error" ? "source-unavailable" : "no-data"} title={directoryState === "error" ? "選手情報を読み込めません" : "選手が見つかりません"} action="選手を探す" to="/NPB/search" />;
  if (section && !["stats", "analysis", "more", "game-log", "trends"].includes(section)) return <Navigate to={`/NPB/players/${player.id}`} replace />;
  const base = `/NPB/players/${player.id}`;
  const gameLogTeams = new Map(directoryTeams.map(t => [t.id, t.shortName]));
  const isFavorite = favorites.some(f => f.league === "NPB" && f.kind === "player" && f.entityId === player.id);
  return <div className="screen player-screen"><Link className="back-link" to="/NPB/search">← 選手一覧</Link>
    <header className="profile-header">
      {product?.visual.photo.usage === "allowed" ? <img className="profile-photo" src={product.visual.photo.url!} alt={player.name} /> : <Monogram name={player.name} large />}
      <div className="profile-header__body"><p className="eyebrow">NPB · {directoryTeam?.shortName ?? identity?.teamName ?? "保存済み選手"}</p><h1>{player.name}</h1>
      {product?.membership.uniformNumber !== null && product?.membership.uniformNumber !== undefined && <p>背番号 {product.membership.uniformNumber}</p>}</div>
      <FavoriteButton active={isFavorite} saving={saving} label={player.name} onClick={() => toggle({ league: "NPB", kind: "player", entityId: player.id })} />
    </header>
    <PlayerTabs base={base} section={section} />
    <details className="player-tools-disclosure" open={section === "trends"}><summary>比較・推移・保存</summary><nav className="player-tools" aria-label="選手の比較と推移"><CollectionButton league="NPB" playerId={player.id} name={player.name} /><Link to={`/NPB/compare?players=${encodeURIComponent(player.id)}`}>比較に追加</Link><Link to={`/NPB/season-compare?kind=player&entity=${encodeURIComponent(player.id)}`}>保存済み年度</Link><Link to={`${base}/trends`} aria-current={section === "trends" ? "page" : undefined}>推移・連続記録</Link>{directoryTeam && <Link to={`/NPB/teams/${encodeURIComponent(directoryTeam.id)}`}>球団を見る</Link>}</nav></details>
    {section === "trends" && <NpbPlayerTrends services={services} playerId={player.id} />}
    {!section && <div className="profile-content"><PlayerSeasonView payload={season} state={seasonState} /><PlayerRecentView period={period} onPeriodChange={next => { if (next === period) return; setRecentState("loading"); setPeriod(next); }} payload={recent} state={recentState} noFactKnown={directoryPlayer?.recentAvailable === false} />
      <PlayerGameLogView payload={gameLog ? { ...gameLog, batting: gameLog.batting.slice(0, 3), pitching: gameLog.pitching.slice(0, 3) } : null} state={gameLogState} teams={gameLogTeams} /><Link className="button button--secondary" to={`${base}/game-log`}>すべての試合別成績を見る</Link></div>}
    {section === "stats" && <PlayerSeasonView payload={season} state={seasonState} />}
    {section === "game-log" && <PlayerGameLogView payload={gameLog} state={gameLogState} teams={gameLogTeams} />}
    {section === "more" && <>{product ? <NpbProfileDetails player={product} /> : directoryPlayer ? <section className="surface-card"><h2>プロフィール</h2><NpbPlayerProfileFacts player={directoryPlayer} /></section> : <DataState kind="no-data" title="プロフィールを確認できません" />}<PlayerFutureLinks base={base} /></>}
    {section === "analysis" && <div className="profile-content profile-content--analysis">{canonical
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
  </div>;
}
