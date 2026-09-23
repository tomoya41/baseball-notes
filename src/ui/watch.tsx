import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ZodType } from "zod";
import { ChevronRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { WatchProvider } from "../application/ports";
import type { PlayerCatalog } from "../domain/models";
import { watchBullpenResultSchema, watchCapabilitiesSchema, watchLineupResultSchema, watchScheduleResultSchema } from "../domain/watch";
import type { BullpenUsage, WatchBullpenResult, WatchCapabilities, WatchGame, WatchLineup, WatchLineupResult } from "../domain/watch";
import { formatDate, formatDateTime, formatPlayerName, formatPositions, formatTeamName, formatTime } from "../presentation/formatters";
import { isWatchDay } from "../presentation/watch";
import { TeamBrand } from "./branding";
import { DataState, LoadingSkeleton, PageHeading, SectionHeader } from "./components";
import { useTodayJst } from "./use-today-jst";

function useWatchResource<T>(key: string, enabled: boolean, schema: ZodType<T>,
  load: (signal: AbortSignal) => Promise<unknown>) {
  const [state, setState] = useState<{ key: string; result: T | null; error: string | null }>({ key: "", result: null, error: null });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void load(controller.signal).then((raw) => {
      if (!controller.signal.aborted) setState({ key, result: schema.parse(raw), error: null });
    }).catch(() => { if (!controller.signal.aborted) setState({ key, result: null, error: "提供元から取得できませんでした" }); });
    return () => controller.abort();
  }, [key, enabled, schema, load]);
  return state.key === key ? state : { key, result: null, error: null };
}
function enabled(feature: { status: string; implementation: string }) {
  return feature.status === "available" && feature.implementation === "implemented";
}
function watchState(result: { status: string; reason?: string } | null, error: string | null, supported: boolean): ReactNode {
  if (!supported) return <DataState kind="unsupported" title="この提供元にはデータがありません" />;
  if (error) return <DataState kind="source-unavailable" detail={error} />;
  if (!result) return <LoadingSkeleton />;
  if (result.status === "empty") return <DataState kind="no-data" detail={result.reason ?? "対象のデータはありません"} />;
  if (result.status === "unavailable") return <DataState kind="unsupported" detail={result.reason ?? "提供されていません"} />;
  if (result.status === "error") return <DataState kind="source-unavailable" detail={result.reason ?? "取得できませんでした"} />;
  return null;
}

function GameCard({ game, catalog }: { game: WatchGame; catalog: PlayerCatalog }) {
  const away = catalog.teams.find((team) => team.id === game.awayTeamId);
  const home = catalog.teams.find((team) => team.id === game.homeTeamId);
  const name = (id: string | null) => catalog.profiles.find(({ player }) => player.id === id)?.player;
  return <Link className="watch-game-card" to={`/${catalog.league}/watch/${encodeURIComponent(game.id)}`}>
    <span className="watch-game-card__time">{game.startsAt ? formatTime(game.startsAt) : "開始時刻未定"}</span>
    <span><TeamBrand team={away} size="sm" /><strong>{formatTeamName(away, "short")}</strong>
      <small>{game.awayStarterId ? `先発予定 ${name(game.awayStarterId) ? formatPlayerName(name(game.awayStarterId)!) : "未登録"}` : "先発未発表"}</small></span>
    <span className="watch-game-card__vs">対</span>
    <span><TeamBrand team={home} size="sm" /><strong>{formatTeamName(home, "short")}</strong>
      <small>{game.homeStarterId ? `先発予定 ${name(game.homeStarterId) ? formatPlayerName(name(game.homeStarterId)!) : "未登録"}` : "先発未発表"}</small></span>
    <ChevronRight size={18} aria-hidden="true" />
  </Link>;
}

export function WatchToday({ catalog, provider }: { catalog: PlayerCatalog; provider: WatchProvider }) {
  const capability = watchCapabilitiesSchema.parse(provider.capabilities(catalog.league));
  const date = useTodayJst();
  const load = useCallback((signal: AbortSignal) => provider.schedule(catalog.league, date, signal), [provider, catalog.league, date]);
  const schedule = useWatchResource(`schedule:${catalog.league}:${date}`, enabled(capability.schedule), watchScheduleResultSchema, load);
  return <>{schedule.result?.status === "data" ? <><div className="watch-game-list">
    {schedule.result.games.filter((game) => isWatchDay(game, date) && game.league === catalog.league).map((game) =>
      <GameCard key={game.id} game={game} catalog={catalog} />)}
    {!schedule.result.games.some((game) => isWatchDay(game, date) && game.league === catalog.league) && <DataState kind="no-data" title="今日の試合はありません" />}
  </div>{schedule.result.freshness.state === "stale" && <DataState kind="source-unavailable" title="日程情報の更新確認が必要です" />}</>
    : watchState(schedule.result, schedule.error, enabled(capability.schedule))}
    <Link className="text-link" to={`/${catalog.league}/matchup`}>投手と打者を選んで比較<ChevronRight size={16} /></Link></>;
}

function playerName(catalog: PlayerCatalog, id: string) {
  const player = catalog.profiles.find((entry) => entry.player.id === id)?.player;
  return player ? formatPlayerName(player) : "選手情報なし";
}
export function LineupView({ lineup, catalog, opposingPitcherId }: {
  lineup: WatchLineup; catalog: PlayerCatalog; opposingPitcherId: string | null;
}) {
  const [startSlot, setStartSlot] = useState(1);
  const rows = [...lineup.players].sort((a, b) => a.battingOrder - b.battingOrder);
  const next = rows.length >= 3 ? [...rows.filter((row) => row.battingOrder >= startSlot),
    ...rows.filter((row) => row.battingOrder < startSlot)].slice(0, 3) : [];
  const matchupTo = (batterId: string) => opposingPitcherId
    ? `/${catalog.league}/matchup?pitcher=${encodeURIComponent(opposingPitcherId)}&batter=${encodeURIComponent(batterId)}`
    : `/${catalog.league}/matchup?batter=${encodeURIComponent(batterId)}`;
  return <><p className="muted">{lineup.confirmed ? "発表済み打順" : "予定打順"} · 現在の次打者は追跡しません</p>
    <div className="watch-lineup">{rows.map((row) => {
      const player = catalog.profiles.find((entry) => entry.player.id === row.playerId)?.player;
      const team = catalog.teams.find((item) => item.id === player?.teamId);
      return <Link className="player-row" key={row.battingOrder} to={matchupTo(row.playerId)}>
        <strong className="watch-slot">{row.battingOrder}番</strong><TeamBrand team={team} size="sm" />
        <span className="player-row__body"><strong>{playerName(catalog, row.playerId)}</strong>
          <small>{player ? formatPositions(player.positions) : "守備位置不明"} · MATCHUP</small></span>
        <ChevronRight size={18} aria-hidden="true" /></Link>;
    })}</div>
    {next.length === 3 && <section className="watch-next"><SectionHeader title="打順から選ぶ3打者" />
      <label>先頭の打順 <select value={startSlot} onChange={(event) => setStartSlot(Number(event.target.value))}>
        {rows.map((row) => <option value={row.battingOrder} key={row.battingOrder}>{row.battingOrder}番</option>)}</select></label>
      <div className="watch-next__list">{next.map((row) => <Link key={row.battingOrder} to={matchupTo(row.playerId)}>
        <span>{row.battingOrder}番</span><strong>{playerName(catalog, row.playerId)}</strong><ChevronRight size={18} /></Link>)}</div>
    </section>}
  </>;
}

export function BullpenView({ usage, catalog }: { usage: BullpenUsage; catalog: PlayerCatalog }) {
  return <><p className="analysis-cutoff">{formatDate(usage.completeThrough, true)}終了時点 · 登板状況の事実のみ</p>
    <div className="analysis-list">{usage.pitchers.map((item) => <div className="watch-bullpen-row" key={item.playerId}>
      <strong>{playerName(catalog, item.playerId)}</strong><span>
        {item.lastAppearanceDate ? `最終登板 ${formatDate(item.lastAppearanceDate, true)}` : "最終登板 不明"}
        {item.previousDayPitches != null && ` · 前日 ${item.previousDayPitches}球`}
        {item.lastThreeDaysAppearances != null && ` · 直近3日 ${item.lastThreeDaysAppearances}登板`}
        {item.lastThreeDaysPitches != null && ` / ${item.lastThreeDaysPitches}球`}
        {item.consecutiveDays != null && item.consecutiveDays > 1 && ` · ${item.consecutiveDays}連投`}
      </span></div>)}</div></>;
}

export function WatchGameSections({ catalog, game, date, observedAt, scheduleStale = false, pitchingSide = "home", capability, lineup, bullpen }: {
  catalog: PlayerCatalog; game: WatchGame; date: string; observedAt: string;
  scheduleStale?: boolean; pitchingSide?: "home" | "away";
  capability: WatchCapabilities;
  lineup: { result: WatchLineupResult | null; error: string | null };
  bullpen: { result: WatchBullpenResult | null; error: string | null };
}) {
  const starterId = pitchingSide === "home" ? game.homeStarterId : game.awayStarterId;
  const opponentTeamId = pitchingSide === "home" ? game.awayTeamId : game.homeTeamId;
  const starterTeamId = pitchingSide === "home" ? game.homeTeamId : game.awayTeamId;
  return <><GameCard game={game} catalog={catalog} />
    <p className="analysis-cutoff">試合情報更新：{formatDateTime(observedAt)}</p>
    {scheduleStale && <DataState kind="source-unavailable" title="日程情報の更新確認が必要です" />}
    <SectionHeader title="先発投手 vs 打線" />
    {!starterId && <DataState kind="no-data" title="先発投手は未発表です" />}
    {lineup.result?.status === "data" && lineup.result.lineup.gameId === game.id &&
      lineup.result.lineup.teamId === opponentTeamId
      ? <LineupView key={`${game.id}:${opponentTeamId}`} lineup={lineup.result.lineup} catalog={catalog}
        opposingPitcherId={starterId} />
      : lineup.result?.status === "data" ? <DataState kind="source-unavailable" title="打順の試合・球団が一致しません" />
        : watchState(lineup.result, lineup.error, enabled(capability.lineup))}
    {lineup.result?.status === "data" && lineup.result.freshness.state === "stale" &&
      <DataState kind="source-unavailable" title="打順情報の更新確認が必要です" />}
    <SectionHeader title="ブルペンの直近登板" />
    {bullpen.result?.status === "data" && bullpen.result.usage.gameId === game.id &&
      bullpen.result.usage.teamId === starterTeamId && bullpen.result.usage.completeThrough < date
      ? <BullpenView usage={bullpen.result.usage} catalog={catalog} />
      : bullpen.result?.status === "data" ? <DataState kind="source-unavailable" title="ブルペンの基準日または試合情報が不正です" />
        : watchState(bullpen.result, bullpen.error, enabled(capability.bullpenUsage))}
    {bullpen.result?.status === "data" && bullpen.result.freshness.state === "stale" &&
      <DataState kind="source-unavailable" title="登板履歴の更新確認が必要です" />}</>;
}

export function WatchGameScreen({ catalog, provider }: { catalog: PlayerCatalog; provider: WatchProvider }) {
  const { gameId } = useParams();
  const [selectedSide, setSelectedSide] = useState<"home" | "away">("home");
  const date = useTodayJst();
  const capability = watchCapabilitiesSchema.parse(provider.capabilities(catalog.league));
  const loadSchedule = useCallback((signal: AbortSignal) => provider.schedule(catalog.league, date, signal), [provider, catalog.league, date]);
  const schedule = useWatchResource(`schedule:${catalog.league}:${date}`, enabled(capability.schedule), watchScheduleResultSchema, loadSchedule);
  const game = schedule.result?.status === "data" ? schedule.result.games.find((item) => item.id === gameId && isWatchDay(item, date)) : null;
  const side = game?.homeStarterId && game.awayStarterId ? selectedSide : game?.homeStarterId ? "home" : "away";
  const opponentTeamId = game ? side === "home" ? game.awayTeamId : game.homeTeamId : null;
  const starterTeamId = game ? side === "home" ? game.homeTeamId : game.awayTeamId : null;
  const loadLineup = useCallback((signal: AbortSignal) => provider.lineup(catalog.league, gameId ?? "", opponentTeamId ?? "", signal),
    [provider, catalog.league, gameId, opponentTeamId]);
  const loadBullpen = useCallback((signal: AbortSignal) => provider.bullpen(catalog.league, gameId ?? "", starterTeamId ?? "", signal),
    [provider, catalog.league, gameId, starterTeamId]);
  const lineup = useWatchResource(`lineup:${gameId}:${opponentTeamId}`, !!game && !!opponentTeamId && enabled(capability.lineup),
    watchLineupResultSchema, loadLineup);
  const bullpen = useWatchResource(`bullpen:${gameId}:${starterTeamId}`, !!game && !!starterTeamId && enabled(capability.bullpenUsage),
    watchBullpenResultSchema, loadBullpen);
  return <div className="screen watch-screen"><PageHeading eyebrow={`${catalog.league} / 観戦補助`} title="今日の試合" detail="試合前・前日までのデータで対戦を確認" />
    {!game ? <>{watchState(schedule.result, schedule.error, enabled(capability.schedule)) ?? <DataState kind="no-data" title="今日の試合が見つかりません" />}
      <Link className="text-link" to={`/${catalog.league}/matchup`}>手動でMATCHUPを選ぶ<ChevronRight size={16} /></Link></>
      : <>{game.homeStarterId && game.awayStarterId && <div className="segmented" role="group" aria-label="分析する先発投手">
        <button type="button" aria-pressed={side === "home"} onClick={() => setSelectedSide("home")}>
          {formatTeamName(catalog.teams.find((team) => team.id === game.homeTeamId), "short")}の投手</button>
        <button type="button" aria-pressed={side === "away"} onClick={() => setSelectedSide("away")}>
          {formatTeamName(catalog.teams.find((team) => team.id === game.awayTeamId), "short")}の投手</button>
      </div>}
      <WatchGameSections catalog={catalog} game={game} date={date} pitchingSide={side}
        observedAt={schedule.result?.status === "data" ? schedule.result.observedAt : ""}
        scheduleStale={schedule.result?.status === "data" && schedule.result.freshness.state === "stale"}
        capability={capability} lineup={lineup} bullpen={bullpen} /></>}
  </div>;
}
