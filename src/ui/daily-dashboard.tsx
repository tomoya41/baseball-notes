import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Services } from "../app/services";
import type { NpbCatalog } from "../domain/npb-product-contract";
import type { PlayerRecentResponse } from "../domain/player-recent";
import type { NpbSeasonMilestones } from "../domain/npb-season-milestones";
import type { PlayerGameLogResponse } from "../domain/player-game-log";
import { buildBattingTrends, buildPitchingTrends } from "../domain/player-trends";
import { seasonCheckpointLabels } from "../domain/npb-season-milestones";
import { tokyoToday } from "../domain/product-daily";
import { readDailyDashboard } from "../application/daily-dashboard";
import { DataState, LoadingSkeleton, SectionHeader, MetricLabel } from "./components";
import { GameLinks } from "./npb-game-surface";
import { TeamFavorite, type FavoriteActions } from "./team-favorite";

function useTokyoDate() {
  const [date, setDate] = useState(tokyoToday);
  useEffect(() => { const timer = window.setInterval(() => setDate(tokyoToday()), 60_000); return () => window.clearInterval(timer); }, []);
  return date;
}
export function NpbToday({ services, favorites, toggle, saving, personal = false, onEffectiveDate }: FavoriteActions & { services: Services; personal?: boolean; onEffectiveDate?: (date: string) => void }) {
  const today = useTokyoDate();
  const [data, setData] = useState<{ today: string; value: Awaited<ReturnType<typeof readDailyDashboard>> } | null>(null), [error, setError] = useState("");
  useEffect(() => { let active = true; void readDailyDashboard(services.gameSurface, today).then(value => { if (active) { setData({ today, value }); onEffectiveDate?.(value.manifest.effectiveDate); } }).catch(() => { if (active) setError(today); }); return () => { active = false; }; }, [services, today, onEffectiveDate]);
  const value = data?.today === today ? data.value : null;
  const teams = new Set(favorites.filter(f => f.kind === "team" && f.league === "NPB").map(f => f.entityId));
  const filter = (games: NonNullable<typeof value>["today"]) => personal ? games.filter(g => teams.has(g.home.id) || teams.has(g.away.id)) : games;
  const games = value ? filter(value.today) : [], next = value ? filter(value.next) : [], recent = value ? filter(value.recent) : [];
  const scheduleDate = value ? today < value.manifest.from ? value.manifest.from : today > value.manifest.to ? value.manifest.to : today : null;
  return <section className="home-section today-board"><SectionHeader title={personal ? "フォロー球団の試合" : "今日の試合"} action="日程・結果" to={scheduleDate ? `/NPB/schedule?date=${scheduleDate}` : "/NPB/schedule"} /><p className="inline-note">{today} · 日本時間{value && ` · 結果更新 ${value.manifest.effectiveDate}`}</p>
    {error === today ? <DataState kind="source-unavailable" title="試合情報を読み込めません" /> : !value ? <LoadingSkeleton /> : <>
      {games.length ? <GameLinks games={games} /> : <p className="inline-note">{personal && !teams.size ? "球団をお気に入りに追加すると、試合がここに表示されます。" : personal && value.todayState === "games" ? "保存済みの今日の試合にフォロー球団はありません。" : value.todayState === "no_games" ? "今日は試合なし" : "今日の予定は未確認です。"}</p>}
      {value.failedDates.length > 0 && <p className="inline-note">一部の日程を読み込めません。次戦・結果は読み込めた範囲です。</p>}
      {value.incompleteDates.length > 0 && <p className="inline-note">一部の試合情報は未確定です。日程・結果は保存済みの範囲を表示しています。</p>}
      {next.length > 0 && <><h3>次の試合</h3><GameLinks games={next.slice(0, personal ? 3 : 2)} /></>}
      {recent.length > 0 && <><h3>最近終了した試合</h3><GameLinks games={recent.slice(0, personal ? 3 : 2)} /></>}
      <details className="daily-team-actions"><summary>この期間の球団をフォロー</summary><div className="row-list">{[...new Map([...games, ...next, ...recent].flatMap(g => [g.away, g.home]).map(t => [t.id, t])).values()].map(t => <div className="surface-favorite" key={t.id}><Link className="player-row" to={`/NPB/teams/${encodeURIComponent(t.id)}`}>{t.name}</Link><TeamFavorite league="NPB" teamId={t.id} name={t.name} favorites={favorites} toggle={toggle} saving={saving} /></div>)}</div></details>
    </>}
  </section>;
}
export function NpbFavoriteRecent({ services, playerId, name, expectedDate }: { services: Services; playerId: string; name: string; expectedDate: string }) {
  const [response, setResponse] = useState<PlayerRecentResponse | null>(null), [error, setError] = useState(false), [loaded, setLoaded] = useState(false);
  const [log, setLog] = useState<PlayerGameLogResponse | null>(null);
  const [logError, setLogError] = useState(false);
  const [logLoaded, setLogLoaded] = useState(false);
  useEffect(() => { let active = true; void services.recent.find(playerId, "7d").then(v => { if (active) { setResponse(v); setLoaded(true); } }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [services, playerId]);
  useEffect(() => { let active = true; void services.gameLog.find(playerId, 50).then(v => { if (active) { setLog(v); setLogLoaded(true); } }).catch(() => { if (active) { setLogError(true); setLogLoaded(true); } }); return () => { active = false; }; }, [services, playerId]);
  const valid = response?.asOfDate === expectedDate;
  const batting = response?.batting, pitching = response?.pitching;
  const battingRows = log?.batting.filter(r => r.status === "final" && batting && r.date >= batting.from && r.date <= expectedDate) ?? [];
  const pitchingRows = log?.pitching.filter(r => r.status === "final" && pitching && r.date >= pitching.from && r.date <= expectedDate) ?? [];
  const bats = buildBattingTrends(battingRows, 5, batting?.coverage.status === "complete" && battingRows.length === batting.factCount);
  const pitches = buildPitchingTrends(pitchingRows, pitching?.coverage.status === "complete" && pitchingRows.length === pitching.factCount);
  const last = [...battingRows, ...pitchingRows].sort((a, b) => b.date.localeCompare(a.date) || b.gameNumber - a.gameNumber)[0];
  const streak = (count: number | null, atLeast: boolean) => count === null ? "未確定" : `${count}${atLeast ? "+" : ""}`;
  return <article className="daily-player"><Link className="player-row" to={`/NPB/players/${playerId}`}><strong>{name}</strong><span>→</span></Link>
    {error ? <p className="inline-note">最近の成績を読み込めません。</p> : !loaded ? <LoadingSkeleton /> : !response || !valid ? <p className="inline-note">公開日の一致した最近の成績は未確認です。</p> : !batting && !pitching ? <p className="inline-note">直近7日 · {response.asOfDate}までの出場成績はありません。</p> : <><p className="inline-note">直近7日 · {response.asOfDate}まで{batting && batting.coverage.status !== "complete" || pitching && pitching.coverage.status !== "complete" ? " · 保存済み分" : ""}</p><div className="daily-numbers">{batting && <span><MetricLabel metric="PA" /> {batting.metrics.PA?.value ?? "—"} · 安打 {batting.metrics.H?.value ?? "—"} · 本塁打 {batting.metrics.HR?.value ?? "—"}</span>}{pitching && <span>登板 {pitching.games} · 奪三振 {pitching.metrics.SO?.value ?? "—"} · 失点 {pitching.metrics.R?.value ?? "—"}</span>}</div></>}
    {valid && (batting || pitching) && !log && <p className="inline-note" role="status">{logError ? "試合別成績を読み込めません。Recent集計のみ表示しています。" : logLoaded ? "試合別成績は未収録です。Recent集計のみ表示しています。" : "試合別成績を読み込み中です。"}</p>}
    {valid && log && <><p className="inline-note daily-streak">{battingRows.length > 0 && `安打のある試合 ${streak(bats.hitting.count, bats.hitting.atLeast)} · 出塁 ${streak(bats.onBase.count, bats.onBase.atLeast)}`}{pitchingRows.length > 0 && ` 無失点登板 ${streak(pitches.scoreless.count, pitches.scoreless.atLeast)}`}</p><details><summary>連続数の範囲</summary><p>直近7日内の保存済み出場の末尾から数えます。出塁は安打＋四球＋死球。「+」は期間より前へ続く可能性。欠測・Coverage不完全時は未確定で、公式連続試合記録ではありません。</p></details></>}
    <div className="daily-links">{valid && last && <Link to={`/NPB/games/${encodeURIComponent(last.gameId)}`}>直近の保存試合 {last.date}</Link>}<Link to={`/NPB/players/${playerId}/trends`}>推移・連続記録</Link><Link to={`/NPB/players/${playerId}/analysis`}>分析</Link></div></article>;
}
export function NpbPersonalDashboard({ services, favorites, toggle, saving, compact = false }: FavoriteActions & { services: Services; compact?: boolean }) {
  const [catalog, setCatalog] = useState<NpbCatalog | null>(null), [milestones, setMilestones] = useState<NpbSeasonMilestones | null>(null), [error, setError] = useState(false);
  useEffect(() => { let active = true; void services.product.catalog().then(async value => { if (!active) return; setCatalog(value);
    try { const caps = await services.product.capabilities(); if (!caps.data.seasonMilestones?.available || caps.effectiveDate !== value.effectiveDate || caps.generatedAt !== value.generatedAt) return;
      const m = await services.product.seasonMilestones(Number(value.effectiveDate.slice(0, 4)), caps); if (active) setMilestones(m); } catch { /* Optional independent checkpoint capability. */ }
  }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [services]);
  const ids = new Set(favorites.filter(f => f.league === "NPB" && f.kind === "player").map(f => f.entityId));
  const teams = favorites.filter(f => f.league === "NPB" && f.kind === "team");
  const players = catalog?.players.filter(p => ids.has(p.playerId)).slice(0, compact ? 2 : 4) ?? [];
  const checkpoints = milestones?.players.filter(p => ids.has(p.playerId)).flatMap(p => p.checkpoints.filter(c => c.count > 0 && c.nextCheckpoint - c.count <= 3).map(c => ({ ...c, playerId: p.playerId, name: p.displayName }))).slice(0, 3) ?? [];
  return <>{!compact && <><section className="home-section"><SectionHeader title="お気に入り球団" action="球団を探す" to="/NPB/teams" />{!catalog ? error ? <p>球団情報を読み込めません。</p> : <LoadingSkeleton /> : !teams.length ? <p className="inline-note">球団ページの★から追加できます。</p> : <div className="row-list">{teams.map(f => { const team = catalog.teams.find(t => t.teamId === f.entityId); return <div className="surface-favorite" key={f.entityId}>{team ? <Link className="player-row" to={`/NPB/teams/${encodeURIComponent(team.teamId)}`}>{team.name}</Link> : <span>登録済み球団の情報は未確認</span>}<TeamFavorite league="NPB" teamId={f.entityId} name={team?.name ?? "登録済み球団"} favorites={favorites} toggle={toggle} saving={saving} /></div>; })}</div>}</section>{teams.length > 0 && <NpbToday services={services} favorites={favorites} toggle={toggle} saving={saving} personal />}</>}
    <section className="home-section"><SectionHeader title="フォロー選手の直近成績" action="My" to="/NPB/my" />{error ? <p>選手情報を読み込めません。</p> : !catalog ? <LoadingSkeleton /> : !players.length ? <p className="inline-note">選手の★からフォローできます。</p> : players.map(p => <NpbFavoriteRecent key={`${p.playerId}:${catalog.effectiveDate}`} services={services} playerId={p.playerId} name={p.displayName} expectedDate={catalog.effectiveDate} />)}{ids.size > players.length && <Link className="text-link" to="/NPB/search">保存した選手は下の一覧で確認</Link>}</section>
    {checkpoints.length > 0 && <section className="home-section"><SectionHeader title="シーズンの節目に近い選手" action="達成記録" to="/NPB/milestones" /><p className="inline-note">{milestones!.effectiveDate}までの保存済み分 · 通算記録ではありません。</p><div className="row-list">{checkpoints.map(c => <Link className="player-row" key={`${c.playerId}:${c.metric}`} to={`/NPB/players/${c.playerId}/stats`}><strong>{c.name}</strong><span>{seasonCheckpointLabels[c.metric]} {c.count} / {c.nextCheckpoint}</span></Link>)}</div><details><summary>表示の根拠</summary><p>アプリ定義のシーズン節目まで残り3以下の保存済み成績。未収集試合は含みません。</p></details></section>}
  </>;
}
