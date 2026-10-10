import type { Services } from "../app/services";
import type { Favorite, League } from "../domain/models";
import type { PersonalState } from "./personal-library";
import { WATCH_LIMITS, watchFingerprint, type WatchObservation, type WatchPreferences } from "../domain/personal-watch";
import { boundedExplorerRead, exploreRows, explorerInputErrors, explorerQuery, type ExplorerValues } from "../domain/data-explorer";
import { readNpbRecentExplorer } from "./explorer-readers";
import { readHistoricalProduct } from "../infrastructure/providers/historical-product-reader";
import { battingAggregate, pitchingAggregate, dateWindow, type DatedBatter, type DatedPitcher } from "../domain/mlb-historical-aggregate";
import { buildBattingTrends, buildPitchingTrends } from "../domain/player-trends";
import type { HistoricalChronology } from "../domain/game-chronology";
import type { HistoricalTeamHub } from "../domain/team-hub";
import type { PostseasonHub } from "../domain/competition";
import { seasonCheckpoints } from "../domain/mlb-product-metrics";
import { seasonCheckpointSteps } from "../domain/npb-season-milestones";

export function watchTargets(league: League, favorites: readonly Favorite[], library: PersonalState, preferences: WatchPreferences) {
  const favoritePlayers = [...new Set(favorites.filter(f => f.league === league && f.kind === "player").map(f => f.entityId))];
  const collected = preferences.collections ? library.collections.flatMap(c => c.players.filter(p => p.league === league).map(p => p.playerId)) : [];
  const playerRules = preferences.players || preferences.recent || preferences.milestones || (league === "MLB" && preferences.streaks);
  const all = [...new Set([...(playerRules ? favoritePlayers : []), ...collected])];
  const players = all.slice(0, WATCH_LIMITS.players).map(id => ({ id, collectionOnly: !favoritePlayers.includes(id), collectionMember: collected.includes(id) }));
  const allTeams = preferences.teams || (league === "MLB" && preferences.postseason) ? [...new Set(favorites.filter(f => f.league === league && f.kind === "team").map(f => f.entityId))] : [];
  const saved = preferences.savedViews ? library.views.filter(v => v.league === league) : [];
  // Eligibility precedes the read budget: History/selected/unsupported seasons
  // must never crowd an otherwise valid all-player Recent saved condition out.
  const allViews = saved.filter(v=>{const p=new URLSearchParams(v.conditions);return league==="NPB" && v.kind==="data" && ["7","14","30"].includes(p.get("period")??"") && p.get("recentMode")!=="selected" && !p.has("recentPlayers") && p.get("competition")!=="postseason" && (!p.has("season")||p.get("season")==="2026") && !explorerInputErrors(p).length;});
  return { players, teams: allTeams.slice(0, WATCH_LIMITS.teams), views: allViews.slice(0, WATCH_LIMITS.views), unsupportedViews:saved.length-allViews.length, omitted: Math.max(0, all.length - players.length) + Math.max(0, allTeams.length - WATCH_LIMITS.teams) + Math.max(0, allViews.length - WATCH_LIMITS.views) };
}
type Profile = { player: { id: string; name: string; seasons: number[] }; seasonTotals: Record<string, { batting: ExplorerValues | null; pitching: ExplorerValues | null }>; batting: DatedBatter[]; pitching: DatedPitcher[] };
type Manifest = { seasons: { season: number; firstDate: string; lastDate: string; coverage: string }[]; teams: { id: string; name: string }[] };
type Sources = Pick<Services, "directory" | "gameLog" | "gameSurface"> & {
  checkpoints: Services["product"]["seasonMilestones"]; recent: typeof readNpbRecentExplorer; historical: typeof readHistoricalProduct;
};
export const watchSources = (s: Pick<Services, "directory" | "gameLog" | "gameSurface" | "product">): Sources => ({ ...s, checkpoints: s.product.seasonMilestones.bind(s.product), recent: readNpbRecentExplorer, historical: readHistoricalProduct });
export type WatchCheck = { observations: WatchObservation[]; activeEntities: string[]; notes: string[]; fetches: number; targets: number; elapsedMs: number };
export async function readWatchObservations(league: League, favorites: readonly Favorite[], library: PersonalState, preferences: WatchPreferences, sources: Sources, now = Date.now()): Promise<WatchCheck> {
  const started = performance.now(), targets = watchTargets(league, favorites, library, preferences), observations: WatchObservation[] = [], notes: string[] = [];
  const activeEntities = [...targets.players.map(p=>`player:${p.id}`),...targets.teams.map(id=>`team:${id}`),...targets.views.map(v=>`view:${v.id}`)];
  let fetches = 0;
  const read = async <T>(work: () => Promise<T>): Promise<T | null> => { fetches++; try { return await work(); } catch { notes.push("一部のデータを取得できません。前回の確認状態を保持します。"); return null; } };
  const add = (base: Omit<WatchObservation, "key" | "rule" | "metric" | "values">, rule: WatchObservation["rule"], metric: string, values: WatchObservation["values"], qualifier = "") => {
    observations.push({ ...base, rule, metric, values, key: `${base.league}:${base.kind}:${base.entityId}:${base.season}:${base.competition}:${rule}:${metric}:${qualifier}` });
  };
  const base = (kind: "player" | "team", id: string, name: string, season: number, effectiveDate: string, coverage: WatchObservation["coverage"], generatedAt: string | null = null, collectionOnly = false): Omit<WatchObservation, "key" | "rule" | "metric" | "values"> => ({ league, kind, entityId: id, name, season, competition: "regular", effectiveDate, generatedAt, eventDate: null, coverage, path: `/${league}/${kind === "player" ? "players" : "teams"}/${encodeURIComponent(id)}?season=${season}`, collectionOnly, observedAt: now });
  const recent = (b: ReturnType<typeof base>, batting: ExplorerValues | null, pitching: ExplorerValues | null) => {
    for (const [metric, sample, values] of [["OPS", "PA", batting], ["ERA", "outsRecorded", pitching]] as const) {
      const m = values?.[metric], n = values?.[sample];
      if (m?.status === "complete" && n?.status === "complete" && m.value !== null && n.value !== null) add(b, "recent", metric, { value: m.value, sample: n.value });
    }
  };
  const milestones = (b: ReturnType<typeof base>, batting: ExplorerValues | null, pitching: ExplorerValues | null) => {
    if (b.coverage !== "complete") return;
    for (const c of seasonCheckpoints(batting, pitching)) add(b, "milestone", c.metric, { value: c.value, step: c.step });
  };
  if (targets.omitted) notes.push(`上限により${targets.omitted}対象を今回は確認しません。選手12人・球団4・保存条件6まで。`);
  if (targets.unsupportedViews) notes.push(`${targets.unsupportedViews}保存条件はWatch未対応です。NPB 2026の全選手・Recent 7/14/30条件だけ検出します。保存条件から再検索できます。`);
  if (!targets.players.length && !targets.teams.length && !targets.views.length) return { observations, activeEntities: [], notes, fetches, targets: 0, elapsedMs: performance.now() - started };
  if (league === "NPB") {
    const directory = await read(() => sources.directory.findLatestNpb());
    if (!directory) return { observations, activeEntities, notes, fetches, targets: targets.players.length + targets.teams.length + targets.views.length, elapsedMs: performance.now() - started };
    const season = Number(directory.effectiveDate.slice(0, 4));
    const windows = [...new Set([...(preferences.recent && targets.players.length ? [14] : []), ...targets.views.flatMap(v => { const p = new URLSearchParams(v.conditions); return v.kind === "data" && ["7", "14", "30"].includes(p.get("period") ?? "") ? [Number(p.get("period"))] : []; })])] as (7 | 14 | 30)[];
    const recentRows = new Map<number, Awaited<ReturnType<typeof readNpbRecentExplorer>>>();
    for (const days of windows) { const p = await read(() => sources.recent(days, directory)); if (p) { recentRows.set(days, p); if (p.coverage.status !== "complete") notes.push(`${days}日RecentはCoverage未確認部分があるため数値変化・条件一致を検出しません。`); } }
    const totals = preferences.milestones && targets.players.length ? await read(() => sources.checkpoints(season, directory)) : null;
    const seasonAligned = totals?.effectiveDate === directory.effectiveDate && totals?.generatedAt === directory.generatedAt;
    if (totals && (!seasonAligned || totals.coverage.status !== "complete")) notes.push("節目の取得世代またはCoverageを確認できないため、節目を判定しません。");
    const results = await boundedExplorerRead(targets.players.filter(p=>preferences.players || p.collectionMember).map(p => p.id), async id => { fetches++; return { id, log: await sources.gameLog.find(id, 10, 0) }; });
    if (results.failed.length) notes.push(`${results.failed.length}選手の試合記録を取得できません。`);
    for (const target of targets.players) {
      const player = directory.players.find(p => p.playerId === target.id); if (!player) { notes.push("Directoryで確認できない選手は判定しません。"); continue; }
      const b = { ...base("player", target.id, player.displayName, season, directory.effectiveDate, "partial", directory.generatedAt, target.collectionOnly), collectionMember: target.collectionMember };
      const log = results.values.find(r => r.id === target.id)?.log;
      const games = log ? [...log.batting.map(r => ({ game: r, values: { H: r.hits, HR: r.homeRuns, PA: r.pa } })), ...log.pitching.map(r => ({ game: r, values: { outsRecorded: r.outsRecorded, ER: r.earnedRuns, SO: r.strikeouts } }))].filter(r => r.game.status === "final" && r.game.date <= directory.effectiveDate && r.game.date.startsWith(String(season))).sort((a, c) => c.game.date.localeCompare(a.game.date) || c.game.gameNumber - a.game.gameNumber) : [];
      if (games[0]) {
        const g = games[0].game, numbers: WatchObservation["values"] = {};
        for (const row of games.filter(r=>r.game.gameId===g.gameId)) Object.assign(numbers,row.values);
        add({ ...b, eventDate:g.date, path:`/NPB/games/${encodeURIComponent(g.gameId)}` },"result","Game",{gameId:g.gameId,gameNumber:g.gameNumber,homeScore:g.homeScore??null,awayScore:g.awayScore??null,...numbers});
      }
      const r = recentRows.get(14), row = r?.players.find(p => p.playerId === target.id);
      if (r && row) recent({ ...b, coverage: r.coverage.status, generatedAt: r.generatedAt }, row.batting?.metrics ?? null, row.pitching?.metrics ?? null);
      const total = seasonAligned && totals?.coverage.status === "complete" ? totals.players.find(p => p.playerId === target.id) : null;
      if (total && totals) for (const c of total.checkpoints) add({ ...b, coverage: "complete" }, "milestone", c.metric, { value: c.count, step: seasonCheckpointSteps[c.metric] });
    }
    if (preferences.streaks && targets.players.length) notes.push("NPBの連続記録は全出場の完全性を確認できないためWatch判定しません。節目・Recentも各Coverage条件に従います。");
    if (targets.teams.length) {
      const manifest = await read(() => sources.gameSurface.manifest());
      if (manifest && manifest.effectiveDate === directory.effectiveDate) {
        // Three existing date indexes, never a season-wide scan.
        const dates = [0, 1, 2].map(n => new Date(Date.parse(`${manifest.effectiveDate}T00:00:00Z`) - n * 86400_000).toISOString().slice(0, 10));
        const pages = await Promise.all(dates.map(date => read(() => sources.gameSurface.date(date))));
        const games = pages.filter(p => p && p.generatedAt === manifest.generatedAt).flatMap(p => p!.games);
        const today = new Date(now + 9 * 3600_000).toISOString().slice(0,10);
        const futureDates = [today, new Date(Date.parse(`${today}T00:00:00Z`) + 86400_000).toISOString().slice(0,10)].filter(d=>d<=manifest.to && d>=manifest.from);
        const futurePages = await Promise.all(futureDates.map(d=>read(()=>sources.gameSurface.date(d))));
        const planned = futurePages.filter(p=>p && p.generatedAt===manifest.generatedAt).flatMap(p=>p!.games);
        for (const id of targets.teams) {
          const name = directory.teams.find(t => t.id === id)?.name; if (!name) continue;
          const g = games.filter(g => [g.home.id, g.away.id].includes(id) && g.status === "final").sort((a,c) => c.date.localeCompare(a.date) || c.gameNumber-a.gameNumber)[0];
          if (g) add({ ...base("team", id, name, season, manifest.effectiveDate, g.completeness === "complete" ? "complete" : "partial", manifest.generatedAt), eventDate: g.date, path: `/NPB/games/${encodeURIComponent(g.gameId)}` }, "result", "Game", { gameId: g.gameId, gameNumber: g.gameNumber, homeScore: g.home.score, awayScore: g.away.score });
          const next = planned.filter(g=>g.status==="scheduled" && [g.home.id,g.away.id].includes(id)).sort((a,c)=>a.date.localeCompare(c.date)||(a.scheduledTime??"99:99").localeCompare(c.scheduledTime??"99:99")||a.gameNumber-c.gameNumber)[0];
          if (next) add({...base("team",id,name,season,manifest.effectiveDate,"partial",manifest.generatedAt),eventDate:next.date},"next","予定",{gameId:next.gameId,date:next.date,scheduledTime:next.scheduledTime,opponent:next.home.id===id?next.away.name:next.home.name});
        }
        if (!planned.some(g=>g.status==="scheduled")) notes.push("現在の予定日程に次戦を確認できません。予定が公開されている場合だけ次戦を判定します。");
      } else if (manifest) notes.push("GameとDirectoryのeffectiveDateが異なるため球団の試合は判定しません。");
    }
    for (const v of targets.views) {
      const params = new URLSearchParams(v.conditions), days = Number(params.get("period")), p = recentRows.get(days);
      if (v.kind !== "data" || params.get("recentMode") === "selected" || params.has("recentPlayers") || params.get("competition") === "postseason" || (params.has("season") && Number(params.get("season")) !== season) || !p || p.coverage.status !== "complete" || explorerInputErrors(params).length) { notes.push(`「${v.name}」は全選手・完全なNPB Recent条件のみ検出できます。`); continue; }
      const query = explorerQuery(params), required = [...query.rules.map(r => r.metric), ...(query.minimum > 0 ? [query.sample!] : [])];
      if (p.players.some(row => required.some(key => row[query.role]?.metrics[key]?.status !== "complete" && row[query.role]))) { notes.push(`「${v.name}」は条件指標に未確認値があるため判定しません。`); continue; }
      const matching = exploreRows(p.players.map(row => ({ playerId: row.playerId, name: row.displayName, teamId: row.teamId, batting: row.batting?.metrics ?? null, pitching: row.pitching?.metrics ?? null })), query).map(r => r.playerId).sort();
      if (matching.length > 100) { notes.push(`「${v.name}」の一致が100人を超えるため、条件を絞ってください。`); continue; }
      observations.push({ key: `NPB:view:${v.id}:${watchFingerprint(v.conditions)}`, league, kind: "view", entityId: v.id, name: v.name, rule: "view", season, competition: "regular", effectiveDate: p.effectiveDate, generatedAt: p.generatedAt, eventDate: null, coverage: "complete", path: "/NPB/library?tab=views", metric: "matches", values: { count: matching.length }, members: matching, collectionOnly: false, observedAt: now });
    }
  } else {
    const manifest = await read(() => sources.historical<Manifest>("manifest.json"));
    const descriptor = manifest?.seasons.filter(s => s.coverage === "complete").sort((a,b) => b.season-a.season)[0];
    if (manifest && descriptor) {
      const { season, lastDate } = descriptor;
      const chronology = targets.players.length ? await read(() => sources.historical<HistoricalChronology>(`chronology/${season}.json`)) : null;
      const numbers = new Map(chronology?.games.map(g => [g.gameId, g.number]));
      const profiles = await boundedExplorerRead(targets.players.map(p => p.id), async id => { fetches++; return sources.historical<Profile>(`players/${id.replaceAll(":", "_")}.json`); });
      if (profiles.failed.length) notes.push(`${profiles.failed.length}選手のHistoricalデータを取得できません。`);
      for (const target of targets.players) {
        const profile = profiles.values.find(p => p.player.id === target.id); if (!profile) continue;
        const b = { ...base("player", target.id, profile.player.name, season, lastDate, "complete", null, target.collectionOnly), collectionMember: target.collectionMember }, bat = profile.batting.filter(r => r.season === season && r.date<=lastDate), pitch = profile.pitching.filter(r => r.season === season && r.date<=lastDate);
        const rows = [...bat.map(r => ({ gameId:r.gameId,date:r.date,H:r.hits,HR:r.homeRuns,PA:r.pa })), ...pitch.map(r => ({ gameId:r.gameId,date:r.date,outsRecorded:r.outsRecorded,ER:r.er,SO:r.so }))].sort((a,c) => c.date.localeCompare(a.date) || (numbers.get(c.gameId) ?? 0)-(numbers.get(a.gameId) ?? 0));
        const latest = rows[0], latestDay = rows.filter(r=>r.date===latest?.date), orderedLatest = latestDay.every(r=>numbers.has(r.gameId)) || new Set(latestDay.map(r=>r.gameId)).size<=1;
        if (latest && orderedLatest && (preferences.players || target.collectionMember)) {
          const result: WatchObservation["values"] = {};
          for (const row of latestDay.filter(r=>r.gameId===latest.gameId)) Object.assign(result,row);
          add({...b,eventDate:latest.date,path:`/MLB/games/${encodeURIComponent(latest.gameId)}?season=${season}`},"result","Game",{...result,gameNumber:numbers.get(latest.gameId)??0});
        } else if (latest && !orderedLatest) notes.push("Historical同日複数試合の順序を確認できず、最新試合判定を保留します。");
        const w = dateWindow(lastDate, 14);
        if (preferences.recent) recent(b, battingAggregate(target.id, bat, w.from,w.to).metrics, pitchingAggregate(target.id,pitch,w.from,w.to).metrics);
        if (preferences.milestones) { const total = profile.seasonTotals[String(season)]; if (total) milestones(b,total.batting,total.pitching); }
        if (chronology && chronology.season === season && chronology.competitionType === "regular" && [...bat,...pitch].every(r=>numbers.has(r.gameId)) && preferences.streaks) {
          const batting = buildBattingTrends(bat.map(r => ({ ...r, gameNumber: numbers.get(r.gameId) ?? null, walks:r.bb,hbp:r.hbp,sacrificeFlies:r.sf })), 5, true);
          const pitching = buildPitchingTrends(pitch.map(r => ({ ...r,gameNumber:numbers.get(r.gameId) ?? null,earnedRuns:r.er,strikeouts:r.so })), true);
          for (const [metric,s] of [["安打",batting?.hitting],["出塁",batting?.onBase],["無失点登板",pitching?.scoreless]] as const) if (s?.count !== null && s?.count !== undefined) add(b,"streak",metric,{value:s.count,atLeast:String(s.atLeast)});
        }
      }
      for (const id of preferences.teams ? targets.teams : []) {
        const team = await read(() => sources.historical<HistoricalTeamHub>(`teams/${season}/${id.replaceAll(":","_")}.json`));
        const name = manifest!.teams.find(t => t.id === id)?.name; if (!team || !name || team.teamId !== id || team.season !== season || team.competitionType !== "regular") continue;
        const g = [...team.games].sort((a,c)=>c.date.localeCompare(a.date)||c.number-a.number)[0];
        if (g) add({...base("team",id,name,season,team.effectiveDate,team.coverage),eventDate:g.date,path:`/MLB/games/${encodeURIComponent(g.gameId)}?season=${season}`},"result","Game",{gameId:g.gameId,gameNumber:g.number,homeScore:g.homeRuns,awayScore:g.awayRuns});
      }
      if (targets.teams.length && preferences.postseason) {
        const hub = await read(() => sources.historical<PostseasonHub>(`postseason/hub/${season}.json`));
        if (hub && hub.coverage === "complete" && hub.season === season) for (const s of hub.series) for (const team of s.teams.filter(t=>targets.teams.includes(t.teamId))) {
          const name = manifest!.teams.find(t=>t.id===team.teamId)?.name; if (!name) continue;
          add({...base("team",team.teamId,name,season,hub.effectiveDate,"complete",hub.generatedAt),competition:"postseason",path:`/MLB/postseason/series/${encodeURIComponent(s.id)}?season=${season}`},"series",s.round,{playedWins:team.playedWins,seriesTotal:team.seriesTotal,clinched:String(s.clinched),winner:s.winnerId ?? null},s.id);
        }
      }
    }
    if (targets.views.length) notes.push("MLB Historicalの保存条件Watchは未対応です。保存条件から再検索できます。");
    notes.push("MLBはHistorical。現在の出来事ではなく、保存データの確認差分です。");
  }
  return { observations, activeEntities, notes: [...new Set(notes)], fetches, targets: targets.players.length+targets.teams.length+targets.views.length, elapsedMs: performance.now()-started };
}

