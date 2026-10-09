import { Link } from "react-router-dom";
import { useHistoricalCompetition } from "./historical-competition-context";
import type { HistoricalTeamHub } from "../domain/team-hub";
import type { HistoricalProductManifest } from "./player-compare";
import type { DatedBatter, DatedPitcher } from "../domain/mlb-historical-aggregate";
import { battingAggregate, pitchingAggregate } from "../domain/mlb-historical-aggregate";
import { shiftGameDate } from "../domain/npb-game-index";
import { DataState, LoadingSkeleton, SectionHeader } from "./components";
import { ScoreboardRow } from "./design-system";
import { useHistoricalStatic } from "./use-mlb-historical";
import type { useHistoricalDirectory } from "./use-mlb-historical";
import { TeamFavorite, type FavoriteActions } from "./team-favorite";
import { hasHistoricalPostseason, usePostseasonAvailability } from "./postseason-availability";
import type { HistoricalChronology } from "../domain/game-chronology";
import { buildBattingTrends, buildPitchingTrends } from "../domain/player-trends";

function HistoricalFavoriteTeam({ id, manifest, season, scope }: { id: string; manifest: HistoricalProductManifest; season: number; scope: string }) {
  const result = useHistoricalStatic<HistoricalTeamHub>(`teams/${season}/${id.replaceAll(":", "_")}.json`);
  const team = manifest.teams.find(t => t.id === id), value = result.value;
  const names = (teamId: string) => manifest.teams.find(t => t.id === teamId)?.name ?? "球団不明";
  return <article className="daily-team"><Link className="player-row" to={`/MLB/teams/${encodeURIComponent(id)}${scope}`}><strong>{team?.name ?? "球団情報未確認"}</strong><span>→</span></Link>
    {result.status === "loading" ? <LoadingSkeleton /> : value ? <><p className="inline-note">{season}年 · {value.effectiveDate}まで · {value.W}勝 {value.L}敗</p><div className="scoreboard-list">{value.games.slice(0, 2).map(g => <ScoreboardRow key={g.gameId} to={`/MLB/games/${encodeURIComponent(g.gameId)}${scope}`} home={names(g.homeTeamId)} away={names(g.awayTeamId)} homeScore={g.homeRuns} awayScore={g.awayRuns} date={g.date} status="過去の試合終了" gameNumber={g.number} partial={!g.complete} />)}</div></> : <p className="inline-note">この年の球団成績を読み込めません。</p>}
  </article>;
}
function HistoricalFavoriteRecent({ id, name, year, lastDate, chronology, complete, scope }: { id: string; name: string; year: number; lastDate: string; chronology: HistoricalChronology | null; complete: boolean; scope: string }) {
  const result = useHistoricalStatic<{ batting: DatedBatter[]; pitching: DatedPitcher[] }>(`players/${id.replaceAll(":", "_")}.json`);
  const rows = result.value;
  const bat = rows?.batting.filter(r => r.season === year && r.date <= lastDate) ?? [], pitch = rows?.pitching.filter(r => r.season === year && r.date <= lastDate) ?? [];
  const from = shiftGameDate(lastDate, -6), batting = rows && bat.length ? battingAggregate(id, bat, from, lastDate) : null, pitching = rows && pitch.length ? pitchingAggregate(id, pitch, from, lastDate) : null;
  const numbers = new Map(chronology?.games.map(g => [g.gameId, g.number]) ?? []);
  const dated = [...bat, ...pitch].sort((a, b) => b.date.localeCompare(a.date));
  const latestGames = [...new Map(dated.filter(r => r.date === dated[0]?.date).map(r => [r.gameId, r])).values()];
  const ordered = latestGames.map(r => ({ row: r, number: numbers.get(r.gameId) }));
  const last = latestGames.length === 1 ? latestGames[0] : ordered.every(r => r.number != null) && new Set(ordered.map(r => r.number)).size === ordered.length ? ordered.sort((a, b) => b.number! - a.number!)[0]?.row : null;
  const bats = buildBattingTrends(bat.map(r => ({ ...r, walks: r.bb, sacrificeFlies: r.sf, gameNumber: numbers.get(r.gameId) ?? null })), 5, complete);
  const pitchers = buildPitchingTrends(pitch.map(r => ({ ...r, earnedRuns: r.er, strikeouts: r.so, gameNumber: numbers.get(r.gameId) ?? null })), complete);
  const show = (v: { count: number | null; atLeast: boolean }) => v.count === null ? "未確定" : `${v.count}${v.atLeast ? "+" : ""}`;
  return <article className="daily-player"><Link className="player-row" to={`/MLB/players/${encodeURIComponent(id)}${scope}`}><strong>{name}</strong><span>→</span></Link>
    {result.status === "loading" ? <LoadingSkeleton /> : result.status !== "ready" ? <p className="inline-note">最近の成績を読み込めません。</p> : !dated.length ? <p className="inline-note">{year}年の出場記録は未収録です。</p> : <>
      <p className="inline-note">{year}年 · {from}〜{lastDate}の保存済み成績</p><div className="daily-numbers">{batting && <span>出場 {batting.games} · 安打 {batting.metrics.H?.value ?? "—"} · 本塁打 {batting.metrics.HR?.value ?? "—"}</span>}{pitching && <span>登板 {pitching.games} · 奪三振 {pitching.metrics.SO?.value ?? "—"} · 失点 {pitching.metrics.R?.value ?? "—"}</span>}</div>
      <p className="inline-note">{bat.length > 0 && `シーズン末尾 · 安打 ${show(bats.hitting)} / 出塁 ${show(bats.onBase)}`}{pitch.length > 0 && ` シーズン末尾 · 無失点登板 ${show(pitchers.scoreless)}`}</p><details><summary>連続数の範囲</summary><p>選択年の保存済み出場の末尾から数えます。出塁は安打＋四球＋死球。「+」は収録期間より前へ続く可能性。欠測や同日試合順の不明は未確定。公式連続試合記録・現在の状態を表しません。</p></details>
      <div className="daily-links">{last ? <Link to={`/MLB/games/${encodeURIComponent(last.gameId)}${scope}`}>最終出場日 {last.date}の収録試合</Link> : <span className="inline-note">最終出場日の試合順は未確認です。</span>}<Link to={`/MLB/players/${encodeURIComponent(id)}/trends${scope}`}>推移・連続記録</Link></div>
    </>}
  </article>;
}
export function MlbPersonalDashboard({ manifest, season, directory, compact = false, ...actions }: FavoriteActions & { manifest: HistoricalProductManifest; season: number; directory: Pick<ReturnType<typeof useHistoricalDirectory>, "status" | "value">; compact?: boolean }) {
  const availability = usePostseasonAvailability();
  const competition = useHistoricalCompetition();
  const scope = `?season=${season}${competition === "postseason" ? "&competition=postseason" : ""}`;
  const selected = manifest.seasons.find(s => s.season === season);
  const teams = actions.favorites.filter(f => f.league === "MLB" && f.kind === "team"), players = actions.favorites.filter(f => f.league === "MLB" && f.kind === "player");
  const chronology = useHistoricalStatic<HistoricalChronology>(selected && !compact && players.length ? `chronology/${season}.json` : null);
  if (!selected) return <DataState kind="unsupported" title="この年は未収録です。Currentの試合・成績は未対応です。" />;
  return <>
    <section className="home-section"><SectionHeader title="フォロー球団" action="球団を探す" to={`/MLB/teams${scope}`} /><p className="inline-note">{season}年の{competition === "postseason" ? "Postseason" : "Regular Season"}過去記録。現在の試合・次戦ではありません。</p>
      {!teams.length ? !compact && <p className="inline-note">球団ページの★から追加できます。</p> : <>{!compact && <div className="row-list">{teams.map(f => { const t = manifest.teams.find(t => t.id === f.entityId); return <div className="surface-favorite" key={f.entityId}><Link className="player-row" to={`/MLB/teams/${encodeURIComponent(f.entityId)}${scope}`}>{t?.name ?? "球団情報未確認"}</Link><TeamFavorite league="MLB" teamId={f.entityId} name={t?.name ?? "登録済み球団"} {...actions} /></div>; })}</div>}{teams.filter(f => manifest.teams.some(t => t.id === f.entityId)).slice(0, compact ? 1 : 4).map(f => <HistoricalFavoriteTeam key={`${f.entityId}:${season}`} id={f.entityId} manifest={manifest} season={season} scope={scope} />)}{teams.length > (compact ? 1 : 4) && <p className="inline-note">試合表示は先頭{compact ? 1 : 4}球団。全お気に入りはMyの一覧へ。</p>}</>}
    </section>
    {!compact && <section className="home-section"><SectionHeader title="フォロー選手の直近成績" action="選手を探す" to={`/MLB/search${scope}`} />{directory.status === "loading" ? <LoadingSkeleton /> : !players.length ? <p className="inline-note">選手の★からフォローできます。</p> : players.slice(0, 4).map(f => { const p = directory.value?.players.find(p => p.id === f.entityId); return p?.postseasonOnly && competition !== "postseason" ? <p key={f.entityId}>{p.name} · Postseasonのみ収録。下の選手一覧から確認できます。</p> : p ? <HistoricalFavoriteRecent key={`${p.id}:${season}`} id={p.id} name={p.name} year={season} lastDate={selected.lastDate} chronology={chronology.value} complete={selected.coverage === "complete"} scope={scope} /> : <p key={f.entityId}>登録済み選手の情報を確認できません。</p>; })}{players.length > 4 && <p className="inline-note">直近成績は先頭4選手。全お気に入りは一覧から確認できます。</p>}</section>}
    {!compact && hasHistoricalPostseason(availability, season) && <Link className="text-link" to={`/MLB/postseason?season=${season}`}>{season} Postseason · 勝ち上がり・Series →</Link>}
  </>;
}
