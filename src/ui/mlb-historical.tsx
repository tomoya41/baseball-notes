import { useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from "react-router-dom";
import type { Favorite } from "../domain/models";
import { matchesMlbPlayerName } from "../domain/mlb-japanese-display";
import { battingAggregate, dateWindow, pitchingAggregate } from "../domain/mlb-historical-aggregate";
import type { DatedBatter, DatedPitcher } from "../domain/mlb-historical-aggregate";
import type { HistoricalGame, HistoricalPlayer } from "../data/mlb-historical";
import { RETROSHEET_ATTRIBUTION } from "../data/source-registry";
import { DataState, FavoriteButton, LoadingSkeleton, PageHeading } from "./components";
import { HistoricalAdvancedAnalysis } from "./mlb-historical-advanced";
import { useHistoricalStatic as useStatic } from "./use-mlb-historical";

const canonicalGameId = /^mlb:game:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const canonicalPlayerId = /^mlb:player:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Season = { season: number; firstDate: string; lastDate: string; games: number; coverage: string; playerCount: number };
type Manifest = { schemaVersion: 1; league: "MLB"; seasons: Season[];
  teams: { id: string; name: string }[]; current2026: "unavailable";
  features?: { directBvp?: string; situationalAnalysis?: string } };
type IndexPlayer = Pick<HistoricalPlayer, "id" | "name" | "positions" | "seasons" | "teamIds">;
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

function Status({ state, missing = "データがありません" }: { state: ReturnType<typeof useStatic<unknown>>; missing?: string }) {
  return state.status === "loading" ? <LoadingSkeleton /> :
    <DataState kind={state.status === "error" ? "source-unavailable" : "no-data"}
      title={state.status === "error" ? "データを読み込めません" : missing} />;
}
const format = (value: number | null | undefined) => value === null || value === undefined ? "—" : String(value);
const teamName = (manifest: Manifest, id: string) => manifest.teams.find(team => team.id === id)?.name ?? "球団不明";
const day = (value: string, offset: number) => {
  const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

export function MlbDataSources() {
  return <div className="screen"><PageHeading eyebrow="MLB" title="データ提供元" />
    <section className="surface-card"><h2>Retrosheet</h2>
      <p>{RETROSHEET_ATTRIBUTION}</p>
      <p><a href="https://www.retrosheet.org/notice.txt">利用告知</a> · <a href="https://www.retrosheet.org/downloads/csvdownloads.html">配布データ</a></p>
    </section>
    <section className="surface-card"><h2>Chadwick Register</h2>
      <p>Contains information from <a href="https://github.com/chadwickbureau/register">Chadwick Register</a> which is made available under the <a href="https://opendatacommons.org/licenses/by/1-0/">ODC Attribution License 1.0</a>.</p>
      <p>選手IDの照合に使用しています。</p>
    </section>
    <section className="surface-card"><h2>日本語の選手名</h2>
      <p>日本語表示名の確認に<a href="https://www.wikidata.org/">Wikidata</a>の構造化データ（<a href="https://www.wikidata.org/wiki/Wikidata:Licensing">CC0</a>）を利用しています。</p>
      <p>日本人選手は漢字、その他の選手は確認できるカタカナ表記を表示します。表記未確認の選手は原名を表示します。</p>
    </section></div>;
}
export function MlbHistoricalHome({ manifest }: { manifest: Manifest }) {
  const latest = manifest.seasons.at(-1);
  return <div className="screen"><PageHeading eyebrow="MLB" title="過去の試合と選手" detail="Retrosheet収録の2020〜2025年公式戦" />
    <div className="row-list">
      <Link className="ranking-entry" to={`/MLB/schedule?season=${latest?.season ?? 2025}&date=${latest?.lastDate ?? "2025-09-28"}`}>日程・結果を見る</Link>
      <Link className="ranking-entry" to="/MLB/search">選手を探す</Link>
      <Link className="ranking-entry" to="/MLB/my">お気に入り選手</Link>
    </div>
    <DataState kind="unsupported" title="2026年の試合結果・選手成績は未対応" detail="表示中のデータは2020〜2025年の過去記録です。" />
    <Link to="/MLB/sources">データ提供元と利用条件</Link></div>;
}
export function MlbHistoricalSearch({ manifest, favorites, toggle, saving }: {
  manifest: Manifest; favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean;
}) {
  const result = useStatic<{ players: IndexPlayer[] }>("players/index.json");
  const [query, setQuery] = useState("");
  const [season, setSeason] = useState(2025);
  const rows = useMemo(() => (result.value?.players ?? []).filter(player => player.seasons.includes(season) &&
    matchesMlbPlayerName(player.id, player.name, query)).slice(0, 100), [result.value, season, query]);
  return <div className="screen"><PageHeading eyebrow="MLB / 過去記録" title="選手を探す" />
    <div className="mlb-controls"><label>シーズン<select value={season} onChange={event => setSeason(Number(event.target.value))}>
      {manifest.seasons.map(item => <option key={item.season} value={item.season}>{item.season}</option>)}
    </select></label><label>選手名<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="名前で検索" /></label></div>
    {result.status !== "ready" ? <Status state={result} /> : rows.length ? <div className="row-list">
      {rows.map(player => <div className="mlb-player-row" key={player.id}>
        <Link to={`/MLB/players/${encodeURIComponent(player.id)}`}><strong>{player.name}</strong>
          <small>{player.positions.join(" / ") || "守備位置不明"} · {player.seasons.join(", ")}</small></Link>
        <FavoriteButton active={favorites.some(item => item.league === "MLB" && item.entityId === player.id)}
          saving={saving} label={player.name} onClick={() => toggle({ league: "MLB", kind: "player", entityId: player.id })} />
      </div>)}</div> : <DataState kind="no-data" title="一致する選手がいません" />}
    {rows.length === 100 && <p className="inline-note">先頭100件を表示しています。名前で絞り込めます。</p>}</div>;
}
export function MlbHistoricalSchedule({ manifest }: { manifest: Manifest }) {
  const [params, setParams] = useSearchParams();
  const season = Number(params.get("season") ?? 2025);
  const supportedSeason = manifest.seasons.some(item => item.season === season);
  const selected = manifest.seasons.find(item => item.season === season) ?? manifest.seasons.at(-1)!;
  const date = params.get("date") ?? selected.lastDate;
  const validDate = supportedSeason && /^\d{4}-\d{2}-\d{2}$/.test(date) && date.startsWith(`${selected.season}-`);
  const result = useStatic<Schedule>(validDate ? `schedule/${selected.season}/${date}.json` : null);
  const navigate = (next: string) => setParams({ season: String(next.slice(0, 4)), date: next });
  if (!supportedSeason) return <div className="screen"><PageHeading eyebrow="MLB" title="日程・結果" />
    <DataState kind="unsupported" title={season === 2026 ? "2026年の試合結果・選手成績は未対応" : "このシーズンは未収録です"}
      action="過去の記録を見る" to="/MLB/schedule?season=2025" /></div>;
  return <div className="screen"><PageHeading eyebrow="MLB / 過去記録" title="日程・結果" detail="収録済み公式戦の最終結果" />
    <div className="mlb-controls"><label>シーズン<select value={selected.season}
      onChange={event => { const next = manifest.seasons.find(item => item.season === Number(event.target.value))!;
        setParams({ season: String(next.season), date: next.lastDate }); }}>
      {manifest.seasons.map(item => <option key={item.season}>{item.season}</option>)}
    </select></label><label>日付<input type="date" min={selected.firstDate} max={selected.lastDate}
      value={date} onChange={event => navigate(event.target.value)} /></label></div>
    <nav className="mlb-date-nav" aria-label="日付移動">
      <button type="button" disabled={date <= selected.firstDate} onClick={() => navigate(day(date, -1))}>前日</button>
      <strong>{date}</strong><button type="button" disabled={date >= selected.lastDate} onClick={() => navigate(day(date, 1))}>翌日</button>
    </nav>
    {!validDate ? <DataState kind="no-data" title="対象期間外の日付です" /> : result.status === "missing" ?
      <DataState kind="no-data" title="この日に収録された公式戦はありません" detail="現在シーズンの試合有無を示すものではありません。" /> :
      result.status !== "ready" ? <Status state={result} /> : <div className="row-list">
        {result.value!.games.map(game => <Link className="mlb-game-row" key={game.id} to={`/MLB/games/${encodeURIComponent(game.id)}`}>
          <span><small>アウェー</small>{teamName(manifest, game.awayTeamId)}</span>
          <strong aria-label={`${game.awayRuns}対${game.homeRuns}${game.number > 0 ? `、第${game.number}試合` : ""}`}>{game.awayRuns} – {game.homeRuns}{game.number > 0 && <small>第{game.number}試合</small>}</strong>
          <span><small>ホーム</small>{teamName(manifest, game.homeTeamId)}</span>
        </Link>)}</div>}
    <p className="inline-note">出典: Retrosheet · <Link to="/MLB/sources">データ提供元</Link></p>
  </div>;
}
export function MlbHistoricalGame({ manifest }: { manifest: Manifest }) {
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
      <div className="mlb-stat-scroll"><table><thead><tr><th>打順</th><th>選手</th><th>PA</th><th>AB</th><th>H</th><th>HR</th><th>RBI</th></tr></thead>
        <tbody>{batting.map(row => <tr key={row.playerId}><td>{format(row.battingOrder)}</td>
          <th scope="row"><Link to={`/MLB/players/${encodeURIComponent(row.playerId)}`}>{row.name ?? "選手"}</Link>
            {row.starter === false && <small>途中出場</small>}</th>
          <td>{format(row.pa)}</td><td>{format(row.ab)}</td><td>{format(row.hits)}</td>
          <td>{format(row.homeRuns)}</td><td>{format(row.rbi)}</td></tr>)}</tbody></table></div>
      <details><summary>打撃の詳細項目</summary><div className="mlb-stat-scroll"><table>
        <thead><tr><th>選手</th><th>R</th><th>2B</th><th>3B</th><th>BB</th><th>HBP</th><th>SH</th><th>SF</th><th>SO</th><th>SB</th><th>CS</th></tr></thead>
        <tbody>{batting.map(row => <tr key={row.playerId}><th scope="row">{row.name}</th>
          {[row.runs, row.doubles, row.triples, row.bb, row.hbp, row.sh, row.sf, row.so, row.sb, row.cs]
            .map((item, index) => <td key={index}>{format(item)}</td>)}</tr>)}</tbody></table></div></details>
      <h3>投球</h3><div className="mlb-stat-scroll"><table><thead><tr>
        <th>役割</th><th>選手</th><th>IP</th><th>BF</th><th>H</th><th>HR</th><th>SO</th><th>R</th><th>ER</th></tr></thead>
        <tbody>{pitching.map(row => <tr key={row.playerId}><td>{row.role === "starter" ? "先発" : row.role === "reliever" ? "救援" : "不明"}</td>
          <th scope="row"><Link to={`/MLB/players/${encodeURIComponent(row.playerId)}`}>{row.name ?? "選手"}</Link></th>
          <td>{row.outsRecorded === null ? "—" : `${Math.floor(row.outsRecorded / 3)}.${row.outsRecorded % 3}`}</td>
          {[row.bf, row.hits, row.homeRuns, row.so, row.runs, row.er].map((item, index) => <td key={index}>{format(item)}</td>)}</tr>)}</tbody></table></div>
      <details><summary>投球の詳細項目</summary><div className="mlb-stat-scroll"><table>
        <thead><tr><th>選手</th><th>BB</th><th>HBP</th><th>W</th><th>L</th><th>SV</th><th>HLD</th><th>球数</th></tr></thead>
        <tbody>{pitching.map(row => <tr key={row.playerId}><th scope="row">{row.name}</th>
          {[row.bb, row.hbp, row.win === null ? null : Number(row.win), row.loss === null ? null : Number(row.loss),
            row.save === null ? null : Number(row.save), row.hold, row.pitchCount]
            .map((item, index) => <td key={index}>{format(item)}</td>)}</tr>)}</tbody></table></div></details>
    </section>;
  };
  return <div className="screen"><PageHeading eyebrow="MLB / 過去記録" title={`${game.date} 試合結果`} />
    <div className="mlb-score" aria-label={`${teamName(manifest, game.awayTeamId)} ${game.awayRuns}、${teamName(manifest, game.homeTeamId)} ${game.homeRuns}`}>
      <p>アウェー {teamName(manifest, game.awayTeamId)} <strong>{game.awayRuns}</strong></p>
      <p>ホーム {teamName(manifest, game.homeTeamId)} <strong>{game.homeRuns}</strong></p>
      <small>終了 · {game.innings === null ? "回数不明" : `${game.innings}回`}</small></div>
    {renderTeam(game.awayTeamId, "アウェー")}{renderTeam(game.homeTeamId, "ホーム")}
    <Link to={`/MLB/schedule?season=${game.season}&date=${game.date}`}>日程・結果へ戻る</Link></div>;
}

const metric = (metrics: Record<string, { value: number | null }> | null | undefined, key: string,
  digits = 0) => metrics?.[key]?.value === null || metrics?.[key]?.value === undefined ? "—" :
    Number(metrics[key]!.value).toFixed(digits);
function MetricDetails({ title, metrics, pitching = false }: {
  title: string; metrics: Record<string, { value: number | null }> | null | undefined; pitching?: boolean;
}) {
  if (!metrics) return null;
  const keys = pitching ? ["appearances", "GS", "outsRecorded", "BF", "H", "HR", "BB", "SO", "R", "ER", "W", "L", "SV", "ERA", "K9"] :
    ["G", "PA", "AB", "R", "H", "2B", "3B", "HR", "RBI", "BB", "HBP", "SH", "SF", "SO", "SB", "CS", "AVG", "OBP", "SLG", "OPS"];
  return <details className="mlb-metric-details"><summary>{title}</summary><dl>{keys.map(key =>
    <div key={key} style={{ display: "contents" }}><dt>{key === "appearances" ? "登板" : key === "outsRecorded" ? "IP" : key}</dt>
      <dd>{key === "outsRecorded" ? metrics[key]?.value == null ? "—" : `${Math.floor(metrics[key]!.value! / 3)}.${metrics[key]!.value! % 3}` :
        metric(metrics, key, ["AVG", "OBP", "SLG", "OPS"].includes(key) ? 3 : ["ERA", "K9"].includes(key) ? 2 : 0)}</dd></div>)}</dl>
    <p className="inline-note">AVG: 打率。OBP: 出塁率。SLG: 長打率。OPS: 出塁率と長打率の合計。ERA: 9回あたりの自責点。K9: 9回あたりの奪三振。少ない打席・投球回では値が大きく変動します。</p></details>;
}
export function MlbHistoricalPlayer({ manifest, favorites, toggle, saving }: {
  manifest: Manifest; favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean;
}) {
  const { playerId } = useParams();
  const result = useStatic<Profile>(playerId && canonicalPlayerId.test(playerId) ? `players/${playerId.replaceAll(":", "_")}.json` : null);
  const [season, setSeason] = useState<number | null>(null);
  const [period, setPeriod] = useState<7 | 14 | 30>(30);
  const [split, setSplit] = useState<"total" | "home" | "away" | "opponent" | "order" | "batter-starter" | "batter-substitute" | "pitcher-starter" | "pitcher-reliever">("total");
  const [opponent, setOpponent] = useState("");
  const [battingOrder, setBattingOrder] = useState(1);
  const [asOf, setAsOf] = useState<string | null>(null);
  if (!playerId || !canonicalPlayerId.test(playerId)) return <div className="screen"><PageHeading eyebrow="MLB / 過去記録" title="選手" />
    <DataState kind="no-data" title="選手が見つかりません" /></div>;
  if (result.status !== "ready") return <div className="screen"><PageHeading eyebrow="MLB / 過去記録" title="選手" />
    <Status state={result} missing="選手が見つかりません" /></div>;
  const profile = result.value!;
  const player = profile.player;
  const selected = season && player.seasons.includes(season) ? season : player.seasons.at(-1)!;
  const games = profile.batting.filter(row => row.season === selected);
  const pitches = profile.pitching.filter(row => row.season === selected);
  const opponents = [...new Set([...games, ...pitches].map(row => row.opponentTeamId))].sort();
  const orders = [...new Set(games.map(row => row.battingOrder).filter((value): value is number => value !== null))].sort((a, b) => a - b);
  const activeOpponent = opponents.includes(opponent) ? opponent : opponents[0];
  const activeOrder = orders.includes(battingOrder) ? battingOrder : orders[0];
  const filteredBatting = games.filter(row => split === "total" || split === "home" && row.home ||
    split === "away" && !row.home || split === "opponent" && row.opponentTeamId === activeOpponent ||
    split === "order" && row.battingOrder === activeOrder ||
    split === "batter-starter" && row.starter === true ||
    split === "batter-substitute" && row.starter === false);
  const filteredPitching = pitches.filter(row => split === "total" || split === "home" && row.home ||
    split === "away" && !row.home || split === "opponent" && row.opponentTeamId === activeOpponent ||
    split === "pitcher-starter" && row.role === "starter" ||
    split === "pitcher-reliever" && row.role === "reliever");
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
  return <div className="screen"><PageHeading eyebrow="MLB / 過去記録" title={player.name}
    detail={`${player.positions.join(" / ") || "守備位置不明"} · ${player.seasons.join(", ")} · ${player.teamIds.map(id => teamName(manifest, id)).join(" / ")}`} />
    <p className="inline-note">打席: {player.bats ?? "不明"} · 投球: {player.throws ?? "不明"}</p>
    <FavoriteButton active={favorites.some(item => item.league === "MLB" && item.entityId === player.id)}
      saving={saving} label={player.name} onClick={() => toggle({ league: "MLB", kind: "player", entityId: player.id })} />
    <div className="mlb-controls"><label>シーズン<select value={selected} onChange={event => setSeason(Number(event.target.value))}>
      {player.seasons.map(item => <option key={item}>{item}</option>)}
    </select></label></div>
    <section className="surface-card"><h2>{selected}年 · 保存済みシーズン成績</h2>
      {seasonTotals?.batting && <p>打撃: {metric(seasonTotals.batting, "G")}試合 · {metric(seasonTotals.batting, "PA")} PA · {metric(seasonTotals.batting, "H")}安打 · {metric(seasonTotals.batting, "HR")}本塁打 · OPS {metric(seasonTotals.batting, "OPS", 3)}</p>}
      {seasonTotals?.pitching && <p>投球: {metric(seasonTotals.pitching, "appearances")}登板 · {metric(seasonTotals.pitching, "GS")}先発 · {metric(seasonTotals.pitching, "SO")}奪三振 · ERA {metric(seasonTotals.pitching, "ERA", 2)}</p>}
      <MetricDetails title="シーズン打撃成績の詳細" metrics={seasonTotals?.batting} />
      <MetricDetails title="シーズン投球成績の詳細" metrics={seasonTotals?.pitching} pitching />
    </section>
    <section className="surface-card"><h2>収録期間合計</h2><p>{profile.collectedRange}。MLB通算を意味しません。</p>
      {profile.collectedRangeTotals.batting && <p>打撃: {metric(profile.collectedRangeTotals.batting, "G")}試合 · {metric(profile.collectedRangeTotals.batting, "H")}安打 · {metric(profile.collectedRangeTotals.batting, "HR")}本塁打</p>}
      {profile.collectedRangeTotals.pitching && <p>投球: {metric(profile.collectedRangeTotals.pitching, "appearances")}登板 · {metric(profile.collectedRangeTotals.pitching, "SO")}奪三振</p>}
      <MetricDetails title="収録期間の打撃詳細" metrics={profile.collectedRangeTotals.batting} />
      <MetricDetails title="収録期間の投球詳細" metrics={profile.collectedRangeTotals.pitching} pitching />
    </section>
    <section className="surface-card"><h2>最近の成績</h2>
      <label className="mlb-asof">基準日<input type="date" min={firstDate} max={lastDate}
        value={selectedAsOf} onChange={event => setAsOf(event.target.value)} /></label>
      <div className="chip-list" role="group" aria-label="期間">{([7, 14, 30] as const).map(value =>
        <button className="filter-chip" key={value} type="button" aria-pressed={period === value}
          onClick={() => setPeriod(value)}>{value}日</button>)}</div>
      <div className="chip-list" role="group" aria-label="条件">{splitOptions.map(value =>
        <button className="filter-chip" key={value} type="button" aria-pressed={split === value}
          onClick={() => setSplit(value)}>{({ total: "全体", home: "ホーム", away: "アウェー", opponent: "対戦相手", order: "打順", "batter-starter": "打者・先発", "batter-substitute": "打者・途中出場", "pitcher-starter": "投手・先発", "pitcher-reliever": "投手・救援" })[value]}</button>)}</div>
      {split === "opponent" && <label className="mlb-asof">対戦相手<select value={activeOpponent}
        onChange={event => setOpponent(event.target.value)}>{opponents.map(team =>
          <option key={team} value={team}>{teamName(manifest, team)}</option>)}</select></label>}
      {split === "order" && <label className="mlb-asof">打順<select value={activeOrder}
        onChange={event => setBattingOrder(Number(event.target.value))}>{orders.map(order =>
          <option key={order} value={order}>{order}番</option>)}</select></label>}
      <p>打撃: {metric(batting.metrics, "G")}試合 · {metric(batting.metrics, "PA")} PA · OPS {metric(batting.metrics, "OPS", 3)}</p>
      <p>投球: {metric(pitching.metrics, "appearances")}登板 · {metric(pitching.metrics, "SO")}奪三振 · ERA {metric(pitching.metrics, "ERA", 2)}</p>
      <MetricDetails title="期間・条件別の打撃詳細" metrics={batting.metrics} />
      <MetricDetails title="期間・条件別の投球詳細" metrics={pitching.metrics} pitching />
      <p className="inline-note">選択基準日までの期間。出場記録がない条件は—です。</p>
    </section>
    {(manifest.features?.directBvp === "available" || manifest.features?.situationalAnalysis === "available") &&
      <HistoricalAdvancedAnalysis playerId={player.id} season={selected}
        hasBatting={games.some(row => (row.pa ?? 0) > 0) || (games.length > 0 && pitches.length === 0)}
        hasPitching={pitches.length > 0} />}
    <section className="surface-card"><h2>試合別成績</h2><div className="row-list">
      {log.map(row => <Link className="ranking-entry" key={row.gameId} to={`/MLB/games/${encodeURIComponent(row.gameId)}`}>
        {row.date} · {row.home ? "ホーム" : "アウェー"} · 対 {teamName(manifest, row.opponentTeamId)}
        {games.find(item => item.gameId === row.gameId) && <small>打撃: PA {format(games.find(item => item.gameId === row.gameId)?.pa)} · H {format(games.find(item => item.gameId === row.gameId)?.hits)} · HR {format(games.find(item => item.gameId === row.gameId)?.homeRuns)}</small>}
        {pitches.find(item => item.gameId === row.gameId) && <small>投球: {format(pitches.find(item => item.gameId === row.gameId)?.outsRecorded)}アウト · SO {format(pitches.find(item => item.gameId === row.gameId)?.so)} · ER {format(pitches.find(item => item.gameId === row.gameId)?.er)}</small>}</Link>)}
    </div></section><Link to="/MLB/sources">データ提供元</Link></div>;
}

function MlbHistoricalRecords({ manifest }: { manifest: Manifest }) {
  const [season, setSeason] = useState(2025);
  const [metricId, setMetricId] = useState("batting:HR");
  const [category, setCategory] = useState<"counting" | "rate">("counting");
  const [group, setGroup] = useState("AL");
  const result = useStatic<{ coverage: string; counting: string; rate: string;
    requiredPa?: number; requiredOuts?: number;
    records: { metric: string; role: string; classification?: string; group?: string;
      rows: { playerId: string; name: string; value: number; rank: number; sample?: number; qualification?: string }[] }[]
  }>(`records/${season}.json`);
  const records = result.value?.records.filter(record => category === "counting" ? record.classification !== "rate" : record.classification === "rate" && record.group === group) ?? [];
  const selected = records.find(record => `${record.role}:${record.metric}` === metricId) ?? records[0];
  return <div className="screen"><PageHeading eyebrow="MLB / 過去記録" title="シーズン記録" detail="収録済み公式戦の集計順位" />
    <div className="mlb-controls"><label>シーズン<select value={season} onChange={event => setSeason(Number(event.target.value))}>
      {manifest.seasons.map(item => <option key={item.season}>{item.season}</option>)}</select></label></div>
    {result.status !== "ready" ? <Status state={result} /> : <>
      <div className="chip-list" role="group" aria-label="ランキングの種類">{(["counting", "rate"] as const).map(value =>
        <button className="filter-chip" type="button" key={value} aria-pressed={category === value}
          onClick={() => setCategory(value)}>{value === "counting" ? "件数指標" : "率指標"}</button>)}</div>
      {category === "rate" && <label className="mlb-asof">リーグ<select value={group} onChange={event => setGroup(event.target.value)}>
        <option value="AL">アメリカン・リーグ</option><option value="NL">ナショナル・リーグ</option></select></label>}
      {category === "rate" && result.value!.rate !== "ready" ? <DataState kind="unsupported" title="率指標の集計を確認中です" /> : <>
      {category === "rate" && <p className="inline-note">規定{result.value!.requiredPa} PA / {Math.floor((result.value!.requiredOuts ?? 0) / 3)} IP到達者が対象。AVG・OBP・SLGには公式の不足PA例外を適用します。OPS・K9は同じ最低サンプルを使う統計順位です。</p>}
      {category === "rate" && <details><summary>率指標の見方</summary><p className="inline-note">AVGは打数に対する安打の割合、OBPは安打・四球・死球による出塁の割合、SLGは1打数あたりの塁打数です。OPSはOBPとSLGの合計で、出塁と長打を合わせて見る指標です。ERAは9回あたりの自責点、K9は9回あたりの奪三振数。値が高いほど、その指標の出来事が多いことを表します。率だけでなく打席数・投球回と合わせて確認できます。</p></details>}
      <div className="chip-list" role="group" aria-label="記録指標">{records.map(record =>
        <button className="filter-chip" type="button" key={`${record.role}:${record.metric}`}
          aria-pressed={selected === record}
          onClick={() => setMetricId(`${record.role}:${record.metric}`)}>{record.role === "batting" ? "打撃" : "投球"} {record.metric}</button>)}</div>
      <ol className="row-list">{selected?.rows.map(row => <li key={row.playerId}>
        <Link className="ranking-entry" to={`/MLB/players/${encodeURIComponent(row.playerId)}`}>
          {row.rank}位 · {row.name} · {category === "rate" ? row.value.toFixed(selected.metric === "ERA" || selected.metric === "K9" ? 2 : 3) : row.value}
          {category === "rate" && <small>{selected.role === "batting" ? `${row.sample} PA` : `${row.sample} アウト`}
            {row.qualification === "qualified_by_exception" && " · 不足PA例外で規定資格を満たす"}</small>}</Link></li>)}</ol>
      </>}
    </>}
    <Link to="/MLB/sources">データ提供元</Link></div>;
}

function MlbHistoricalMy({ favorites, toggle, saving }: {
  favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean;
}) {
  const index = useStatic<{ players: IndexPlayer[] }>("players/index.json");
  const saved = favorites.filter(item => item.league === "MLB" && item.kind === "player");
  const byId = new Map(index.value?.players.map(player => [player.id, player]) ?? []);
  return <div className="screen"><PageHeading eyebrow="MLB / My" title="お気に入り選手" detail="この端末に保存しています" />
    <Link className="button" to="/NPB/my">NPBのお気に入りへ</Link>
    {index.status === "loading" ? <LoadingSkeleton /> : !saved.length ?
      <DataState kind="no-data" title="MLBのお気に入りはまだありません" action="選手を探す" to="/MLB/search" /> :
      <div className="row-list">{saved.map(item => <div className="mlb-player-row" key={item.entityId}>
        {byId.get(item.entityId) ? <Link to={`/MLB/players/${encodeURIComponent(item.entityId)}`}>
          <strong>{byId.get(item.entityId)!.name}</strong><small>{byId.get(item.entityId)!.positions.join(" / ")}</small></Link> :
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
  return location.pathname === "/MLB/sources" ? <MlbDataSources /> : <MlbHistoricalDataRoutes {...props} />;
}
function MlbHistoricalDataRoutes({ favorites, toggle, saving }: HistoricalRouteProps) {
  const result = useStatic<Manifest>("manifest.json");
  if (result.status !== "ready") return <div className="screen">
    <PageHeading eyebrow="MLB" title="過去の記録" />
    <Status state={result} missing="歴史データを準備中です" />
    <DataState kind="unsupported" title="2026年の試合結果・選手成績は未対応" />
  </div>;
  const manifest = result.value!;
  return <Routes>
    <Route path="home" element={<MlbHistoricalHome manifest={manifest} />} />
    <Route path="search" element={<MlbHistoricalSearch manifest={manifest} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="schedule" element={<MlbHistoricalSchedule manifest={manifest} />} />
    <Route path="games/:gameId" element={<MlbHistoricalGame manifest={manifest} />} />
    <Route path="players/:playerId/:section?" element={<MlbHistoricalPlayer manifest={manifest} favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="my" element={<MlbHistoricalMy favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="analysis" element={<div className="screen"><PageHeading eyebrow="MLB" title="選手の分析" />
      <DataState kind="no-data" title="選手ページから過去シーズンの分析を開けます" action="選手を探す" to="/MLB/search" /></div>} />
    <Route path="records" element={<MlbHistoricalRecords manifest={manifest} />} />
    <Route path="ranking" element={<Navigate to="/MLB/records" replace />} />
    <Route path="sources" element={<MlbDataSources />} />
    <Route path="favorites" element={<Navigate to="/MLB/my" replace />} />
    <Route path="players" element={<Navigate to="/MLB/search" replace />} />
    <Route path="*" element={<Navigate to="/MLB/home" replace />} />
  </Routes>;
}

