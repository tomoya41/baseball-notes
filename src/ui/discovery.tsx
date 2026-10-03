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

export function DiscoveryNavigation({ league }: { league: "NPB" | "MLB" }) {
  const [params] = useSearchParams(), active = params.get("kind") ?? "player";
  return <><nav className="explorer-links" aria-label="検索対象">{[{ key: "player", label: "選手" }, { key: "team", label: "球団" }, { key: "game", label: "試合" }, { key: "series", label: "Series" }].map(item => {
    const next = new URLSearchParams(params); next.set("kind", item.key);
    if (league === "MLB" && item.key === "series") next.set("competition", "postseason");
    return <Link key={item.key} aria-current={active === item.key ? "page" : undefined} to={`/${league}/search?${next}`}>{item.label}</Link>;
  })}</nav><ExplorerLinks league={league} scope={`?${params}`} /><Link className="text-link" to={`/${league}/my`}>Favoritesから探す →</Link></>;
}
function DiscoveryList({ league, teams, scope, games, series, message }: { league: "NPB" | "MLB"; teams: { id: string; name: string }[]; scope: string;
  games?: { id: string; home: string; away: string; homeScore: number | null; awayScore: number | null; state: string }[] | undefined; series?: PostseasonHub["series"] | undefined; message?: string }) {
  const [params, setParams] = useSearchParams(), kind = params.get("kind"), query = params.get("q") ?? "";
  const matches = (value: string) => normalizePlayerSearch(value).includes(normalizePlayerSearch(query));
  const rows = kind === "team" ? teams.filter(t => matches(t.name)).map(t => ({ id: t.id, name: t.name, to: `/${league}/teams/${encodeURIComponent(t.id)}${scope}` })) : kind === "series" ? (series ?? []).filter(s => matches(`${s.name} ${s.teams.map(t => teams.find(row => row.id === t.teamId)?.name ?? "").join(" ")}`)).map(s => ({ id: s.id, name: `${s.name} · ${s.teams.map(t => `${teams.find(row => row.id === t.teamId)?.name ?? "球団"} ${t.seriesTotal}勝`).join(" / ")}`, to: `/${league}/postseason/series/${encodeURIComponent(s.id)}${scope}` })) : (games ?? []).filter(g => matches(`${g.home} ${g.away} ${g.state}`)).map(g => ({ id: g.id, name: `${g.away} ${g.awayScore ?? "—"}–${g.homeScore ?? "—"} ${g.home} · ${g.state}`, to: `/${league}/games/${encodeURIComponent(g.id)}${scope}` }));
  return <><label className="search-field"><span className="sr-only">球団・試合・Seriesの検索</span><input type="search" value={query} placeholder="球団名・Series名で絞り込み" onChange={e => setParams(previous => { const next = new URLSearchParams(previous); next.set("q", e.target.value); return next; })} /></label>{message && <p className="inline-note">{message}</p>}<div className="list-heading"><strong>{rows.length}件</strong></div>{!rows.length && <DataState kind="no-data" title="この範囲で一致する保存済みデータがありません" />}<div className="row-list">{rows.slice(0, 60).map(row => <Link className="player-row" key={row.id} to={row.to}><strong>{row.name}</strong><span>→</span></Link>)}</div></>;
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
  if (!supported) return <div className="screen"><PageHeading eyebrow="NPB" title="探す" /><DiscoveryNavigation league="NPB" /><DataState kind="unsupported" title="NPB PostseasonはSource rights pendingです" action="利用状況" to="/NPB/postseason" /></div>;
  return <div className="screen"><PageHeading eyebrow="NPB" title="探す" /><DiscoveryNavigation league="NPB" />{failedKind === kind ? <DataState kind="source-unavailable" title="検索用データを取得できません" /> : (kind === "team" ? !directory : !manifest) ? <LoadingSkeleton /> : <>{kind === "game" && manifest && <label>保存済み試合日<input type="date" value={date} min={manifest.from} max={manifest.to} onChange={e => setParams(previous => { const next = new URLSearchParams(previous); next.set("date", e.target.value); return next; })} /></label>}{kind === "game" && (!validDate ? <DataState kind="unsupported" title="指定日は保存済み範囲外です" /> : dates?.date !== date ? <LoadingSkeleton /> : dates.error ? <DataState kind="source-unavailable" title="指定日の試合情報を取得できません" /> : dates.value?.coverage === "no_games" ? <p>確認済み · 試合なし</p> : dates.value?.coverage !== "complete" && <p className="inline-note">この日のデータは一部確認中です。</p>)}{kind !== "game" || (validDate && dates?.date === date && dates.value) ? <DiscoveryList league="NPB" scope="" teams={directory?.teams.map(t => ({ id: t.id, name: t.name })) ?? []} games={dates?.value?.games.map(g => ({ id: g.gameId, home: g.home.name, away: g.away.name, homeScore: g.home.score, awayScore: g.away.score, state: g.status }))} /> : null}</>}</div>;
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
