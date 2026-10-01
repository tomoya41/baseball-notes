import { historicalPositions, collectedSeasonsLabel } from "../presentation/historical-player";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from "react-router-dom";
import type { Favorite } from "../domain/models";
import { isVerifiedJapanPlayer } from "../domain/mlb-japan-cohort";
import { CompetitionHeader, DateRibbon, HomeModeNav, Monogram, PlayerTabs, ScoreboardRow, ScoreHero } from "./design-system";
import { matchesMlbPlayerName } from "../domain/mlb-japanese-display";
import { battingAggregate, dateWindow, pitchingAggregate } from "../domain/mlb-historical-aggregate";
import type { DatedBatter, DatedPitcher } from "../domain/mlb-historical-aggregate";
import type { HistoricalGame, HistoricalPlayer } from "../data/mlb-historical";
import { RETROSHEET_ATTRIBUTION } from "../data/source-registry";
import { DataState, FavoriteButton, LoadingSkeleton, PageHeading, SectionHeader, MetricLabel } from "./components";
import { HistoricalAdvancedAnalysis } from "./mlb-historical-advanced";
import { useHistoricalStatic as useStatic, useHistoricalDirectory } from "./use-mlb-historical";
import { ExploreScreen, FutureFeatureScreen, PlayerFutureLinks } from "./future-surfaces";

import { MlbFollowPlayer } from "./mlb-follow-board";
import { CompetitionTabs } from "./historical-competition";
import { HistoricalCompetitionContext, useHistoricalCompetition, historicalRouteCompetition, historicalSearchPath } from "./historical-competition-context";
import { MlbPostseasonScreen } from "./postseason";

const canonicalGameId = /^mlb:game:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const canonicalPlayerId = /^mlb:player:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Season = { season: number; firstDate: string; lastDate: string; games: number; coverage: string; playerCount: number };
type Manifest = { schemaVersion: 1; league: "MLB"; seasons: Season[];
  teams: { id: string; name: string }[]; current2026: "unavailable";
  features?: { directBvp?: string; situationalAnalysis?: string } };
type Profile = { player: HistoricalPlayer; collectedRange: string;
  collectedRangeTotals: { batting: Record<string, { value: number | null }> | null;
    pitching: Record<string, { value: number | null }> | null };
  seasonTotals: Record<string, { batting: Record<string, { value: number | null }> | null;
    pitching: Record<string, { value: number | null }> | null }>;
  batting: DatedBatter[]; pitching: DatedPitcher[] };
type Schedule = { season: number; date: string; games: {
  id: string; homeTeamId: string; awayTeamId: string; homeRuns: number; awayRuns: number;
  status: "final"; complete: boolean; number: number;
}[] };
type Detail = { game: Omit<HistoricalGame, "batting" | "pitching"> & {
  batting: (HistoricalGame["batting"][number] & { name: string | null })[];
  pitching: (HistoricalGame["pitching"][number] & { name: string | null })[];
} };
type FavoriteTarget = Pick<Favorite, "kind" | "entityId" | "league">;

function Status({ state, missing = "データがありません" }: { state: { status: "loading" | "ready" | "missing" | "error"; retry: () => void }; missing?: string }) {
  return state.status === "loading" ? <LoadingSkeleton /> :
    <><DataState kind={state.status === "error" ? "source-unavailable" : "no-data"}
      title={state.status === "error" ? "データを読み込めません" : missing} />{state.status === "error" && <button className="text-button" type="button" onClick={state.retry}>再読み込み</button>}</>;
}
const format = (value: number | null | undefined) => value === null || value === undefined ? "—" : String(value);
const teamName = (manifest: Manifest, id: string) => manifest.teams.find(team => team.id === id)?.name ?? "球団不明";

export function MlbDataSources() {
  return <div className="screen"><PageHeading eyebrow="BASEBALL NOTES" title="データ提供元" />
    <section className="surface-card"><h2>NPBの保存済みデータ</h2><p>採用済みのnf3データをもとに、試合・選手の成績を表示しています。速報や公式記録の代替ではありません。</p><p>確認できたプロフィール項目のみ表示します。使用許諾を確認できていない顔写真・球団ロゴは使用していません。</p></section>
    <section className="surface-card"><h2>Retrosheet</h2>
      <p>{RETROSHEET_ATTRIBUTION}</p>
      <p><a href="https://www.retrosheet.org/notice.txt">利用告知</a> · <a href="https://www.retrosheet.org/downloads/csvdownloads.html">配布データ</a></p>
    </section>
    <section className="surface-card"><h2>Chadwick Register</h2>
      <p>Contains information from <a href="https://github.com/chadwickbureau/register">Chadwick Register</a> which is made available under the <a href="https://opendatacommons.org/licenses/by/1-0/">ODC Attribution License 1.0</a>.</p>
      <p>選手IDの照合に使用しています。</p>
    </section>
    <section className="surface-card"><h2>選手名・プロフィール</h2>
      <p>日本語表示名と、一部のNPBプロフィールに<a href="https://www.wikidata.org/">Wikidata</a>の構造化データ（<a href="https://www.wikidata.org/wiki/Wikidata:Licensing">CC0</a>）を利用しています。確認済みの選手IDに紐づく項目だけを表示します。</p>
      <p>日本人選手は漢字、その他の選手は確認できるカタカナ表記を表示します。表記未確認の選手は原名を表示します。</p>
      <p>日本人選手の絞り込みは、国籍情報とRetrosheet・Chadwickの選手IDを照合し、確認できた選手だけを対象にしています。</p>
    </section></div>;
}
export function MlbHistoricalHome({ manifest, favorites, toggle, saving }: { manifest: Manifest; favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean }) {
  const [params, setParams] = useSearchParams();
  const selectedYear = Number(params.get("season") ?? manifest.seasons.at(-1)!.season);
  const view = ["japan","follow","league"].includes(params.get("view") ?? "") ? params.get("view")! : "japan";
  const change = (key: string,value: string) => { const next = new URLSearchParams(params); next.set(key,value); setParams(next); };
  const latest = manifest.seasons.find(item => item.season === selectedYear);
  const index = useHistoricalDirectory();
  const results = useStatic<Schedule>(latest ? `schedule/${latest.season}/${latest.lastDate}.json` : null);
  const records = useStatic<{ counting: string; records: { metric: string; role: string; classification?: string; rows: { playerId: string; name: string; value: number; rank: number }[] }[] }>(latest && view === "league" ? `records/${latest.season}.json` : null);
  if (!latest) return <div className="screen"><PageHeading eyebrow="MLB" title="未収録シーズン" /><DataState kind="unsupported" title={selectedYear === 2026 ? "2026年の試合結果・選手成績は未対応" : "このシーズンは未収録です"} action="収録済みのシーズンへ" to="/MLB/home" /></div>;
  const japan = (index.value?.players ?? []).filter(p => isVerifiedJapanPlayer(p.id) && p.seasons.includes(latest.season))
    .sort((a,b) => Number(b.id === "mlb:player:e70b8d12-aa41-50c0-9c1b-d468d451355f") - Number(a.id === "mlb:player:e70b8d12-aa41-50c0-9c1b-d468d451355f") || a.name.localeCompare(b.name,"ja"));
  const saved = (index.value?.players ?? []).filter(p => favorites.some(f => f.league === "MLB" && f.entityId === p.id));
  const leaders = records.value?.counting === "ready" ? records.value.records.find(record => record.role === "batting" && record.metric === "HR" && record.classification !== "rate")?.rows.slice(0,3) : undefined;
  const players = view === "follow" ? saved : japan;
  return <div className="screen home-screen home-hub"><CompetitionHeader league="MLB" context="Historical"><label className="competition-season"><span className="sr-only">シーズン</span><select value={latest.season} onChange={e => change("season",e.target.value)}>{manifest.seasons.map(s => <option key={s.season} value={s.season}>{s.season}年</option>)}</select></label></CompetitionHeader>
    <HomeModeNav active={view} onChange={v => change("view",v)} modes={[{id:"japan",label:"日本人選手"},{id:"follow",label:"フォロー"},{id:"league",label:"リーグ"}]} />
    {view !== "league" ? <section className="follow-board"><SectionHeader title={`${latest.season} シーズン`} action={view === "follow" ? "My" : "すべての日本人選手"} to={view === "follow" ? "/MLB/my" : `/MLB/search?focus=japan&season=${latest.season}`} />{index.status !== "ready" ? <Status state={index} /> : players.length ? players.slice(0,4).map(p => <MlbFollowPlayer key={`${p.id}:${latest.season}`} player={p} season={latest.season} favorites={favorites} toggle={toggle} saving={saving} />) : <DataState kind="no-data" title={view === "follow" ? "お気に入りの選手をここに" : "この年の日本人選手は未収録"} action="選手を探す" to={`/MLB/search?season=${latest.season}`} />}</section> : <><section className="home-section"><SectionHeader title="試合結果" action="日程・結果" to={`/MLB/schedule?season=${latest.season}&date=${latest.lastDate}`} />{results.status === "ready" ? <div className="scoreboard-list">{results.value!.games.map(game => <ScoreboardRow key={game.id} to={`/MLB/games/${encodeURIComponent(game.id)}`} away={teamName(manifest,game.awayTeamId)} home={teamName(manifest,game.homeTeamId)} awayScore={game.awayRuns} homeScore={game.homeRuns} date={latest.lastDate.slice(5).replace("-","/")} status="試合終了" gameNumber={game.number} partial={!game.complete} />)}</div> : <Status state={results} />}</section><section className="home-section"><SectionHeader title="本塁打" action="個人成績" to={`/MLB/records?season=${latest.season}`} />{leaders ? <ol className="row-list leaderboard">{leaders.map(player => <li key={player.playerId}><Link to={`/MLB/players/${encodeURIComponent(player.playerId)}?season=${latest.season}`}><strong className="rank-number">{player.rank}</strong><span className="rank-person"><strong>{player.name}</strong></span><strong className="rank-value">{player.value}</strong></Link></li>)}</ol> : <DataState kind="unsupported" title="集計を確認中" />}</section></>}
    {view !== "league" && <Link className="hub-game-entry" to={`/MLB/schedule?season=${latest.season}&date=${latest.lastDate}`}><span><small>{latest.lastDate.replaceAll("-",".")}</small><strong>試合結果</strong></span><span>{results.value?.games.length ?? "—"}<small>試合 →</small></span></Link>}
    <div className="hub-links"><Link to={`/MLB/postseason?season=${latest.season}`}>Postseason <span>→</span></Link></div>
    <p className="inline-note availability-note">過去記録 2020–2025 · 2026年の試合結果・選手成績は未対応</p></div>;
}
export function MlbHistoricalSearch({ manifest, favorites, toggle, saving }: { manifest: Manifest; favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean }) {
  const competition = useHistoricalCompetition();
  const result = useHistoricalDirectory();
  const [params,setParams] = useSearchParams();
  const query = params.get("q") ?? "", focus = params.get("focus") === "japan";
  const selectedSeason = params.get("season") ?? "all", team = params.get("team") ?? "";
  const update = (key: string,value: string) => { const next = new URLSearchParams(params); if(value) next.set(key,value); else next.delete(key); setParams(next,{replace:true}); };
  const [limit,setLimit] = useState(80);
  const rows = useMemo(() => (result.value?.players ?? []).filter(p => (selectedSeason === "all" || p.seasons.includes(Number(selectedSeason))) && (!team || p.teamIds.includes(team)) && (!focus || isVerifiedJapanPlayer(p.id)) && matchesMlbPlayerName(p.id,p.name,query)),[result.value,selectedSeason,team,focus,query]);
  return <div className="screen"><PageHeading eyebrow="MLB · 2020–2025" title="選手" />
    <div className="segmented" role="group" aria-label="選手の絞り込み"><button aria-pressed={!focus} onClick={() => { update("focus","");setLimit(80); }}>すべての選手</button><button aria-pressed={focus} onClick={() => { update("focus","japan");setLimit(80); }}><span className="japan-dot" />日本人選手</button></div>
    <label className="search-field"><Search size={19} aria-hidden="true" /><span className="sr-only">選手名を検索</span><input type="search" placeholder="選手名を入力" value={query} onChange={e => { update("q",e.target.value);setLimit(80); }} /></label>
    <div className="mlb-controls"><label>シーズン<select value={selectedSeason} onChange={e => { update("season",e.target.value);setLimit(80); }}><option value="all">収録期間すべて</option>{manifest.seasons.map(s => <option key={s.season} value={s.season}>{s.season}年</option>)}</select></label><label>所属した球団<select value={team} onChange={e => { update("team",e.target.value);setLimit(80); }}><option value="">すべての球団</option>{manifest.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>
    <div className="list-heading"><strong>{focus ? "確認済みの日本人選手" : "選手一覧"}</strong><span>{rows.length}人</span></div>
    {result.status !== "ready" ? <Status state={result} /> : !rows.length ? <DataState kind="no-data" title="一致する選手がいません" detail="名前や絞り込み条件を変えてみてください。" /> : <div className="row-list">{rows.slice(0,limit).map(p => <div className="mlb-player-row" key={p.id}><Link to={`/MLB/players/${encodeURIComponent(p.id)}?${selectedSeason === "all" ? "" : `season=${Number(selectedSeason)}`}${competition === "postseason" || p.postseasonOnly ? "&competition=postseason" : ""}`}><Monogram name={p.name} /><span><strong>{p.name}</strong><small>{historicalPositions(p.positions) || "守備位置未登録"} · {collectedSeasonsLabel(p.seasons)}{p.postseasonOnly && " · Postseason"}</small></span></Link><FavoriteButton active={favorites.some(f => f.league === "MLB" && f.entityId === p.id)} saving={saving} label={p.name} onClick={() => toggle({league:"MLB",kind:"player",entityId:p.id})} /></div>)}</div>}
    {rows.length > limit && <button className="button button--secondary" onClick={() => setLimit(n => n+80)}>さらに80人を表示</button>}
    {focus && <p className="inline-note">国籍情報と選手IDを照合・確認できた選手を表示しています。未確認の選手は「すべての選手」から探せます。</p>}
  </div>;
}
export function MlbHistoricalSchedule({ manifest }: { manifest: Manifest }) {
  const competition = useHistoricalCompetition();
  const scopeQuery = competition === "postseason" ? "&competition=postseason" : "";
  const [params, setParams] = useSearchParams();
  const season = Number(params.get("season") ?? 2025);
  const supportedSeason = manifest.seasons.some(item => item.season === season);
  const selected = manifest.seasons.find(item => item.season === season) ?? manifest.seasons.at(-1)!;
  const date = params.get("date") ?? selected.lastDate;
  const validDate = supportedSeason && /^\d{4}-\d{2}-\d{2}$/.test(date) && date.startsWith(`${selected.season}-`);
  const result = useStatic<Schedule>(validDate ? `schedule/${selected.season}/${date}.json` : null);
  const navigate = (next: string) => setParams({ season: String(next.slice(0, 4)), date: next, ...(competition === "postseason" ? { competition } : {}) });
  if (!supportedSeason) return <div className="screen"><PageHeading eyebrow="MLB" title="日程・結果" />
    <DataState kind="unsupported" title={season === 2026 ? "2026年の試合結果・選手成績は未対応" : "このシーズンは未収録です"}
      action="過去の記録を見る" to="/MLB/schedule?season=2025" /></div>;
  return <div className="screen"><PageHeading eyebrow="MLB / 過去記録" title="日程・結果" />
    <div className="schedule-season"><label>シーズン<select value={selected.season} onChange={e => { const next = manifest.seasons.find(s => s.season === Number(e.target.value))!; navigate(next.lastDate); }}>{manifest.seasons.map(s => <option key={s.season}>{s.season}</option>)}</select></label><span>{competition === "postseason" ? "Postseason" : "Regular Season"}</span></div>
    {validDate && <DateRibbon date={date} min={selected.firstDate} max={selected.lastDate} onChange={navigate} />}
    {!validDate ? <DataState kind="no-data" title="対象期間外の日付です" /> : result.status === "missing" ?
      <DataState kind="no-data" title="この日に収録された公式戦はありません" detail="現在シーズンの試合有無を示すものではありません。" /> :
      result.status !== "ready" ? <Status state={result} /> : <div className="scoreboard-list">
        {result.value!.games.map(game => <ScoreboardRow key={game.id} to={`/MLB/games/${encodeURIComponent(game.id)}${scopeQuery ? `?season=${selected.season}&competition=postseason` : ""}`}
          away={teamName(manifest, game.awayTeamId)} home={teamName(manifest, game.homeTeamId)} awayScore={game.awayRuns} homeScore={game.homeRuns}
          status="試合終了" gameNumber={game.number} partial={!game.complete} />)}</div>}
    <p className="inline-note">出典: Retrosheet · <Link to="/MLB/sources">データ提供元</Link></p>
  </div>;
}
export function MlbHistoricalGame({ manifest }: { manifest: Manifest }) {
  const competition = useHistoricalCompetition(), scopeQuery = competition === "postseason" ? "&competition=postseason" : "";
  const { gameId } = useParams();
  const result = useStatic<Detail>(gameId && canonicalGameId.test(gameId) ? `games/${gameId.replaceAll(":", "_")}.json` : null);
  if (!gameId || !canonicalGameId.test(gameId)) return <div className="screen"><PageHeading eyebrow="MLB / 過去記録" title="試合詳細" />
    <DataState kind="no-data" title="試合が見つかりません" /></div>;
  if (result.status !== "ready") return <div className="screen"><PageHeading eyebrow="MLB / 過去記録" title="試合詳細" />
    <Status state={result} missing="試合が見つかりません" /></div>;
  const game = result.value!.game;
  const renderTeam = (teamId: string, label: string) => {
    const batting = game.batting.filter(row => row.teamId === teamId)
      .sort((a, b) => (a.battingOrder ?? 99) - (b.battingOrder ?? 99) ||
        (a.appearanceOrder ?? 99) - (b.appearanceOrder ?? 99));
    const pitching = game.pitching.filter(row => row.teamId === teamId)
      .sort((a, b) => (a.appearanceOrder ?? 99) - (b.appearanceOrder ?? 99));
    return <section className="mlb-box-team" key={teamId} aria-label={`${label} ${teamName(manifest, teamId)}`}>
      <h2>{label} · {teamName(manifest, teamId)}</h2><h3>打撃</h3>
      <p className="table-scroll-hint">横にスワイプして成績を見る →</p><div className="mlb-stat-scroll box-primary" tabIndex={0} role="region" aria-label={`${teamName(manifest, teamId)}の打撃成績。横スクロールできます`}><table><thead><tr><th>打順</th><th>選手</th><th><MetricLabel metric="PA" /></th><th><MetricLabel metric="AB" /></th><th>H</th><th>HR</th><th>RBI</th></tr></thead>
        <tbody>{batting.map(row => <tr key={row.playerId}><td>{format(row.battingOrder)}</td>
          <th scope="row"><Link to={`/MLB/players/${encodeURIComponent(row.playerId)}?season=${game.season}${scopeQuery}`}>{row.name ?? "選手"}</Link>
            {row.starter === false && <small>途中出場</small>}</th>
          <td>{format(row.pa)}</td><td>{format(row.ab)}</td><td>{format(row.hits)}</td>
          <td>{format(row.homeRuns)}</td><td>{format(row.rbi)}</td></tr>)}</tbody></table></div>
      <details><summary>打撃の詳細項目</summary><div className="mlb-stat-scroll" tabIndex={0} role="region" aria-label={`${teamName(manifest, teamId)}の打撃詳細`}><table>
        <thead><tr><th>選手</th><th>R</th><th>2B</th><th>3B</th><th>BB</th><th>HBP</th><th>SH</th><th>SF</th><th>SO</th><th>SB</th><th>CS</th></tr></thead>
        <tbody>{batting.map(row => <tr key={row.playerId}><th scope="row">{row.name}</th>
          {[row.runs, row.doubles, row.triples, row.bb, row.hbp, row.sh, row.sf, row.so, row.sb, row.cs]
            .map((item, index) => <td key={index}>{format(item)}</td>)}</tr>)}</tbody></table></div></details>
      <h3>投球</h3><div className="mlb-stat-scroll box-primary" tabIndex={0} role="region" aria-label={`${teamName(manifest, teamId)}の投球成績。横スクロールできます`}><table><thead><tr>
        <th>役割</th><th>選手</th><th><MetricLabel metric="IP" /></th><th><MetricLabel metric="BF" /></th><th>H</th><th>HR</th><th>SO</th><th>R</th><th>ER</th></tr></thead>
        <tbody>{pitching.map(row => <tr key={row.playerId}><td>{row.role === "starter" ? "先発" : row.role === "reliever" ? "救援" : "不明"}</td>
          <th scope="row"><Link to={`/MLB/players/${encodeURIComponent(row.playerId)}?season=${game.season}${scopeQuery}`}>{row.name ?? "選手"}</Link></th>
          <td>{row.outsRecorded === null ? "—" : `${Math.floor(row.outsRecorded / 3)}.${row.outsRecorded % 3}`}</td>
          {[row.bf, row.hits, row.homeRuns, row.so, row.runs, row.er].map((item, index) => <td key={index}>{format(item)}</td>)}</tr>)}</tbody></table></div>
      <details><summary>投球の詳細項目</summary><div className="mlb-stat-scroll" tabIndex={0} role="region" aria-label={`${teamName(manifest, teamId)}の投球詳細`}><table>
        <thead><tr><th>選手</th><th>BB</th><th>HBP</th><th>W</th><th>L</th><th>SV</th><th>HLD</th><th>球数</th></tr></thead>
        <tbody>{pitching.map(row => <tr key={row.playerId}><th scope="row">{row.name}</th>
          {[row.bb, row.hbp, row.win === null ? null : Number(row.win), row.loss === null ? null : Number(row.loss),
            row.save === null ? null : Number(row.save), row.hold, row.pitchCount]
            .map((item, index) => <td key={index}>{format(item)}</td>)}</tr>)}</tbody></table></div></details>
    </section>;
  };
  return <div className="screen"><PageHeading eyebrow={`MLB / ${competition === "postseason" ? "Postseason" : "Regular Season"}`} title={`${game.date} 試合結果`} />
    <ScoreHero away={teamName(manifest,game.awayTeamId)} home={teamName(manifest,game.homeTeamId)} awayScore={game.awayRuns} homeScore={game.homeRuns} status={`終了 · ${game.innings === null ? "回数不明" : `${game.innings}回`}`} />
    {renderTeam(game.awayTeamId, "アウェー")}{renderTeam(game.homeTeamId, "ホーム")}
    <Link to={`/MLB/schedule?season=${game.season}&date=${game.date}${scopeQuery}`}>日程・結果へ戻る</Link></div>;
}

const metric = (metrics: Record<string, { value: number | null }> | null | undefined, key: string,
  digits = 0) => metrics?.[key]?.value === null || metrics?.[key]?.value === undefined ? "—" :
    Number(metrics[key]!.value).toFixed(digits);
export function HistoricalMetrics({ metrics, pitching = false }: { metrics: Record<string,{value:number|null}>; pitching?: boolean }) {
  const keys = pitching ? ["ERA","K9","outsRecorded","SO","appearances","GS"] : ["OPS","AVG","HR","RBI","PA","H"];
  return <div className="metric-grid metric-primary-grid">{keys.map(key => <div className="metric-tile" key={key}><span className="metric-tile__label"><MetricLabel metric={key} label={({outsRecorded:"IP",appearances:"登板",K9:"K/9",PA:"打席",H:"安打",SO:"奪三振",HR:"HR",RBI:"打点"} as Record<string,string>)[key] ?? key} /></span><strong className="metric-tile__value">{key === "outsRecorded" ? metrics[key]?.value == null ? "—" : `${Math.floor(metrics[key]!.value! / 3)}.${metrics[key]!.value! % 3}` : metric(metrics,key,["OPS","AVG"].includes(key) ? 3 : ["ERA","K9"].includes(key) ? 2 : 0)}</strong></div>)}</div>;
}
function MetricDetails({ title, metrics, pitching = false }: {
  title: string; metrics: Record<string, { value: number | null }> | null | undefined; pitching?: boolean;
}) {
  if (!metrics) return null;
  const keys = pitching ? ["appearances", "GS", "outsRecorded", "BF", "H", "HR", "BB", "SO", "R", "ER", "W", "L", "SV", "ERA", "K9"] :
    ["G", "PA", "AB", "R", "H", "2B", "3B", "HR", "RBI", "BB", "HBP", "SH", "SF", "SO", "SB", "CS", "AVG", "OBP", "SLG", "OPS"];
  return <details className="mlb-metric-details"><summary>{title}</summary><dl>{keys.map(key =>
    <div key={key} style={{ display: "contents" }}><dt><MetricLabel metric={key} label={key === "appearances" ? "登板" : key === "outsRecorded" ? "IP" : key === "K9" ? "K/9" : key} /></dt>
      <dd>{key === "outsRecorded" ? metrics[key]?.value == null ? "—" : `${Math.floor(metrics[key]!.value! / 3)}.${metrics[key]!.value! % 3}` :
        metric(metrics, key, ["AVG", "OBP", "SLG", "OPS"].includes(key) ? 3 : ["ERA", "K9"].includes(key) ? 2 : 0)}</dd></div>)}</dl>
    </details>;
}
export function MlbHistoricalPlayer({ manifest, favorites, toggle, saving }: {
  manifest: Manifest; favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean;
}) {
  const competition = useHistoricalCompetition(), scopeQuery = competition === "postseason" ? "&competition=postseason" : "";
  const { playerId, section } = useParams();
  const [params,setParams] = useSearchParams();
  const result = useStatic<Profile>(playerId && canonicalPlayerId.test(playerId) ? `players/${playerId.replaceAll(":", "_")}.json` : null);
  const season = params.has("season") ? Number(params.get("season")) : null;
  const [period, setPeriod] = useState<7 | 14 | 30>(30);
  const [split, setSplit] = useState<"total" | "home" | "away" | "opponent" | "order" | "batter-starter" | "batter-substitute" | "pitcher-starter" | "pitcher-reliever">("total");
  const [opponent, setOpponent] = useState("");
  const [battingOrder, setBattingOrder] = useState(1);
  const asOf = params.get("asOfDate") ?? params.get("date");
  const context = (key: string, value: string) => { const next = new URLSearchParams(params); next.set(key,value); if(key === "season") { next.delete("date");next.delete("asOfDate"); } setParams(next); };
  if (!playerId || !canonicalPlayerId.test(playerId)) return <div className="screen"><PageHeading eyebrow="MLB / 過去記録" title="選手" />
    <DataState kind="no-data" title="選手が見つかりません" /></div>;
  if (result.status !== "ready") return <div className="screen"><PageHeading eyebrow="MLB / 過去記録" title="選手" />
    <Status state={result} missing="選手が見つかりません" /></div>;
  const profile = result.value!;
  const player = profile.player;
  if (season !== null && !player.seasons.includes(season)) return <div className="screen"><PageHeading eyebrow="MLB · HISTORICAL" title={player.name} /><DataState kind="unsupported" title={season === 2026 ? "2026年の試合結果・選手成績は未対応" : "この選手の指定シーズンは未収録です"} action="収録済みの成績を見る" to={`/MLB/players/${encodeURIComponent(player.id)}`} /></div>;
  const selected = season ?? player.seasons.at(-1)!;
  const games = profile.batting.filter(row => row.season === selected);
  const pitches = profile.pitching.filter(row => row.season === selected);
  const opponents = [...new Set([...games, ...pitches].map(row => row.opponentTeamId))].sort();
  const orders = [...new Set(games.map(row => row.battingOrder).filter((value): value is number => value !== null))].sort((a, b) => a - b);
  const activeOpponent = opponents.includes(opponent) ? opponent : opponents[0];
  const activeOrder = orders.includes(battingOrder) ? battingOrder : orders[0];
  const effectiveSplit = section === "analysis" ? split : "total";
  const filteredBatting = games.filter(row => effectiveSplit === "total" || effectiveSplit === "home" && row.home ||
    effectiveSplit === "away" && !row.home || effectiveSplit === "opponent" && row.opponentTeamId === activeOpponent ||
    effectiveSplit === "order" && row.battingOrder === activeOrder ||
    effectiveSplit === "batter-starter" && row.starter === true ||
    effectiveSplit === "batter-substitute" && row.starter === false);
  const filteredPitching = pitches.filter(row => effectiveSplit === "total" || effectiveSplit === "home" && row.home ||
    effectiveSplit === "away" && !row.home || effectiveSplit === "opponent" && row.opponentTeamId === activeOpponent ||
    effectiveSplit === "pitcher-starter" && row.role === "starter" ||
    effectiveSplit === "pitcher-reliever" && row.role === "reliever");
  const lastDate = manifest.seasons.find(item => item.season === selected)?.lastDate ?? `${selected}-12-31`;
  const firstDate = manifest.seasons.find(item => item.season === selected)?.firstDate ?? `${selected}-01-01`;
  const selectedAsOf = asOf && asOf >= firstDate && asOf <= lastDate ? asOf : lastDate;
  const { from, to } = dateWindow(selectedAsOf, period);
  const splitOptions = (["total", "home", "away", "opponent", "order", "batter-starter", "batter-substitute", "pitcher-starter", "pitcher-reliever"] as const)
    .filter(value => games.length || !["order", "batter-starter", "batter-substitute"].includes(value))
    .filter(value => pitches.length || !["pitcher-starter", "pitcher-reliever"].includes(value));
  const batting = battingAggregate(player.id, filteredBatting, from, to);
  const pitching = pitchingAggregate(player.id, filteredPitching, from, to);
  const seasonTotals = profile.seasonTotals[String(selected)];
  const log = [...new Map([...games, ...pitches].map(row => [row.gameId, row])).values()]
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  const base = `/MLB/players/${encodeURIComponent(player.id)}`;
  if (section && !["stats","analysis","game-log","more"].includes(section)) return <Navigate to={base} replace />;
  return <div className="screen player-screen"><Link className="back-link" to={historicalSearchPath(competition === "postseason" ? `?season=${selected}&competition=postseason` : "")}>← 選手一覧</Link><header className="profile-header"><Monogram name={player.name} large /><div className="profile-header__body"><p className="eyebrow">MLB{isVerifiedJapanPlayer(player.id) ? " · 日本人選手" : " · 過去記録"}</p><h1>{player.name}</h1><p>{historicalPositions(player.positions)} · {player.seasons[0]}—{player.seasons.at(-1)} 収録</p></div><FavoriteButton active={favorites.some(f => f.league === "MLB" && f.entityId === player.id)} saving={saving} label={player.name} onClick={() => toggle({league:"MLB",kind:"player",entityId:player.id})} /></header>
    <PlayerTabs base={base} section={section} search={`?season=${selected}${asOf ? `&asOfDate=${selectedAsOf}` : ""}${scopeQuery}`} />
    {section !== "more" && <div className="mlb-controls"><label>シーズン<select value={selected} onChange={e => context("season",e.target.value)}>{player.seasons.map(s => <option key={s}>{s}</option>)}</select></label></div>}
    {(!section || section === "stats") && <>
    <section className="surface-card"><h2>{selected} {competition === "postseason" ? "Postseason" : "シーズン成績"}</h2>
      {seasonTotals?.batting && <><h3 className="stat-role-label">打撃</h3><HistoricalMetrics metrics={seasonTotals.batting} /></>}
      {seasonTotals?.pitching && <><h3 className="stat-role-label">投球</h3><HistoricalMetrics metrics={seasonTotals.pitching} pitching /></>}
      <MetricDetails title="シーズン打撃成績の詳細" metrics={seasonTotals?.batting} />
      <MetricDetails title="シーズン投球成績の詳細" metrics={seasonTotals?.pitching} pitching />
    </section>
</>}
    {section === "stats" && <>
    <section className="surface-card"><h2>収録期間合計</h2><p>{profile.collectedRange}。MLB通算を意味しません。</p>
      {profile.collectedRangeTotals.batting && <p>打撃: {metric(profile.collectedRangeTotals.batting, "G")}試合 · {metric(profile.collectedRangeTotals.batting, "H")}安打 · {metric(profile.collectedRangeTotals.batting, "HR")}本塁打</p>}
      {profile.collectedRangeTotals.pitching && <p>投球: {metric(profile.collectedRangeTotals.pitching, "appearances")}登板 · {metric(profile.collectedRangeTotals.pitching, "SO")}奪三振</p>}
      <MetricDetails title="収録期間の打撃詳細" metrics={profile.collectedRangeTotals.batting} />
      <MetricDetails title="収録期間の投球詳細" metrics={profile.collectedRangeTotals.pitching} pitching />
    </section>
</>}
    {(!section || section === "analysis") && <>
    <section className="surface-card"><h2>最近の成績</h2>
      <label className="mlb-asof">基準日<input type="date" min={firstDate} max={lastDate}
        value={selectedAsOf} onChange={event => context("asOfDate",event.target.value)} /></label>
      <div className="segmented period-control" role="group" aria-label="期間">{([7, 14, 30] as const).map(value =>
        <button key={value} type="button" aria-pressed={period === value}
          onClick={() => setPeriod(value)}>{value}日</button>)}</div>
      {section === "analysis" && <label className="analysis-condition">条件<select value={split} onChange={event => setSplit(event.target.value as typeof split)}>{splitOptions.map(value =>
        <option key={value} value={value}>{({ total: "全体", home: "ホーム", away: "アウェー", opponent: "対戦相手", order: "打順", "batter-starter": "打者・先発", "batter-substitute": "打者・途中出場", "pitcher-starter": "投手・先発", "pitcher-reliever": "投手・救援" })[value]}</option>)}</select></label>}
      {effectiveSplit === "opponent" && <label className="mlb-asof">対戦相手<select value={activeOpponent}
        onChange={event => setOpponent(event.target.value)}>{opponents.map(team =>
          <option key={team} value={team}>{teamName(manifest, team)}</option>)}</select></label>}
      {effectiveSplit === "order" && <label className="mlb-asof">打順<select value={activeOrder}
        onChange={event => setBattingOrder(Number(event.target.value))}>{orders.map(order =>
          <option key={order} value={order}>{order}番</option>)}</select></label>}
      {games.length > 0 && <><h3 className="stat-role-label">打撃</h3><HistoricalMetrics metrics={batting.metrics} /></>}
      {pitches.length > 0 && <><h3 className="stat-role-label">投球</h3><HistoricalMetrics metrics={pitching.metrics} pitching /></>}
      <MetricDetails title="期間・条件別の打撃詳細" metrics={batting.metrics} />
      <MetricDetails title="期間・条件別の投球詳細" metrics={pitching.metrics} pitching />
      <p className="inline-note">選択基準日までの期間。出場記録がない条件は—です。</p>
    </section>
</>}
    {section === "analysis" && (manifest.features?.directBvp === "available" || manifest.features?.situationalAnalysis === "available") &&
      <HistoricalAdvancedAnalysis playerId={player.id} season={selected}
        hasBatting={games.some(row => (row.pa ?? 0) > 0) || (games.length > 0 && pitches.length === 0)}
        hasPitching={pitches.length > 0} />}

    {(!section || section === "game-log") && <>
    <section className="surface-card"><h2>試合別成績</h2><div className="row-list">
      {log.slice(0, section === "game-log" ? 30 : 3).map(row => <Link className="ranking-entry" key={row.gameId} to={`/MLB/games/${encodeURIComponent(row.gameId)}${competition === "postseason" ? `?season=${selected}&competition=postseason` : ""}`}>
        {row.date} · {row.home ? "ホーム" : "アウェー"} · 対 {teamName(manifest, row.opponentTeamId)}
        {games.find(item => item.gameId === row.gameId) && <small>打撃: PA {format(games.find(item => item.gameId === row.gameId)?.pa)} · H {format(games.find(item => item.gameId === row.gameId)?.hits)} · HR {format(games.find(item => item.gameId === row.gameId)?.homeRuns)}</small>}
        {pitches.find(item => item.gameId === row.gameId) && <small>投球: {format(pitches.find(item => item.gameId === row.gameId)?.outsRecorded)}アウト · SO {format(pitches.find(item => item.gameId === row.gameId)?.so)} · ER {format(pitches.find(item => item.gameId === row.gameId)?.er)}</small>}</Link>)}
    </div></section>{!section && <Link className="button button--secondary" to={`${base}/game-log?season=${selected}${scopeQuery}`}>試合別成績をもっと見る</Link>}</>}
    {section === "more" && <section className="surface-card"><h2>プロフィール</h2><dl className="profile-definition"><div><dt>守備位置</dt><dd>{historicalPositions(player.positions) || "未登録"}</dd></div><div><dt>投打</dt><dd>{({R:"右",L:"左",B:"両"} as Record<string,string>)[player.throws ?? ""] ?? player.throws ?? "—"}投 / {({R:"右",L:"左",B:"両"} as Record<string,string>)[player.bats ?? ""] ?? player.bats ?? "—"}打</dd></div><div><dt>収録年</dt><dd>{player.seasons.join(" / ")}</dd></div><div><dt>所属球団</dt><dd>{player.teamIds.map(id => teamName(manifest,id)).join(" / ")}</dd></div></dl><p className="inline-note">所属球団は収録期間中の情報です。現在の所属を示すものではありません。</p></section>}
    {section === "more" && <PlayerFutureLinks base={base} historical />}
    <p className="source-note inline-note"><Link to="/MLB/sources">データ提供元・クレジット</Link></p></div>;

}

function MlbHistoricalRecords({ manifest }: { manifest: Manifest }) {
  const competition = useHistoricalCompetition(), scopeQuery = competition === "postseason" ? "&competition=postseason" : "";
  const [rankingParams, setRankingParams] = useSearchParams();
  const season = Number(rankingParams.get("season") ?? manifest.seasons.at(-1)!.season);
  const [metricId, setMetricId] = useState("batting:HR");
  const [rankingRole,setRankingRole] = useState("batting");
  const [category, setCategory] = useState<"counting" | "rate">("counting");
  const [group, setGroup] = useState("AL");
  const result = useStatic<{ coverage: string; counting: string; rate: string;
    requiredPa?: number; requiredOuts?: number;
    records: { metric: string; role: string; classification?: string; group?: string;
      rows: { playerId: string; name: string; value: number; rank: number; sample?: number; qualification?: string }[] }[]
  }>(`records/${season}.json`);
  const records = result.value?.records.filter(record => category === "counting" ? record.classification !== "rate" : record.classification === "rate" && record.group === group).filter(record => record.role === rankingRole) ?? [];
  const selected = records.find(record => `${record.role}:${record.metric}` === metricId) ?? records[0];
  return <div className="screen"><header className="competition-header records-heading"><div><p className="eyebrow">MLB · 過去記録</p><h1>個人成績</h1></div>
    <label className="competition-season"><span className="sr-only">シーズン</span><select value={season} onChange={event => setRankingParams({season:event.target.value, ...(competition === "postseason" ? { competition } : {})})}>
      {manifest.seasons.map(item => <option key={item.season}>{item.season}</option>)}</select></label></header>
    {result.status !== "ready" ? <Status state={result} /> : <>
      {competition === "postseason" && <p className="inline-note">Postseason Leaders · 安打・本塁打などの集計。Regular Seasonの順位・規定到達とは別です。</p>}
      <div className="chip-list" role="group" aria-label="ランキングの種類">{(competition === "postseason" ? ["counting"] as const : ["counting", "rate"] as const).map(value =>
        <button className="filter-chip" type="button" key={value} aria-pressed={category === value}
          onClick={() => setCategory(value)}>{value === "counting" ? "本塁打・安打など" : "打率・防御率など"}</button>)}</div>
      <div className="segmented" role="group" aria-label="記録の種類"><button aria-pressed={rankingRole === "batting"} onClick={() => setRankingRole("batting")}>打撃</button><button aria-pressed={rankingRole === "pitching"} onClick={() => setRankingRole("pitching")}>投球</button></div>
      {category === "rate" && <label className="mlb-asof">リーグ<select value={group} onChange={event => setGroup(event.target.value)}>
        <option value="AL">アメリカン・リーグ</option><option value="NL">ナショナル・リーグ</option></select></label>}
      {result.value![category] !== "ready" ? <DataState kind="unsupported" title="シーズン集計を確認中です" /> : <>
      <div className="chip-list" role="group" aria-label="記録指標">{records.map(record =>
        <button className="filter-chip" type="button" key={`${record.role}:${record.metric}`}
          aria-pressed={selected === record}
          onClick={() => setMetricId(`${record.role}:${record.metric}`)}>{({HR:"本塁打",H:"安打",RBI:"打点",SB:"盗塁",SO:"奪三振",W:"勝利",SV:"セーブ",HLD:"ホールド",AVG:"打率",OBP:"出塁率",SLG:"長打率",ERA:"防御率",K9:"K/9"} as Record<string,string>)[record.metric] ?? record.metric}</button>)}</div>
      {selected && <div className="ranking-heading"><h2><MetricLabel metric={selected.metric} label={({HR:"本塁打",H:"安打",RBI:"打点",SB:"盗塁",SO:"奪三振",W:"勝利",SV:"セーブ",HLD:"ホールド",AVG:"打率",OBP:"出塁率",SLG:"長打率",ERA:"防御率",K9:"K/9"} as Record<string,string>)[selected.metric] ?? selected.metric} /></h2><span className="inline-note">{season}年{category === "rate" ? ` · ${group}` : ""}</span></div>}
      {category === "rate" && <details className="qualification-note"><summary>{rankingRole === "batting" ? `規定 ${result.value!.requiredPa ?? "—"} 打席` : `規定 ${result.value!.requiredOuts == null ? "—" : Math.floor(result.value!.requiredOuts / 3)} 回`} · 対象選手について</summary>
        <p>AVG・OBP・SLGには公式の不足PA例外を適用します。OPS・K/9は同じ最低サンプルを使う統計順位です。選手の元の成績は変更しません。</p></details>}
      <ol className="row-list leaderboard">{selected?.rows.map(row => <li key={row.playerId}>
        <Link to={`/MLB/players/${encodeURIComponent(row.playerId)}?season=${season}${scopeQuery}`}><strong className="rank-number">{row.rank}</strong><span className="rank-person"><strong>{row.name}</strong>
          {category === "rate" && <small>{selected.role === "batting" ? `${row.sample ?? "—"} 打席` : `${row.sample == null ? "—" : `${Math.floor(row.sample / 3)}.${row.sample % 3}`} 回`}
            {row.qualification === "qualified_by_exception" && " · 規定資格（例外適用）"}</small>}</span><strong className="rank-value">{category === "rate" ? row.value.toFixed(selected.metric === "ERA" || selected.metric === "K9" ? 2 : 3) : row.value}</strong></Link></li>)}</ol>
      </>}
    </>}
    <Link to="/MLB/sources">データ提供元</Link></div>;
}

function MlbHistoricalMy({ favorites, toggle, saving }: {
  favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean;
}) {
  const index = useHistoricalDirectory();
  const saved = favorites.filter(item => item.league === "MLB" && item.kind === "player");
  const byId = new Map(index.value?.players.map(player => [player.id, player]) ?? []);
  return <div className="screen"><PageHeading eyebrow="MLB / My" title="お気に入り選手" detail="この端末に保存しています" />
    <Link className="button" to="/NPB/my">NPBのお気に入りへ</Link>
    {index.status === "loading" ? <LoadingSkeleton /> : !saved.length ?
      <DataState kind="no-data" title="MLBのお気に入りはまだありません" action="選手を探す" to="/MLB/search" /> :
      <div className="row-list">{saved.map(item => <div className="mlb-player-row" key={item.entityId}>
        {byId.get(item.entityId) ? <Link to={`/MLB/players/${encodeURIComponent(item.entityId)}${byId.get(item.entityId)?.postseasonOnly ? "?competition=postseason" : ""}`}>
          <Monogram name={byId.get(item.entityId)!.name} /><span><strong>{byId.get(item.entityId)!.name}</strong><small>{historicalPositions(byId.get(item.entityId)!.positions)}</small></span></Link> :
          <span>選手情報を確認できません</span>}
        <FavoriteButton active saving={saving} label={byId.get(item.entityId)?.name ?? "登録済み選手"}
          onClick={() => toggle(item)} />
      </div>)}</div>}</div>;
}

type HistoricalRouteProps = {
  favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean;
};
export function MlbHistoricalRoutes(props: HistoricalRouteProps) {
  const location = useLocation();
  // Attribution belongs to the bundled app, not a successfully fetched manifest.
  const competition = historicalRouteCompetition(location.pathname, location.search);
  return location.pathname === "/MLB/sources" ? <MlbDataSources /> : <HistoricalCompetitionContext.Provider value={competition}>
    <MlbHistoricalDataRoutes key={`${competition}:${location.pathname.split("/")[2]}`} {...props} />
  </HistoricalCompetitionContext.Provider>;
}
function MlbHistoricalDataRoutes({ favorites, toggle, saving }: HistoricalRouteProps) {
  const location = useLocation();
  const result = useStatic<Manifest>("manifest.json");
  if (result.status !== "ready") return <div className="screen">
    <PageHeading eyebrow="MLB" title="過去の記録" />
    <Status state={result} missing="歴史データを準備中です" />
    <DataState kind="unsupported" title="2026年の試合結果・選手成績は未対応" />
  </div>;
  const manifest = result.value!;
  const competitionTabs = ["players", "search", "schedule", "records"].includes(location.pathname.split("/")[2] ?? "");
  return <>{competitionTabs && <CompetitionTabs />}<Routes>
    <Route path="postseason" element={<MlbPostseasonScreen />} />
    <Route path="postseason/series/:seriesId" element={<MlbPostseasonScreen />} />
    <Route path="explore" element={<ExploreScreen league="MLB" />} />
    {(["milestones", "moves", "talent", "preseason", "watch", "matchup"] as const).map(feature => <Route key={feature} path={`${feature}/*`} element={<FutureFeatureScreen feature={feature} league="MLB" />} />)}
    <Route path="home" element={<MlbHistoricalHome manifest={manifest} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="search" element={<MlbHistoricalSearch manifest={manifest} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="schedule" element={<MlbHistoricalSchedule manifest={manifest} />} />
    <Route path="games/:gameId" element={<MlbHistoricalGame manifest={manifest} />} />
    <Route path="players/:playerId/:section?" element={<MlbHistoricalPlayer key={location.pathname.split("/")[3]} manifest={manifest} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="my" element={<MlbHistoricalMy favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="analysis" element={<Navigate to="/MLB/search?focus=japan" replace />} />
    <Route path="records" element={<MlbHistoricalRecords manifest={manifest} />} />
    <Route path="ranking" element={<Navigate to="/MLB/records" replace />} />
    <Route path="sources" element={<MlbDataSources />} />
    <Route path="favorites" element={<Navigate to="/MLB/my" replace />} />
    <Route path="players" element={<Navigate to={historicalSearchPath(location.search)} replace />} />
    <Route path="*" element={<Navigate to="/MLB/home" replace />} />
  </Routes></>;
}
