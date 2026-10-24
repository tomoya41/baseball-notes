import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { Services } from "../app/services";
import type { Favorite } from "../domain/models";
import type { NpbCatalog } from "../domain/npb-product-contract";
import type { NpbSeasonPayload } from "../application/npb-season-payload";
import type { NpbHistoricalDataset, NpbHistoricalManifest } from "../domain/npb-historical";
import { readNpbExplorerSeason } from "../application/explorer-readers";
import { readNpbHistoricalManifest, readNpbHistoricalSeason } from "../application/npb-historical-reader";
import { normalizePlayerSearch } from "../domain/npb-player-directory";
import { positionDefinitions } from "../domain/baseball-terms";
import { currentTeamPlayers, historicalTeamPlayers, sortTeamPlayers, type TeamPlayerRole, type TeamPlayerSort } from "../presentation/team-player-list";
import { comparisonValue } from "../domain/product-comparison";
import { DataState, LoadingSkeleton } from "./components";
import { ClubIdentity } from "./club-identity";
import { HistoricalCredits } from "./npb-historical-credits";

export function NpbTeamPlayers({ services, favorites = [] }: { services: Services; favorites?: Favorite[] }) {
  const { teamId = "" } = useParams(), [params, setParams] = useSearchParams();
  const year = params.get("season") ?? "2026", role: TeamPlayerRole = params.get("role") === "pitching" ? "pitching" : params.get("role") === "batting" ? "batting" : "all";
  const requestedSort: TeamPlayerSort | null = ["number", "games", "innings", "name"].includes(params.get("sort") ?? "") ? params.get("sort") as TeamPlayerSort : null;
  const query = params.get("q") ?? "";
  const regularScope = (!params.has("competition") || params.get("competition") === "regular") && !params.has("stage");
  const [catalog, setCatalog] = useState<NpbCatalog | null>(null), [catalogError, setCatalogError] = useState(false);
  const [manifest, setManifest] = useState<NpbHistoricalManifest | null>(null), [manifestError, setManifestError] = useState(false);
  const [result, setResult] = useState<{ year: string; season: NpbSeasonPayload | null; history: NpbHistoricalDataset | null; failed: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; void services.product.catalog().then(c => { if (active) setCatalog(c); }).catch(() => { if (active) setCatalogError(true); }); return () => { active = false; }; }, [services]);
  useEffect(() => { let active = true; void readNpbHistoricalManifest().then(m => { if (active) setManifest(m); }).catch(() => { if (active) setManifestError(true); }); return () => { active = false; }; }, []);
  const supported = regularScope && (year === "2026" || !!manifest?.seasons.some(s => String(s.season) === year));
  const historicalManifest = year === "2026" ? null : manifest;
  useEffect(() => {
    if (!supported || !catalog) return;
    let active = true;
    void (year === "2026" ? readNpbExplorerSeason(2026).then(season => { currentTeamPlayers(catalog, season, teamId); return { year, season, history: null, failed: false }; }) :
      readNpbHistoricalSeason(Number(year), historicalManifest!).then(history => ({ year, season: null, history, failed: false })))
      .then(value => { if (active) setResult(value); }).catch(() => { if (active) setResult({ year, season: null, history: null, failed: true }); });
    return () => { active = false; };
  }, [year, supported, catalog, historicalManifest, teamId, attempt]);
  const update = (key: string, value: string) => setParams(previous => { const p = new URLSearchParams(previous); p.set(key, value);
    if (key === "role") { if (value === "all") p.delete("sort"); else p.set("sort", value === "pitching" ? "innings" : "games"); }
    if (key === "season") { if (value === "2026" && role === "all") p.delete("sort"); else p.set("sort", role === "pitching" ? "innings" : "games"); } return p; }, { replace: key === "q" });
  if (!catalog) return catalogError ? <DataState kind="source-unavailable" title="球団の選手情報を取得できません" /> : <LoadingSkeleton />;
  const team = catalog.teams.find(t => t.teamId === teamId);
  if (!team) return <DataState kind="no-data" title="球団が見つかりません" to="/NPB/teams" action="球団を探す" />;
  if (!regularScope) return <DataState kind="unsupported" title="この選手一覧は公式戦が対象です" to="/NPB/postseason" action="ポストシーズンへ" />;
  const visible = result?.year === year ? result : null;
  const source = year === "2026" ? currentTeamPlayers(catalog, visible?.season ?? null, teamId) : visible?.history ? historicalTeamPlayers(visible.history, teamId, Number(year)) : [];
  const showNumbers = year === "2026" && source.some(p => p.number !== null);
  const sort: TeamPlayerSort = requestedSort ?? (role === "pitching" ? "innings" : role === "batting" ? "games" : showNumbers ? "number" : "games");
  const players = sortTeamPlayers(source.filter(p => normalizePlayerSearch(p.name).includes(normalizePlayerSearch(query))), role, sort);
  return <div className="screen team-players"><Link className="back-link" to={`/NPB/teams/${encodeURIComponent(teamId)}`}>← 球団ページ</Link>
    <header className="compact-page-heading"><div><p className="eyebrow">NPB · {year}年 · 公式戦</p><h1><ClubIdentity teamId={teamId}>{team.shortName}の選手</ClubIdentity></h1></div></header>
    <div className="explorer-filter-grid"><label>年度<select aria-label="球団の選手を探す年度" value={year} onChange={e => update("season", e.target.value)}><option value="2026">2026年 · 保存済み</option>{manifest?.seasons.slice().reverse().map(s => <option key={s.season} value={s.season}>{s.season}年 · 一部収録</option>)}{!supported && <option value={year}>{year}年 · 未収録</option>}</select></label>
      <label>並び順<select value={sort} onChange={e => update("sort", e.target.value)}><option value="number" disabled={!showNumbers}>{showNumbers ? "背番号順" : "背番号 · 未収録"}</option><option value="games">{role === "pitching" ? "登板数が多い順" : "出場試合数が多い順"}</option><option value="innings">投球回が多い順</option><option value="name">名前順</option></select></label></div>
    <div className="segmented" role="group" aria-label="選手一覧の成績区分">{([['all','全選手'],['batting','打撃'],['pitching','投球']] as const).map(([value,label]) => <button key={value} aria-pressed={role === value} onClick={() => update("role", value)}>{label}</button>)}</div>
    <label className="roster-search"><span className="sr-only">選手名</span><input type="search" placeholder="この球団の選手を検索" value={query} onChange={e => update("q", e.target.value)} /></label>
    <p className="inline-note">{year === "2026" ? `${catalog.effectiveDate}時点 · 保存済みの所属` : `${year}年 · 球団別成績の一部収録`}</p>
    {manifestError && <p className="inline-note">過去年度の一覧は取得できません。</p>}
    {!supported ? !manifest && !manifestError ? <LoadingSkeleton /> : <DataState kind="unsupported" title="この年度は未収録です" /> : !visible ? <LoadingSkeleton /> : <>
      {visible.failed && <p role="status">年度成績を取得できません。{year === "2026" && "保存済みの所属・背番号だけ表示します。"}<button onClick={() => setAttempt(a => a + 1)}>再試行</button></p>}
      <div className="list-heading"><strong>{visible.failed && year !== "2026" ? "収録人数を確認できません" : `${players.length}人`}</strong><span>{visible.season && `${visible.season.period.to}まで · ${visible.season.coverage.status === "complete" ? "収録済み" : "一部未確認"}`}</span></div>
      <ul className="team-player-list">{players.map(p => <li key={p.id}><Link className="player-row" state={{teamPlayers:{teamId,year,role,sort,query}}} to={year === "2026" ? `/NPB/players/${p.id}` : `/NPB/players/${p.id}/seasons?season=${year}&role=${role === "pitching" || role === "all" && p.pitching && !p.batting ? "pitching" : "batting"}`}>
        {showNumbers && <span className="roster-number" aria-label={p.number === null ? "背番号未確認" : `背番号${p.number}`}>{p.number ?? "—"}</span>}
        <span className="player-row__body"><strong>{favorites.some(f => f.league === "NPB" && f.kind === "player" && f.entityId === p.id) && "★ "}{p.name}</strong><small>{p.position ? positionDefinitions[p.position as keyof typeof positionDefinitions] : ""}{p.partial && " · 一部未確認"}</small></span>
        <span className="roster-record">{role !== "pitching" && p.batting && <span>打 {p.battingGames ?? "—"}試合</span>}{role !== "batting" && p.pitching && <><span>投 {p.pitchingGames ?? "—"}試合</span><strong>{comparisonValue("outsRecorded", p.outs)}<small>回</small></strong></>}</span><span aria-hidden="true">›</span></Link>
      </li>)}</ul>{!players.length && !visible.failed && <DataState kind="no-data" title="この条件の選手データは未収録です" />}
      <details className="roster-source"><summary>出典・収録範囲</summary><p>{year === "2026" ? "年度成績は移籍前の球団分を含む収録分です。保存済みの所属は現在の登録公示を示しません。" : "全選手・登録名簿の完全収録ではありません。"}未確認値は「—」で末尾へ。過去年に現在の背番号を流用せず、公式ランキングとは扱いません。</p><Link to="/MLB/sources">保存済み成績の出典</Link>{players.filter(p=>p.numberDate||visible.history).map(p=><div key={p.id}><h3>{p.name}</h3>{p.numberDate&&<p>背番号は{p.numberDate}時点。<Link to={`/NPB/players/${p.id}/more`}>プロフィール・出典</Link></p>}{visible.history&&<HistoricalCredits data={visible.history} playerId={p.id} />}</div>)}</details>
    </>}
  </div>;
}
