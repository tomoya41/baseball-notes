import { normalizePlayerSearch } from "./npb-player-directory";

export type ExplorerMetric = { value: number | null; status?: "complete" | "partial" | "unavailable" };
export type ExplorerValues = Record<string, ExplorerMetric>;
export type ExplorerRow = { playerId: string; name: string; aliases?: string[]; teamId?: string | null; batting: ExplorerValues | null; pitching: ExplorerValues | null };
export const explorerMetrics = {
  batting: ["G", "PA", "AB", "H", "HR", "RBI", "BB", "SO", "SB", "AVG", "OBP", "SLG", "OPS", "K%", "BB%"],
  pitching: ["G", "GS", "outsRecorded", "BF", "H", "HR", "BB", "SO", "R", "ER", "W", "L", "SV", "HLD", "ERA", "K9", "WHIP", "BB9", "K%", "BB%"],
} as const;
export type ExplorerRole = keyof typeof explorerMetrics;
export type ExplorerRule = { metric: string; operator: "gte" | "lte"; value: number };
export type ExplorerSort = { metric: string; direction: "asc" | "desc" };
export type ExplorerQuery = { role: ExplorerRole; name: string; teamId: string; minimum: number; sample?: "G" | "PA" | "outsRecorded"; rules: ExplorerRule[]; sorts: ExplorerSort[] };
export const MAX_RECENT_PLAYERS = 12;
export function readableMetric(metric: ExplorerMetric | undefined): number | null {
  return metric?.status === "unavailable" || !Number.isFinite(metric?.value) ? null : metric!.value;
}
export function exploreRows(rows: readonly ExplorerRow[], query: ExplorerQuery): ExplorerRow[] {
  const needle = normalizePlayerSearch(query.name);
  const sampleKey = query.sample ?? (query.role === "batting" ? "PA" : "outsRecorded");
  return rows.filter(row => {
    const values = row[query.role];
    if (!values || (query.teamId && row.teamId !== query.teamId)) return false;
    if (needle && ![row.name, ...(row.aliases ?? [])].some(n => normalizePlayerSearch(n).includes(needle))) return false;
    const sample = readableMetric(values[sampleKey]);
    if (query.minimum > 0 && (sample === null || sample < query.minimum)) return false;
    return query.rules.every(rule => { const value = readableMetric(values[rule.metric]); return value !== null && (rule.operator === "gte" ? value >= rule.value : value <= rule.value); });
  }).sort((a, b) => {
    for (const sort of query.sorts) {
      const av = readableMetric(a[query.role]?.[sort.metric]), bv = readableMetric(b[query.role]?.[sort.metric]);
      if (av === null && bv !== null) return 1;
      if (av !== null && bv === null) return -1;
      if (av !== null && bv !== null && av !== bv) return sort.direction === "asc" ? av - bv : bv - av;
    }
    return a.name.localeCompare(b.name, "ja") || a.playerId.localeCompare(b.playerId);
  });
}
export function explorerQuery(params: URLSearchParams): ExplorerQuery {
  const role = params.get("role") === "pitching" ? "pitching" : "batting";
  const allowed: readonly string[] = explorerMetrics[role];
  const rules: ExplorerRule[] = [], sorts: ExplorerSort[] = [];
  for (const index of [1, 2]) {
    const metric = params.get(`metric${index}`), raw = params.get(`value${index}`);
    if (metric && allowed.includes(metric) && raw?.trim() && Number.isFinite(Number(raw)) && Number(raw) >= 0)
      rules.push({ metric, operator: params.get(`op${index}`) === "lte" ? "lte" : "gte", value: Number(raw) });
    const sort = params.get(`sort${index}`);
    if (sort && allowed.includes(sort) && !sorts.some(s => s.metric === sort)) sorts.push({ metric: sort, direction: params.get(`dir${index}`) === "asc" ? "asc" : "desc" });
  }
  const rawMinimum = params.get("minimum"), minimum = rawMinimum !== null && rawMinimum.trim() && Number.isFinite(Number(rawMinimum)) && Number(rawMinimum) >= 0 ? Number(rawMinimum) : 0;
  return { role, name: params.get("q") ?? "", teamId: params.get("team") ?? "", minimum, sample: params.get("sample") === "G" ? "G" : role === "batting" ? "PA" : "outsRecorded", rules, sorts };
}
export function selectedRecentPlayers(params: URLSearchParams, knownIds: ReadonlySet<string>) {
  return [...new Set((params.get("recentPlayers") ?? "").split(",").filter(id => knownIds.has(id)))].slice(0, MAX_RECENT_PLAYERS);
}
export async function boundedExplorerRead<T>(ids: readonly string[], read: (id: string) => Promise<T>): Promise<{ values: T[]; failed: string[] }> {
  if (ids.length > MAX_RECENT_PLAYERS) throw Error("Explicit bounded player selection required");
  const settled: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < ids.length; i += 3) settled.push(...await Promise.allSettled(ids.slice(i, i + 3).map(read)));
  return { values: settled.flatMap(r => r.status === "fulfilled" ? [r.value] : []), failed: settled.flatMap((r, i) => r.status === "rejected" ? [ids[i]!] : []) };
}

// Cache only within one immutable exploration context. Failed reads remain retryable.
export function cachedExplorerRead<T>(read: (id: string, days: 7 | 14 | 30) => Promise<T>) {
  const cache = new Map<string, Promise<T>>();
  return (id: string, days: 7 | 14 | 30): Promise<T> => {
    const key = `${id}:${days}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = read(id, days); cache.set(key, pending);
      void pending.catch(() => cache.delete(key));
    }
    return pending;
  };
}

export function explorerInputErrors(params: URLSearchParams): string[] {
  const errors: string[] = [];
  for (const index of [1, 2]) {
    if (!params.get(`metric${index}`)) continue;
    const raw = params.get(`value${index}`);
    if (!raw?.trim() || !Number.isFinite(Number(raw)) || Number(raw) < 0) errors.push(`条件${index}の数値を入力してください。`);
  }
  const minimum = params.get("minimum");
  if (minimum && (!Number.isFinite(Number(minimum)) || Number(minimum) < 0)) errors.push("最低サンプルは0以上の数値を指定してください。");
  return errors;
}
