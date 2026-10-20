import { useEffect, useState } from "react";
import { z } from "zod";
import { Link, useSearchParams } from "react-router-dom";
import type { Services } from "../app/services";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";
import { normalizePlayerSearch } from "../domain/npb-player-directory";
import type { GameDateIndex, GameManifest } from "../domain/npb-game-index";
import type { PostseasonHub } from "../domain/competition";
import { DataState, LoadingSkeleton, PageHeading } from "./components";
import { ExplorerLinks, type ExplorerManifest } from "./data-explorer";
import { useHistoricalStatic } from "./use-mlb-historical";
import { useHistoricalCompetition } from "./historical-competition-context";
import { LibraryShortcuts } from "./personal-library";
import { readNpbSeries } from "../application/npb-series-reader";
import { readNpbCs } from "../application/npb-cs-reader";
import { readNpbJapanSeries } from "../application/npb-japan-series-reader";
import type { NpbJapanSeries } from "../domain/npb-japan-series";
import type { NpbPostseasonSeries } from "../domain/npb-postseason-series";
import type { NpbCsDataset } from "../domain/npb-cs-observations";
import { npbTeamShortName } from "./npb-team-names";

export function DiscoveryNavigation({ league }: { league: "NPB" | "MLB" }) {
  const [params] = useSearchParams(), active = params.get("kind") ?? "player";
  return <><nav className="explorer-links" aria-label="検索対象">{[{ key: "player", label: "選手" }, { key: "team", label: "球団" }, { key: "game", label: "試合" }, { key: "series", label: "シリーズ" }].map(item => {
    const next = new URLSearchParams(params); next.set("kind", item.key);
    if (item.key === "series" || league === "NPB" && active === "series" && item.key === "game") next.set("competition", "postseason");
    else if (league === "NPB" && ["player", "team"].includes(item.key)) { next.delete("competition"); next.delete("stage"); }
    return <Link key={item.key} aria-current={active === item.key ? "page" : undefined} to={`/${league}/search?${next}`}>{item.label}</Link>;
  })}</nav><details className="discovery-tools"><summary>条件で探す・保存したものから探す</summary><ExplorerLinks league={league} scope={`?${params}`} /><Link className="text-link" to={`/${league}/my`}>お気に入りから探す →</Link><LibraryShortcuts league={league} /><Link className="text-link" to={`/${league}/team-compare${params.get("season") ? `?season=${params.get("season")}${params.get("competition") === "postseason" ? "&competition=postseason" : ""}` : ""}`}>球団比較 →</Link></details></>;
}
function DiscoveryList({ league, teams, scope, games, series, message }: { league: "NPB" | "MLB"; teams: { id: string; name: string }[]; scope: string;
  games?: { id: string; home: string; away: string; homeScore: number | null; awayScore: number | null; state: string; stage?:string }[] | undefined; series?: PostseasonHub["series"] | undefined; message?: string }) {
  const [params, setParams] = useSearchParams(), kind = params.get("kind"), query = params.get("q") ?? "";
  const matches = (value: string) => normalizePlayerSearch(value).includes(normalizePlayerSearch(query));
  const rows = kind === "team" ? teams.filter(t => matches(t.name)).map(t => ({ id: t.id, name: t.name, to: `/${league}/teams/${encodeURIComponent(t.id)}${scope}` })) : kind === "series" ? (series ?? []).filter(s => matches(`${s.name} ${s.teams.map(t => teams.find(row => row.id === t.teamId)?.name ?? "").join(" ")}`)).map(s => ({ id: s.id, name: `${s.name} · ${s.teams.map(t => `${teams.find(row => row.id === t.teamId)?.name ?? "球団"}${s.games.some(g=>g.status==="final")?` ${t.seriesTotal}勝`:""}`).join(" / ")}${s.games.some(g=>g.status==="final")?"":" · 勝敗未収録"}`, to: `/${league}/postseason/series/${encodeURIComponent(s.id)}${scope}` })) : (games ?? []).filter(g => matches(`${g.home} ${g.away} ${g.state}`)).map(g => ({ id: g.id, name: `${g.away} ${g.awayScore ?? "—"}–${g.homeScore ?? "—"} ${g.home} · ${g.state}`, to: `/${league}/games/${encodeURIComponent(g.id)}${scope}${g.stage?`&stage=${g.stage}`:""}` }));
  return <><label className="search-field"><span className="sr-only">球団・試合・Seriesの検索</span><input type="search" value={query} placeholder="球団名・Series名で絞り込み" onChange={e => setParams(previous => { const next = new URLSearchParams(previous); next.set("q", e.target.value); return next; }, { replace: true })} /></label>{message && <p className="inline-note">{message}</p>}<div className="list-heading"><strong>{rows.length}件</strong></div>{!rows.length && <DataState kind="no-data" title="この範囲で一致する保存済みデータがありません" />}<div className="row-list">{rows.slice(0, 60).map(row => <Link className="player-row" key={row.id} to={row.to}><strong>{row.name}</strong><span>→</span></Link>)}</div></>;
}
export function NpbDiscovery({ services }: { services: Services }) {
  const [params, setParams] = useSearchParams(), kind = params.get("kind");
  const supported = kind !== "series" && params.get("competition") !== "postseason";
  const [directory, setDirectory] = useState<NpbPlayerDirectory | null>(null), [manifest, setManifest] = useState<GameManifest | null>(null), [failedKind, setFailedKind] = useState<string | null>(null);
  const [dates, setDates] = useState<{ date: string; value: GameDateIndex | null; error: boolean } | null>(null);
  const date = params.get("date") ?? manifest?.effectiveDate ?? "";
  const validDate = !!manifest && date >= manifest.from && date <= manifest.to && z.iso.date().safeParse(date).success;
  useEffect(() => {
    if (!supported) return;
    let active = true;
    if (kind === "team") void services.directory.findLatestNpb().then(value => { if (active) { setDirectory(value); setFailedKind(null); } }).catch(() => { if (active) setFailedKind(kind); });
    if (kind === "game") void services.gameSurface.manifest().then(value => { if (active) { setManifest(value); setFailedKind(null); } }).catch(() => { if (active) setFailedKind(kind); });
    return () => { active = false; };
  }, [services, kind, supported]);
  useEffect(() => { if (!supported || kind !== "game" || !validDate) return; let active = true; void services.gameSurface.date(date).then(value => { if (active) setDates({ date, value, error: false }); }).catch(() => { if (active) setDates({ date, value: null, error: true }); }); return () => { active = false; }; }, [kind, validDate, date, services, supported]);
  if (kind === "series" || kind === "game" && params.get("competition") === "postseason") return <NpbPostseasonDiscovery kind={kind} />;
  if (!supported) return <div className="screen"><PageHeading eyebrow="NPB" title="探す" /><DiscoveryNavigation league="NPB" /><DataState kind="unsupported" title="指定の大会条件では検索できません" action="収録済みの大会記録" to="/NPB/postseason" /></div>;
  return <div className="screen"><PageHeading eyebrow="NPB" title="探す" /><DiscoveryNavigation league="NPB" />{failedKind === kind ? <DataState kind="source-unavailable" title="検索用データを取得できません" /> : (kind === "team" ? !directory : !manifest) ? <LoadingSkeleton /> : <>{kind === "game" && manifest && <label>保存済み試合日<input type="date" value={date} min={manifest.from} max={manifest.to} onChange={e => setParams(previous => { const next = new URLSearchParams(previous); next.set("date", e.target.value); return next; })} /></label>}{kind === "game" && (!validDate ? <DataState kind="unsupported" title="指定日は保存済み範囲外です" /> : dates?.date !== date ? <LoadingSkeleton /> : dates.error ? <DataState kind="source-unavailable" title="指定日の試合情報を取得できません" /> : dates.value?.coverage === "no_games" ? <p>確認済み · 試合なし</p> : dates.value?.coverage !== "complete" && <p className="inline-note">この日のデータは一部確認中です。</p>)}{kind !== "game" || (validDate && dates?.date === date && dates.value) ? <DiscoveryList league="NPB" scope="" teams={directory?.teams.map(t => ({ id: t.id, name: t.name })) ?? []} games={dates?.value?.games.map(g => ({ id: g.gameId, home: g.home.name, away: g.away.name, homeScore: g.home.score, awayScore: g.away.score, state: g.status }))} /> : null}</>}</div>;
}
function NpbPostseasonDiscovery({ kind }: { kind: "series" | "game" }) {
  const [params] = useSearchParams(), [series,setSeries]=useState<NpbPostseasonSeries|null>(null), [cs,setCs]=useState<NpbCsDataset|null>(null), [japan,setJapan]=useState<NpbJapanSeries|null>(null),[japanFailed,setJapanFailed]=useState(false), [failed,setFailed]=useState(false), [attempt,setAttempt]=useState(0);
  const stage=params.get("stage"), date=params.get("date");
  const valid=(!params.has("season")||params.get("season")==="2026")&&(!params.has("competition")||params.get("competition")==="postseason")&&(!stage||["all","npb_cs_first","npb_cs_final","japan_series"].includes(stage))&&(!date||z.iso.date().safeParse(date).success);
  useEffect(()=>{if(!valid)return;let active=true;
    if(stage!=="japan_series"){
      const load=kind==="series"?readNpbSeries().then(value=>{if(active)setSeries(value);}):readNpbCs().then(value=>{if(active)setCs(value);});
      void load.then(()=>{if(active)setFailed(false);}).catch(()=>{if(active)setFailed(true);});
    }
    if(!stage||stage==="all"||stage==="japan_series")void readNpbJapanSeries().then(value=>{if(active){setJapan(value);setJapanFailed(false);}}).catch(()=>{if(active)setJapanFailed(true);});
    return()=>{active=false;};
  },[kind,valid,attempt,stage]);
  const sources=[...(stage==="japan_series"?[]:(kind==="series"?series?.sources:cs?.sources)??[]),...((!stage||stage==="all"||stage==="japan_series")?japan?.sources??[]:[])];
  const allSeries=[...(series?.series??[]),...(japan?[japan.series]:[])];
  const teams=[...new Set([...allSeries.flatMap(s=>s.teams.map(t=>t.teamId)),...cs?.games.flatMap(g=>[g.homeTeamId,g.awayTeamId])??[]])].map(id=>({id,name:npbTeamShortName(id)}));
  return <div className="screen"><PageHeading eyebrow="NPB · 2026 · ポストシーズン" title="探す"/><DiscoveryNavigation league="NPB"/>
    {!valid?<DataState kind="unsupported" title="指定の年度・大会条件は未対応です"/>:(stage==="japan_series"?japanFailed:failed)?<><DataState kind="source-unavailable" title="保存済みの大会記録を取得できません"/><button onClick={()=>{setFailed(false);setJapanFailed(false);setAttempt(a=>a+1);}}>再試行</button></>:!(stage==="japan_series"?japan:kind==="series"?series:cs)?<LoadingSkeleton/>:<>
      <DiscoveryList league="NPB" teams={teams} scope="?season=2026&competition=postseason"
        message="2026年の収録予定・結果。CS勝数はアドバンテージを含みます。日本シリーズの結果・選手成績は未収録。検索結果なしを試合なしとは判定しません。"
        series={allSeries.filter(s=>!stage||stage==="all"||s.round===stage)}
        games={[...(cs?.games.map(g=>({id:g.id,stage:g.stage,date:g.date,home:npbTeamShortName(g.homeTeamId),away:npbTeamShortName(g.awayTeamId),homeScore:g.homeScore,awayScore:g.awayScore,state:`${g.date} · 終了`}))??[]),...(japan?.series.games.map(g=>({id:g.gameId,stage:"japan_series",date:g.date,home:npbTeamShortName(g.homeTeamId),away:npbTeamShortName(g.awayTeamId),homeScore:g.homeRuns,awayScore:g.awayRuns,state:`${g.date} · 日本シリーズ · 予定・結果未収録`}))??[])].filter(g=>(!stage||stage==="all"||g.stage===stage)&&(!date||g.date===date))}/>
      {japanFailed&&stage!=="japan_series"&&<p className="data-notice">日本シリーズの追加情報を取得できません。CSの収録範囲のみ表示しています。</p>}
      <details><summary>出典・収録範囲</summary><p>選手成績は一部収録。日本シリーズは予定のみ収録し、公式戦とは別に表示します。</p>{sources.map(s=><p key={s.pageId}><a href={`https://ja.wikipedia.org/w/index.php?curid=${s.pageId}&oldid=${s.revision}`}>Wikipedia「{s.title}」の執筆者</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · 勝敗・試合表を正規化</p>)}</details>
    </>}
    <Link className="section-action" to="/NPB/postseason?season=2026">シリーズ勝敗・勝ち上がり →</Link>
  </div>;
}
export function MlbDiscovery({ manifest }: { manifest: ExplorerManifest }) {
  const [params, setParams] = useSearchParams(), kind = params.get("kind"), competition = useHistoricalCompetition();
  const season = Number(params.get("season") ?? manifest.seasons.at(-1)!.season), descriptor = manifest.seasons.find(s => s.season === season), date = params.get("date") ?? descriptor?.lastDate ?? "";
  const validDate = !!descriptor && z.iso.date().safeParse(date).success && date >= descriptor.firstDate && date <= descriptor.lastDate;
  const games = useHistoricalStatic<{ date: string; season: number; games: { id: string; homeTeamId: string; awayTeamId: string; homeRuns: number; awayRuns: number; status: string }[] }>(kind === "game" && validDate ? `schedule/${season}/${date}.json` : null);
  const series = useHistoricalStatic<PostseasonHub>(kind === "series" && descriptor ? `postseason/hub/${season}.json` : null);
  const scope = `?season=${season}${competition === "postseason" ? "&competition=postseason" : ""}`;
  const update = (key: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set(key, value); if (key === "season") next.delete("date"); return next; });
  const names = (id: string) => manifest.teams.find(t => t.id === id)?.name ?? "球団不明";
  if ((kind === "game" && games.value && (games.value.date !== date || games.value.season !== season)) || (kind === "series" && series.value && series.value.season !== season)) return <DataState kind="source-unavailable" title="検索対象の日付・シーズンが一致しません" />;
  return <div className="screen"><PageHeading eyebrow="MLB · 過去記録" title="探す" /><DiscoveryNavigation league="MLB" /><label>シーズン<select value={season} onChange={e => update("season", e.target.value)}>{!descriptor && <option value={season}>未収録</option>}{manifest.seasons.map(s => <option key={s.season}>{s.season}</option>)}</select></label>{!descriptor ? <DataState kind="unsupported" title="指定年のCurrent・Historicalは未収録です" /> : <>{kind === "game" && <label>収録試合日<input type="date" value={date} min={descriptor.firstDate} max={descriptor.lastDate} onChange={e => update("date", e.target.value)} /></label>}{kind === "game" && !validDate ? <DataState kind="unsupported" title="指定日は収録範囲外です" /> : ((kind === "game" && games.status === "loading") || (kind === "series" && series.status === "loading")) ? <LoadingSkeleton /> : kind === "game" && games.status === "missing" && descriptor.coverage === "complete" ? <DataState kind="no-data" title="確認済み · 試合なし" detail="この保存済みシーズンの指定日には試合がありません。現在シーズンの試合有無ではありません。" /> : ((kind === "game" && !games.value) || (kind === "series" && !series.value)) ? <DataState kind="source-unavailable" title="指定範囲の保存済み情報を取得できません" /> : <DiscoveryList league="MLB" teams={manifest.teams} scope={scope} message={`${season}年 · ${competition === "postseason" ? "Postseason" : "Regular Season"}の過去記録`} games={games.value?.games.map(g => ({ id: g.id, home: names(g.homeTeamId), away: names(g.awayTeamId), homeScore: g.homeRuns, awayScore: g.awayRuns, state: "過去の試合終了" }))} series={series.value?.series} />}</>}</div>;
}
