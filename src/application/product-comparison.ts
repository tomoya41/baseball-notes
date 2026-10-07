import type { Services } from "../app/services";
import { readHistoricalProduct } from "../app/historical-products";
import { dateWindow } from "../domain/mlb-historical-aggregate";
import { shiftGameDate } from "../domain/npb-game-index";
import type { HistoricalTeamHub } from "../domain/team-hub";
import type { CompareMetrics } from "../domain/player-compare";
import type { ComparisonRow } from "../domain/product-comparison";

export async function boundedComparisonRead<T>(keys: readonly string[], read: (key: string) => Promise<T>): Promise<PromiseSettledResult<T>[]> {
  if (keys.length > 14) throw Error("Bounded comparison required");
  const values: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < keys.length; i += 3) values.push(...await Promise.allSettled(keys.slice(i, i + 3).map(read)));
  return values;
}
export function teamMetrics(input: { G: number; W: number; L: number; T: number; runsFor: number | null; runsAgainst: number | null; batting: CompareMetrics; pitching: CompareMetrics }, coverage: string): CompareMetrics {
  const metrics: CompareMetrics = {};
  for (const key of ["PA", "H", "HR", "AVG", "OPS"]) if (input.batting[key]) metrics[key] = input.batting[key]!;
  for (const key of ["outsRecorded", "SO", "ERA", "K9"]) if (input.pitching[key]) metrics[key] = input.pitching[key]!;
  for (const key of ["G", "W", "L", "T", "runsFor", "runsAgainst"] as const) metrics[key] = { value: input[key], status: input[key] === null ? "unavailable" : coverage === "complete" ? "complete" : "partial" };
  metrics.runDifference = { value: input.runsFor === null || input.runsAgainst === null ? null : input.runsFor - input.runsAgainst, status: metrics.runsFor!.status ?? "unavailable" };
  return metrics;
}
export async function readMlbTeamComparison(teamId: string, name: string, season: number, competition: "regular" | "postseason", view = "season"): Promise<ComparisonRow> {
  const hub = await readHistoricalProduct<HistoricalTeamHub>(`${competition === "postseason" ? "postseason/" : ""}teams/${season}/${teamId.replaceAll(":", "_")}.json`);
  if (hub.teamId !== teamId || hub.season !== season || hub.competitionType !== competition) throw Error("Team comparison context mismatch");
  const summary = view === "season" ? hub : hub.comparisonViews?.[view as keyof NonNullable<HistoricalTeamHub["comparisonViews"]>];
  return { id: teamId, name, season, date: hub.effectiveDate, coverage: hub.coverage, metrics: summary ? teamMetrics(summary, hub.coverage) : null,
    ...(!summary ? { notice: "この条件の球団集計は未公開です" } : "from" in summary ? { notice: `${summary.from}〜${summary.to}${view === "home" ? " · ホーム" : view === "away" ? " · アウェー" : ""}` } : {}) };
}
export async function readNpbTeamComparison(services: Services, view = "season") {
  const [catalog, season] = await Promise.all([services.product.catalog(), services.product.teamSeason(2026)]);
  if (catalog.effectiveDate !== season.effectiveDate || catalog.generatedAt !== season.generatedAt) throw Error("Team projection generation differs");
  if (view === "season") return catalog.teams.map(t => {
    const stats = season.teams.find(s => s.teamId === t.teamId);
    return { id: t.teamId, name: t.name, season: season.season, date: season.effectiveDate, coverage: season.coverage.status,
      metrics: stats ? teamMetrics(stats, season.coverage.status) : null } satisfies ComparisonRow;
  });
  if (view !== "14") throw Error("NPB team split unavailable");
  const manifest = await services.gameSurface.manifest();
  if (manifest.effectiveDate !== catalog.effectiveDate) throw Error("Team recent date differs");
  const { from, to } = dateWindow(catalog.effectiveDate, 14);
  const dates = Array.from({ length: 14 }, (_, i) => shiftGameDate(to, -i)).filter(d => d >= manifest.from);
  const pages = await boundedComparisonRead(dates, d => services.gameSurface.date(d));
  if (pages.some(p => p.status === "rejected")) throw Error("Recent team results incomplete");
  const ready = pages.flatMap(p => p.status === "fulfilled" ? [p.value] : []);
  if (ready.some(p => p.generatedAt !== manifest.generatedAt)) throw Error("Recent Game publication generation differs");
  const coverage = from >= manifest.from && ready.every(p => ["complete", "no_games"].includes(p.coverage)) ? "complete" : "partial";
  return catalog.teams.map(t => {
    const games = ready.flatMap(p => p.games).filter(g => g.status === "final" && [g.home.id, g.away.id].includes(t.teamId));
    let W = 0, L = 0, T = 0, runsFor = 0, runsAgainst = 0;
    const scoresKnown = games.every(g => g.home.score !== null && g.away.score !== null);
    for (const g of games) { const home = g.home.id === t.teamId, a = home ? g.home.score : g.away.score, b = home ? g.away.score : g.home.score; if (a === null || b === null) continue; runsFor += a; runsAgainst += b; if (a > b) W++; else if (a < b) L++; else T++; }
    const metrics = teamMetrics({ G: games.length, W, L, T, runsFor: scoresKnown ? runsFor : null, runsAgainst: scoresKnown ? runsAgainst : null, batting: {}, pitching: {} }, coverage);
    if (!scoresKnown) for (const k of ["W", "L", "T"]) metrics[k] = { value: null, status: "unavailable" };
    return { id: t.teamId, name: t.name, season: season.season, date: to, coverage, metrics, notice: `${from}〜${to} · 試合結果のみ。打撃・投球の期間集計は未対応` } satisfies ComparisonRow;
  });
}
