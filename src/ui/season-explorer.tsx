import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { readNpbExplorerSeason } from "../application/explorer-readers";
import type { NpbSeasonPayload } from "../application/npb-season-payload";
import type { HistoricalDirectoryPlayer } from "../domain/historical-directory";
import { matchesMlbPlayerName } from "../domain/mlb-japanese-display";
import { normalizePlayerSearch } from "../domain/npb-player-directory";
import { readableMetric } from "../domain/data-explorer";
import { DataState, LoadingSkeleton, MetricLabel, PageHeading } from "./components";
import { ExplorerLinks, type ExplorerManifest, type ExplorerProfile } from "./data-explorer";
import { useHistoricalStatic } from "./use-mlb-historical";
import { useHistoricalCompetition } from "./historical-competition-context";

export function MlbSeasonExplorer({ manifest }: { manifest: ExplorerManifest }) {
  const [params, setParams] = useSearchParams(), competition = useHistoricalCompetition(), scope = competition === "postseason" ? "&competition=postseason" : "";
  const directory = useHistoricalStatic<{ players: HistoricalDirectoryPlayer[] }>("players/index.json");
  const playerId = params.get("player") ?? "", player = directory.value?.players.find(p => p.id === playerId), role = params.get("role") === "pitching" ? "pitching" : "batting";
  const profile = useHistoricalStatic<ExplorerProfile>(player ? `players/${playerId.replaceAll(":", "_")}.json` : null);
  const name = params.get("q") ?? "", yearRaw = params.get("season"), year = yearRaw ? Number(yearRaw) : manifest.seasons.at(-1)!.season;
  const update = (key: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); return next; });
  const candidates = name.trim() ? directory.value?.players.filter(p => matchesMlbPlayerName(p.id, p.name, name)).slice(0, 20) ?? [] : [];
  const keys = role === "batting" ? ["PA", "HR", "AVG", "OPS"] : ["outsRecorded", "SO", "ERA", "K9"];
  const format = (key: string, value: number | null) => value === null ? "—" : key === "outsRecorded" ? `${Math.floor(value / 3)}.${value % 3}` : ["AVG", "OPS"].includes(key) ? value.toFixed(3) : ["ERA", "K9"].includes(key) ? value.toFixed(2) : String(value);
  return <div className="screen"><PageHeading eyebrow={`MLB · ${competition === "postseason" ? "POSTSEASON" : "REGULAR SEASON"}`} title="保存済みシーズン履歴" /><ExplorerLinks league="MLB" scope={`?season=${year}${scope}`} /><p className="inline-note">収録年の実データです。MLB通算・現在の成績ではありません。</p>
    <label className="competition-season">シーズン<select value={year} onChange={e => update("season", e.target.value)}>{!manifest.seasons.some(s => s.season === year) && <option value={year}>未収録</option>}{manifest.seasons.map(s => <option key={s.season}>{s.season}</option>)}</select></label>
    {manifest.seasons.some(s => s.season === year) ? <div className="hub-links"><Link to={`/MLB/data?season=${year}${scope}`}>年度の成績を探索 →</Link><Link to={`/MLB/teams?season=${year}${scope}`}>球団別Season →</Link><Link to={`/MLB/schedule?season=${year}${scope}`}>日程・Game →</Link>{competition === "postseason" && <Link to={`/MLB/postseason?season=${year}`}>Series・勝ち上がり →</Link>}</div> : <DataState kind="unsupported" title="指定したシーズンは未収録です" />}
    <h2>同じ選手を年度で見る</h2><label className="search-field"><span className="sr-only">履歴を調べる選手</span><input type="search" value={name} placeholder="日本語・英語・既存表記で検索" onChange={e => update("q", e.target.value)} /></label>
    {directory.status === "loading" && <LoadingSkeleton />}{["missing", "error"].includes(directory.status) && <DataState kind="source-unavailable" title="選手一覧を取得できません" />}
    <div className="row-list">{candidates.map(p => <button className="player-row" key={p.id} onClick={() => update("player", p.id)} aria-pressed={p.id === playerId}>{p.name} <span>{p.seasons.join(" / ")}</span></button>)}</div>
    {name.trim() && directory.value && !candidates.length && <DataState kind="no-data" title="一致する保存済み選手がありません" />}
    {playerId && directory.value && !player && <DataState kind="no-data" title="この集計対象では選手が未収録です" />}
    {player && <><h2>{player.name}</h2><div className="segmented" role="group" aria-label="履歴の成績">{(["batting", "pitching"] as const).map(r => <button key={r} aria-pressed={role === r} onClick={() => update("role", r)}>{r === "batting" ? "打撃" : "投球"}</button>)}</div>
      {profile.status === "loading" ? <LoadingSkeleton /> : !profile.value || profile.value.player.id !== playerId ? <DataState kind="source-unavailable" title="年度別成績を読み込めません" /> : <div className="row-list">{player.seasons.map(season => {
        const values = profile.value!.seasonTotals[String(season)]?.[role], context = `?season=${season}${scope}`, base = `/MLB/players/${encodeURIComponent(player.id)}`;
        const teams = [...new Set([...profile.value!.batting, ...profile.value!.pitching].filter(p => p.season === season).map(p => p.teamId))];
        return <article className="explorer-result" key={season}><h3>{season}年</h3>{values ? <dl className="explorer-values">{keys.map(k => <div key={k}><dt><MetricLabel metric={k} /></dt><dd>{format(k, readableMetric(values[k]))}</dd></div>)}</dl> : <p>この出場形態の記録はありません。</p>}<nav className="explorer-links" aria-label={`${season}年の選手データ`}><Link to={`${base}/stats${context}`}>Season</Link><Link to={`${base}/analysis${context}`}>Analysis</Link><Link to={`${base}/game-log${context}`}>Game Log</Link><Link to={`/MLB/compare?players=${encodeURIComponent(player.id)}&season=${season}&role=${role}${scope}`}>比較</Link></nav>{teams.map(id => <Link className="text-link" key={id} to={`/MLB/teams/${encodeURIComponent(id)}${context}`}>{manifest.teams.find(t => t.id === id)?.name ?? "収録球団"} →</Link>)}</article>;
      })}</div>}</>}
  </div>;
}
export function NpbSeasonExplorer() {
  const [data, setData] = useState<NpbSeasonPayload | null>(null), [failed, setFailed] = useState(false), [params, setParams] = useSearchParams();
  const supported = params.get("competition") !== "postseason" && (!params.has("season") || params.get("season") === "2026");
  useEffect(() => { if (!supported) return; let active = true; void readNpbExplorerSeason(2026).then(value => { if (active) setData(value); }).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, [supported]);
  const query = params.get("q") ?? "";
  if (!supported) return <DataState kind="unsupported" title="指定したNPBシーズンは未収録です" />;
  return <div className="screen"><PageHeading eyebrow="NPB" title="保存済みシーズン履歴" /><ExplorerLinks league="NPB" /><p className="inline-note">現在は2026年の公式戦のみ収録。Career・過去年度の成績ではありません。</p>{failed ? <DataState kind="source-unavailable" title="保存済みシーズンを取得できません" /> : !data ? <LoadingSkeleton /> : <><h2>{data.season}年 · {data.effectiveDate}まで</h2><p>Coverage {data.coverage.status === "complete" ? "確認済み" : "一部未確認"}</p><div className="hub-links"><Link to="/NPB/data?season=2026">年度の成績を探索 →</Link><Link to="/NPB/teams">球団別Season →</Link><Link to="/NPB/schedule">日程・Game →</Link></div><label className="search-field"><span className="sr-only">履歴を調べる選手</span><input type="search" value={query} placeholder="選手名を入力" onChange={e => setParams(previous => { const next = new URLSearchParams(previous); next.set("q", e.target.value); return next; })} /></label>{query.trim() && <div className="row-list">{data.players.filter(p => normalizePlayerSearch(p.displayName).includes(normalizePlayerSearch(query))).slice(0, 20).map(p => <Link className="player-row" key={p.playerId} to={`/NPB/players/${encodeURIComponent(p.playerId)}/stats`}>{p.displayName} · 2026 Season →</Link>)}</div>}</>}</div>;
}
