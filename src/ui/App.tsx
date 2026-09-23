import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, ChartNoAxesCombined, ChevronRight, House, RefreshCw,
  Search, SlidersHorizontal, Trophy, UserRound,
} from "lucide-react";
import { Link, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import type { Services } from "../app/services";
import type { CatalogResult, Favorite, League, PlayerCatalog, Statistics } from "../domain/models";
import { metrics } from "../domain/metrics";
import { positionDefinitions } from "../domain/baseball-terms";
import { formatDate, formatDateTime, formatMetric, formatPlayerName, formatPositions, formatTeamName } from "../presentation/formatters";
import { sampleRanking } from "../presentation/sample-ranking";
import type { SampleRankingMetric } from "../presentation/sample-ranking";
import { BaseballIcon, BatIcon, HomePlateIcon } from "./baseball-icons";
import { AnalysisDirectory, AnalysisScreen } from "./analysis";
import { MatchupScreen } from "./matchup";
import { WatchGameScreen, WatchToday } from "./watch";
import { LeagueBadge, TeamBrand } from "./branding";
import {
  DataState, FavoriteButton, LoadingSkeleton, MetricGrid, PageHeading,
  PlayerAvatar, PlayerRow, SectionHeader, TeamRow,
} from "./components";

type FavoriteTarget = Pick<Favorite, "kind" | "entityId" | "league">;

function HomeScreen({ catalog, favorites, services }: { catalog: PlayerCatalog; favorites: Favorite[]; services: Services }) {
  const league = catalog.league;
  const saved = catalog.profiles.filter(({ player }) => favorites.some((favorite) =>
    favorite.kind === "player" && favorite.entityId === player.id));
  return <div className="screen home-screen">
    <div className="home-intro">
      <div><p className="eyebrow">{formatDate(new Date().toISOString())}</p><h1>今日の野球</h1></div>
      <LeagueBadge league={league} />
    </div>
    <section className="home-section">
      <SectionHeader title="今日の試合" />
      <div className="feature-panel feature-panel--game">
        <HomePlateIcon className="feature-icon" />
        <WatchToday catalog={catalog} provider={services.watch} />
      </div>
    </section>
    <section className="home-section">
      <SectionHeader title="お気に入り" action={saved.length > 2 ? "もっと見る" : undefined} to={`/${league}/my`} />
      {saved.length ? <div className="row-list">{saved.slice(0, 2).map(({ player }) =>
        <PlayerRow key={player.id} player={player} catalog={catalog} favorites={favorites} />)}</div>
        : <DataState kind="no-data" title="お気に入りはまだありません" action="選手を探す" to={`/${league}/search`} />}
    </section>
    <section className="home-section">
      <SectionHeader title="サンプル選手" action="もっと見る" to={`/${league}/search`} />
      <div className="feature-panel feature-panel--players">
        <div className="feature-panel__title"><BatIcon className="feature-icon" /><span>選手データを見てみる</span></div>
        <div className="row-list">{catalog.profiles.slice(0, 2).map(({ player }) =>
          <PlayerRow key={player.id} player={player} catalog={catalog} favorites={favorites} />)}</div>
      </div>
    </section>
    <section className="home-section home-section--compact">
      <SectionHeader title="HOT" action="参考順位" to={`/${league}/ranking`} />
      <DataState kind="unsupported" title="直近成績は未接続です" detail="HOT判定に必要な期間別データがありません。" />
    </section>
    <section className="home-section home-section--compact">
      <SectionHeader title="今日の注目" />
      <DataState kind="unsupported" title="注目情報は未接続です" />
    </section>
    <section className="home-section home-section--compact">
      <SectionHeader title="記録目前" />
      <DataState kind="unsupported" title="記録目前のデータは未接続です" />
    </section>
    <section className="home-section home-section--compact">
      <SectionHeader title="シーズン" />
      <DataState kind="unsupported" title="シーズン情報は未接続です" />
    </section>
  </div>;
}

function SearchScreen({ catalog, favorites, query, setQuery, scope, setScope }: {
  catalog: PlayerCatalog; favorites: Favorite[]; query: string; setQuery: (value: string) => void;
  scope: "players" | "teams"; setScope: (value: "players" | "teams") => void;
}) {
  const needle = query.normalize("NFKC").toLocaleLowerCase("ja-JP").trim();
  const players = catalog.profiles.filter(({ player }) => {
    const team = catalog.teams.find((item) => item.id === player.teamId);
    return [player.names.canonical, player.names.japanese, player.names.english,
      ...player.searchNames, ...player.positions,
      ...player.positions.map((code) => positionDefinitions[code]),
      team?.names.canonical, team?.names.japaneseFull, team?.names.japaneseShort,
    ].filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase("ja-JP").includes(needle);
  });
  const teams = catalog.teams.filter((team) => [
    team.names.canonical, team.names.japaneseFull, team.names.japaneseShort, team.names.abbreviation,
  ].filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase("ja-JP").includes(needle));
  const count = scope === "players" ? players.length : teams.length;
  return <div className="screen">
    <PageHeading eyebrow={`${catalog.league} / 検索`} title="探す" />
    <label className="search-field"><Search size={20} aria-hidden="true" />
      <span className="sr-only">選手・球団検索</span>
      <input type="search" placeholder="選手名・球団名・守備位置" value={query}
        onChange={(event) => setQuery(event.target.value)} />
    </label>
    <div className="segmented" role="group" aria-label="検索対象">
      <button type="button" aria-pressed={scope === "players"} onClick={() => setScope("players")}>選手</button>
      <button type="button" aria-pressed={scope === "teams"} onClick={() => setScope("teams")}>球団</button>
    </div>
    <div className="list-heading"><strong>{scope === "players" ? "選手" : "球団"}</strong><span>{count}件</span></div>
    {count ? <div className="row-list">
      {scope === "players" ? players.map(({ player }) => <PlayerRow key={player.id}
        player={player} catalog={catalog} favorites={favorites} />)
        : teams.map((team) => <TeamRow key={team.id} team={team} catalog={catalog} />)}
    </div> : <DataState kind="no-data" title="一致する結果がありません" detail="別の名前や略称をお試しください。" />}
    <Link className="ranking-entry" to={`/${catalog.league}/ranking`}>
      <Trophy size={20} aria-hidden="true" /><span><strong>ランキング</strong><small>サンプル内の参考順位を見る</small></span>
      <ChevronRight size={19} aria-hidden="true" />
    </Link>
  </div>;
}

function RankingScreen({ catalog }: { catalog: PlayerCatalog }) {
  const [metricId, setMetricId] = useState<SampleRankingMetric>("avg");
  const rows = sampleRanking(catalog, metricId);
  return <div className="screen">
    <PageHeading eyebrow={`${catalog.league} / 比較`} title="ランキング" detail="架空データのサンプル内で並べた参考表示" />
    <div className="chip-list" role="group" aria-label="指標">
      {(["avg", "hr", "ops", "era"] as const).map((id) => <button key={id}
        className="filter-chip" type="button" aria-pressed={metricId === id} onClick={() => setMetricId(id)}>
        {metrics[id]?.name}
      </button>)}
    </div>
    <p className="qualification-note"><SlidersHorizontal size={16} aria-hidden="true" />規定打席・投球回は未判定。公式順位ではありません。</p>
    {rows.length ? <div className="rank-list">
      <div className="rank-list__head"><span>順位</span><span>選手</span><span>{metrics[metricId]?.name}</span></div>
      {rows.map(({ rank, player, value }) => {
        const team = catalog.teams.find((item) => item.id === player.teamId);
        return <Link className="rank-row" key={player.id}
          to={`/${catalog.league}/players/${encodeURIComponent(player.id)}`}>
          <strong className="rank-number">{rank}</strong>
          <span className="rank-person"><TeamBrand team={team} size="xs" /><span>
            <strong>{formatPlayerName(player)}</strong><small>{formatTeamName(team, "short")} · {formatPositions(player.positions)}</small>
          </span></span>
          <strong className="rank-value">{formatMetric({ status: "available", value }, metrics[metricId]!)}</strong>
        </Link>;
      })}
    </div> : <DataState kind={catalog.source.kind === "sample" ? "no-data" : "not-implemented"}
      title={catalog.source.kind === "sample" ? "この指標の値はありません" : "正式な順位は準備中です"} />}
  </div>;
}

function StatsSection({ stats }: { stats: Statistics }) {
  return <section className="stats-section">
    <div className="section-header"><h2>{stats.season}年 · {stats.group === "hitting" ? "打撃" : "投球"}</h2>
      <span className="subtle-label">{stats.seasonType === "regular" ? "公式戦" : stats.seasonType === "preseason" ? "オープン戦" : "ポストシーズン"}</span>
    </div>
    {stats.completeness === "partial" && <p className="inline-note">一部の指標は未提供です</p>}
    <MetricGrid stats={stats} />
    {Object.keys(stats.metrics).some((id) => metrics[id]?.advanced) && <details className="advanced-disclosure">
      <summary>高度な指標<ChevronRight size={18} aria-hidden="true" /></summary>
      <MetricGrid stats={stats} advanced />
    </details>}
  </section>;
}

function PlayerScreen({ catalog, favorites, toggle, saving, services }: {
  catalog: PlayerCatalog; favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean;
  services: Services;
}) {
  const { playerId, section } = useParams();
  const profile = catalog.profiles.find((item) => item.player.id === playerId);
  if (!profile) return <div className="screen"><DataState kind="no-data" title="選手が見つかりません"
    action="検索に戻る" to={`/${catalog.league}/search`} /></div>;
  if (section && !["stats", "analysis", "more"].includes(section)) {
    return <Navigate to={`/${catalog.league}/players/${encodeURIComponent(profile.player.id)}`} replace />;
  }
  const { player } = profile;
  const team = catalog.teams.find((item) => item.id === player.teamId);
  const isFavorite = favorites.some((favorite) => favorite.kind === "player" && favorite.entityId === player.id);
  const stats = catalog.statistics.filter((item) => item.playerId === player.id);
  const base = `/${catalog.league}/players/${encodeURIComponent(player.id)}`;
  return <div className="screen">
    <Link className="back-link" to={`/${catalog.league}/search`}><ArrowLeft size={18} />検索に戻る</Link>
    <header className={`profile-header${section === "analysis" ? " profile-header--compact" : ""}`}>
      <PlayerAvatar player={player} team={team} jersey={profile.jersey} size={section === "analysis" ? "sm" : "lg"} />
      <div className="profile-header__body">
        <div className="profile-header__top"><LeagueBadge league={catalog.league} />
          <FavoriteButton active={isFavorite} saving={saving} label={formatPlayerName(player)}
            onClick={() => toggle({ kind: "player", entityId: player.id, league: catalog.league })} />
        </div>
        <h1>{formatPlayerName(player)}</h1>
        {player.names.japanese && player.names.english && <p className="secondary-name">{player.names.english}</p>}
        <p>{formatTeamName(team)} · {formatPositions(player.positions)}</p>
      </div>
    </header>
    {section !== "analysis" && <div className="profile-facts"><span>{formatPositions(player.positions, true)}</span>
      <span>背番号 {profile.jersey ?? "—"}</span><span>{profile.throws ?? "—"}投 / {profile.bats ?? "—"}打</span>
    </div>}
    <nav className="profile-tabs" aria-label="選手ページ">
      {[{ label: "概要", path: base }, { label: "成績", path: `${base}/stats` },
        { label: "分析", path: `${base}/analysis` }, { label: "その他", path: `${base}/more` }].map((tab, index) =>
        <Link key={tab.label} to={tab.path} aria-current={section === undefined ? index === 0 ? "page" : undefined
          : tab.path.endsWith(`/${section}`) ? "page" : undefined}>{tab.label}</Link>)}
    </nav>
    <div className="matchup-entry">
      {stats.some((item) => item.group === "hitting") && <Link className="text-link"
        to={`/${catalog.league}/matchup?batter=${encodeURIComponent(player.id)}`}>投手との相性を見る<ChevronRight size={16} /></Link>}
      {stats.some((item) => item.group === "pitching") && <Link className="text-link"
        to={`/${catalog.league}/matchup?pitcher=${encodeURIComponent(player.id)}`}>打者との相性を見る<ChevronRight size={16} /></Link>}
    </div>
    {!section && <div className="profile-content">
      {stats.length ? stats.map((item) => <section className="stats-section" key={`${item.group}:${item.season}`}>
        <SectionHeader title={`${item.season}年 · ${item.group === "hitting" ? "打撃" : "投球"}`}
          action="成績を見る" to={`${base}/stats`} />
        <MetricGrid stats={item} />
      </section>) : <DataState kind="no-data" title="成績はまだありません" />}
    </div>}
    {section === "stats" && <div className="profile-content">{stats.length
      ? stats.map((item) => <StatsSection key={`${item.group}:${item.season}`} stats={item} />)
      : <DataState kind="no-data" title="成績はまだありません" />}</div>}
    {section === "analysis" && <div className="profile-content profile-content--analysis"><AnalysisScreen key={player.id}
      catalog={catalog} player={player} provider={services.analysis} /></div>}
    {section === "more" && <div className="profile-content"><PageHeading title="その他" />
      <SectionHeader title="記録" /><DataState kind="not-implemented" title="記録は準備中です" />
      <SectionHeader title="経歴" /><DataState kind="not-implemented" title="経歴は準備中です" />
    </div>}
  </div>;
}

function TeamScreen({ catalog, favorites, toggle, saving }: {
  catalog: PlayerCatalog; favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean;
}) {
  const { teamId } = useParams();
  const team = catalog.teams.find((item) => item.id === teamId);
  if (!team) return <div className="screen"><DataState kind="no-data" title="球団が見つかりません"
    action="検索に戻る" to={`/${catalog.league}/search`} /></div>;
  const members = catalog.profiles.filter(({ player }) => player.teamId === team.id);
  const active = favorites.some((favorite) => favorite.kind === "team" && favorite.entityId === team.id);
  return <div className="screen">
    <Link className="back-link" to={`/${catalog.league}/search`}><ArrowLeft size={18} />検索に戻る</Link>
    <header className="team-header"><TeamBrand team={team} size="lg" /><div>
      <LeagueBadge league={catalog.league} /><h1>{formatTeamName(team)}</h1>
      {team.names.japaneseShort && <p>{team.names.japaneseShort}</p>}
    </div><FavoriteButton active={active} saving={saving} label={formatTeamName(team)}
      onClick={() => toggle({ kind: "team", entityId: team.id, league: catalog.league })} /></header>
    <SectionHeader title="登録選手" />
    {members.length ? <div className="row-list">{members.map(({ player }) =>
      <PlayerRow key={player.id} player={player} catalog={catalog} favorites={favorites} />)}</div>
      : <DataState kind="no-data" title="登録選手はいません" />}
  </div>;
}

function MyScreen({ catalog, favorites }: { catalog: PlayerCatalog; favorites: Favorite[] }) {
  const players = catalog.profiles.filter(({ player }) => favorites.some((favorite) =>
    favorite.kind === "player" && favorite.entityId === player.id));
  const teams = catalog.teams.filter((team) => favorites.some((favorite) =>
    favorite.kind === "team" && favorite.entityId === team.id));
  const missing = favorites.some((favorite) => favorite.league === catalog.league &&
    (favorite.kind === "player" ? !catalog.profiles.some(({ player }) => player.id === favorite.entityId)
      : !catalog.teams.some((team) => team.id === favorite.entityId)));
  return <div className="screen">
    <PageHeading eyebrow={`${catalog.league} / マイ`} title="お気に入り" />
    <SectionHeader title="選手" />
    {players.length ? <div className="row-list">{players.map(({ player }) =>
      <PlayerRow key={player.id} player={player} catalog={catalog} favorites={favorites} />)}</div>
      : <DataState kind="no-data" title="選手はまだ登録されていません" action="選手を探す" to={`/${catalog.league}/search`} />}
    <section className="my-teams"><SectionHeader title="球団" />
      {teams.length ? <div className="row-list">{teams.map((team) => <TeamRow key={team.id} team={team} catalog={catalog} />)}</div>
        : <DataState kind="no-data" title="球団はまだ登録されていません" action="球団を探す" to={`/${catalog.league}/search`} />}
    </section>
    {missing && <p className="inline-note">このデータに含まれないお気に入りも端末に保持しています。</p>}
  </div>;
}

function DataNote({ result, clock, loading, refresh }: {
  result: CatalogResult; clock: number; loading: boolean; refresh: () => void;
}) {
  const stale = result.freshness.state === "stale" || clock >= Date.parse(result.freshness.expiresAt);
  return <aside className="data-note" aria-label="データの状態">
    <div className="data-note__top"><strong>{stale ? "更新確認が必要" : "データ更新情報"}</strong>
      <button className="text-button" disabled={loading} onClick={refresh}><RefreshCw size={15} />{loading ? "確認中" : "更新を確認"}</button></div>
    <p>{result.data.source.label} · {result.freshness.origin === "cache" ? "端末キャッシュ" : "提供元から取得"}</p>
    <p>データ更新：{formatDateTime(result.data.source.updatedAt)}<br />取得：{formatDateTime(result.freshness.fetchedAt)}</p>
    {result.warnings.map((warning) => <p className="warning" role="status" key={warning}>{warning}</p>)}
  </aside>;
}

function LeagueView({ league, services, favorites, toggle, saving }: {
  league: League; services: Services; favorites: Favorite[];
  toggle: (target: FavoriteTarget) => void; saving: boolean;
}) {
  const [result, setResult] = useState<CatalogResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(Date.now);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<"players" | "teams">("players");
  useEffect(() => {
    let active = true;
    void services.players.load(league).then((value) => { if (active) setResult(value); })
      .catch(() => { if (active) setError("選手データを取得できません。接続を確認してください。"); })
      .finally(() => { if (active) setLoading(false); });
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [league, services]);
  async function refresh() {
    setLoading(true); setError(null);
    try { setResult(await services.players.load(league, true)); setClock(Date.now()); }
    catch { setError("選手データを取得できません。接続を確認してください。"); }
    finally { setLoading(false); }
  }
  return <>
    {error && <div className="screen"><DataState kind="source-unavailable" title={error} />
      {!result && <button className="button" onClick={() => void refresh()}>再試行</button>}</div>}
    {!result && loading && <LoadingSkeleton />}
    {result && <>
      {result.data.source.kind === "sample" && <div className="sample-banner">
        <span>サンプル</span> 架空の選手・球団・成績を表示しています
      </div>}
      <Routes>
        <Route path="home" element={<HomeScreen catalog={result.data} favorites={favorites} services={services} />} />
        <Route path="search" element={<SearchScreen catalog={result.data} favorites={favorites}
          query={searchQuery} setQuery={setSearchQuery} scope={searchScope} setScope={setSearchScope} />} />
        <Route path="ranking" element={<RankingScreen catalog={result.data} />} />
        <Route path="players/:playerId/:section?" element={<PlayerScreen catalog={result.data}
          favorites={favorites} toggle={toggle} saving={saving} services={services} />} />
        <Route path="teams/:teamId" element={<TeamScreen catalog={result.data}
          favorites={favorites} toggle={toggle} saving={saving} />} />
        <Route path="analysis" element={<AnalysisDirectory catalog={result.data}
          provider={services.analysis} favorites={favorites} />} />
        <Route path="matchup" element={<MatchupScreen catalog={result.data} provider={services.analysis} />} />
        <Route path="watch/:gameId" element={<WatchGameScreen catalog={result.data} provider={services.watch} />} />
        <Route path="records" element={<div className="screen"><PageHeading eyebrow={`${league} / 記録`} title="記録" />
          <DataState kind="not-implemented" title="記録データは未接続です" />
          <Link className="ranking-entry" to={`/${league}/ranking`}><Trophy size={20} />
            <span><strong>参考ランキング</strong><small>架空サンプル内の表示順</small></span><ChevronRight size={19} /></Link>
        </div>} />
        <Route path="my" element={<MyScreen catalog={result.data} favorites={favorites} />} />
        <Route path="players" element={<Navigate to={`/${league}/search`} replace />} />
        <Route path="favorites" element={<Navigate to={`/${league}/my`} replace />} />
        <Route path="*" element={<Navigate to={`/${league}/home`} replace />} />
      </Routes>
      <DataNote result={result} clock={clock} loading={loading} refresh={() => void refresh()} />
    </>}
  </>;
}

const navItems = [
  { label: "ホーム", segment: "home", icon: House },
  { label: "検索", segment: "search", icon: Search },
  { label: "分析", segment: "analysis", icon: ChartNoAxesCombined },
  { label: "記録", segment: "records", icon: Trophy },
  { label: "マイ", segment: "my", icon: UserRound },
] as const;

export function App({ services }: { services: Services }) {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  const league: League = location.pathname.split("/")[1] === "MLB" ? "MLB" : "NPB";
  const section = location.pathname.split("/")[2] ?? "home";
  const currentNav = section === "matchup" ? "analysis" : section === "watch" ? "home"
    : section === "players" && location.pathname.endsWith("/analysis") ? "analysis"
    : section === "players" || section === "teams" || section === "ranking" ? "search"
    : section === "favorites" ? "my" : section;
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [saving, setSaving] = useState(false);
  const [favoriteMessage, setFavoriteMessage] = useState("");
  const [favoriteError, setFavoriteError] = useState(false);
  useEffect(() => {
    let active = true;
    void services.favorites.list().then((items) => { if (active) setFavorites(items); })
      .catch(() => { if (active) { setFavoriteMessage("お気に入りを読み込めません。保存データは保持しています。"); setFavoriteError(true); } });
    return () => { active = false; };
  }, [services]);
  const toggle = useCallback((target: FavoriteTarget) => {
    setSaving(true);
    void services.favorites.toggle(target).then((items) => {
      setFavorites(items); setFavoriteError(false);
      setFavoriteMessage(items.some((item) => item.kind === target.kind && item.entityId === target.entityId)
        ? "お気に入りを保存しました。" : "お気に入りから削除しました。");
    }).catch(() => { setFavoriteError(true); setFavoriteMessage("お気に入りを保存できません。端末の保存領域を確認してください。"); })
      .finally(() => setSaving(false));
  }, [services]);
  const switchPath = (next: League) => `/${next}/${section === "matchup" ? "matchup"
    : ["home", "analysis", "records", "my", "ranking"].includes(section) ? section : "search"}`;
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={(event) => {
      event.preventDefault(); document.getElementById("main-content")?.focus();
    }}>本文へ移動</a>
    <header className="app-header"><Link className="brand" to={`/${league}/home`} aria-label="Baseball Notes ホーム">
      <span className="brand-mark"><BaseballIcon /></span><span><strong>BASEBALL</strong><small>NOTES</small></span>
    </Link><span className="preview-badge">プレビュー</span></header>
    <nav className="league-switch" aria-label="リーグ切替">
      {(["NPB", "MLB"] as const).map((item) => <Link key={item} to={switchPath(item)}
        aria-current={league === item ? "true" : undefined}><LeagueBadge league={item} /><span>{item}</span></Link>)}
    </nav>
    {favoriteMessage && <p className={`toast${favoriteError ? " toast--error" : ""}`}
      role={favoriteError ? "alert" : "status"}>{favoriteMessage}</p>}
    <main id="main-content" tabIndex={-1}><Routes>
      <Route path="/NPB/*" element={<LeagueView key="NPB" league="NPB" services={services}
        favorites={favorites} toggle={toggle} saving={saving} />} />
      <Route path="/MLB/*" element={<LeagueView key="MLB" league="MLB" services={services}
        favorites={favorites} toggle={toggle} saving={saving} />} />
      <Route path="*" element={<Navigate to="/NPB/home" replace />} />
    </Routes></main>
    <nav className="bottom-nav" aria-label="基本ナビゲーション">{navItems.map(({ label, segment, icon: Icon }) =>
      <Link key={segment} to={`/${league}/${segment}`} aria-current={currentNav === segment ? "page" : undefined}>
        <Icon size={21} strokeWidth={1.9} aria-hidden="true" /><span>{label}</span>
      </Link>)}</nav>
  </div>;
}
