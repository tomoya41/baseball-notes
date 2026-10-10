import { z } from "zod";
import { canonicalEntityRefSchema } from "./cross-league";
import { portableRoute } from "./product-sharing";

// In-app observations are unrelated to the future live WATCH/provider contract.
export const WATCH_LIMITS = { players: 12, teams: 4, views: 6, observations: 240, alerts: 100, seen: 800, bytes: 300_000 } as const;
export const watchPreferencesSchema = z.strictObject({ players: z.boolean(), teams: z.boolean(), recent: z.boolean(), streaks: z.boolean(), milestones: z.boolean(), postseason: z.boolean(), collections: z.boolean(), savedViews: z.boolean() });
export type WatchPreferences = z.infer<typeof watchPreferencesSchema>;
export const defaultWatchPreferences = (): WatchPreferences => ({ players: true, teams: true, recent: false, streaks: true, milestones: true, postseason: true, collections: false, savedViews: false });
const rule = z.enum(["result", "next", "recent", "streak", "milestone", "series", "view"]);
const values = z.record(z.string().max(40), z.union([z.number().finite(), z.string().max(180), z.null()])).refine(v => Object.keys(v).length <= 20);
export const watchObservationSchema = z.strictObject({
  key: z.string().min(1).max(280), league: z.enum(["NPB", "MLB"]), kind: z.enum(["player", "team", "view"]), entityId: z.string().min(1).max(160),
  name: z.string().min(1).max(120), rule, season: z.number().int().min(2016).max(2100), competition: z.enum(["regular", "postseason"]),
  effectiveDate: z.iso.date(), generatedAt: z.iso.datetime().nullable(), eventDate: z.iso.date().nullable(),
  coverage: z.enum(["complete", "partial", "unknown", "unavailable"]),
  path: z.string().max(700), metric: z.string().max(40), values,
  members: z.array(z.string().max(160)).max(100).optional(), collectionOnly: z.boolean(), collectionMember: z.boolean().optional(), observedAt: z.number().finite().nonnegative(),
}).superRefine((o, c) => {
  if (o.kind === "view" ? !/^[a-zA-Z0-9:_-]+$/.test(o.entityId) : !canonicalEntityRefSchema.safeParse({ league: o.league, kind: o.kind, id: o.entityId }).success)
    c.addIssue({ code: "custom", message: "Watch canonical identity mismatch" });
  const [p, query] = o.path.split("?");
  if (o.kind !== "view" && (!portableRoute(p!, query ?? "") || !o.path.startsWith(`/${o.league}/`))) c.addIssue({ code: "custom", message: "Invalid Watch route" });
  if (o.kind === "view" && o.path !== `/${o.league}/library?tab=views`) c.addIssue({ code: "custom", message: "Private view route required" });
  if (o.members?.some(id => !canonicalEntityRefSchema.safeParse({ league: o.league, kind: "player", id }).success)) c.addIssue({ code: "custom", message: "Invalid matching player" });
  if (o.rule !== "next" && o.eventDate && o.eventDate > o.effectiveDate) c.addIssue({ code: "custom", message: "Future result observation" });
  if (o.league === "NPB" && o.competition !== "regular") c.addIssue({ code: "custom", message: "Current Postseason not admitted" });
  if (!o.effectiveDate.startsWith(String(o.season))) c.addIssue({ code: "custom", message: "Watch Season/date mismatch" });
  let decodedPath = ""; try { decodedPath = decodeURIComponent(p!); } catch { /* A corrupt route remains invalid, not an exception from safeParse. */ }
  if (o.rule === "result" && (!canonicalEntityRefSchema.safeParse({ league: o.league, kind: "game", id: o.values.gameId }).success || decodedPath.split("/")[3] !== o.values.gameId)) c.addIssue({ code: "custom", message: "Canonical result Game link required" });
});
export type WatchObservation = z.infer<typeof watchObservationSchema>;
export const watchAlertSchema = z.strictObject({ id: z.string().max(360), observation: watchObservationSchema, previous: values, title: z.string().max(180), priority: z.enum(["high", "normal", "low"]), createdAt: z.number().finite().nonnegative(), read: z.boolean(), dismissed: z.boolean() });
export type WatchAlert = z.infer<typeof watchAlertSchema>;
export const watchStateSchema = z.strictObject({ schemaVersion: z.literal(1), preferences: watchPreferencesSchema,
  observations: z.array(watchObservationSchema).max(WATCH_LIMITS.observations), alerts: z.array(watchAlertSchema).max(WATCH_LIMITS.alerts), seen: z.array(z.string().max(360)).max(WATCH_LIMITS.seen), checkedAt: z.number().finite().nonnegative().nullable() });
export type PersonalWatchState = z.infer<typeof watchStateSchema>;
export const emptyWatchState = (): PersonalWatchState => ({ schemaVersion: 1, preferences: defaultWatchPreferences(), observations: [], alerts: [], seen: [], checkedAt: null });
export function watchFingerprint(value: unknown): string {
  // A compact content key, never a projection generatedAt (regeneration isn't an event).
  const s = JSON.stringify(value); let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}
export function watchEnabled(o: WatchObservation, p: WatchPreferences): boolean {
  if (o.kind === "view") return p.savedViews;
  if (o.collectionOnly && !p.collections) return false;
  return o.rule === "recent" ? p.recent : o.rule === "streak" ? p.streaks : o.rule === "milestone" ? p.milestones : o.rule === "series" ? p.postseason : o.kind === "team" ? p.teams : p.players || ((o.collectionOnly || o.collectionMember === true) && p.collections);
}
export function watchFresh(o: WatchObservation, now: number): boolean {
  const today = new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
  if (o.generatedAt && (Date.parse(o.generatedAt) > now + 300_000 || new Date(Date.parse(o.generatedAt)+9*3600_000).toISOString().slice(0,10) < o.effectiveDate)) return false;
  if (o.league === "MLB") return o.season >= 2016 && o.season <= 2025 && o.effectiveDate.startsWith(String(o.season));
  return o.effectiveDate <= today && Date.parse(`${today}T00:00:00Z`) - Date.parse(`${o.effectiveDate}T00:00:00Z`) <= 3 * 86400_000;
}
function changed(old: WatchObservation, next: WatchObservation): { title: string; priority: WatchAlert["priority"] } | null {
  if (watchFingerprint([old.values, old.members]) === watchFingerprint([next.values, next.members])) return null;
  if (next.rule === "recent") {
    const before = old.values.value, after = next.values.value, sample = next.metric === "OPS" ? 20 : 9;
    if (old.coverage !== "complete" || next.coverage !== "complete" || typeof before !== "number" || typeof after !== "number" ||
      typeof old.values.sample !== "number" || typeof next.values.sample !== "number" || Math.min(old.values.sample, next.values.sample) < sample ||
      Math.abs(after - before) + 1e-10 < (next.metric === "OPS" ? next.collectionOnly ? 0.1 : 0.05 : next.collectionOnly ? 1.5 : 1)) return null;
    return { title: `保存済み14日${next.metric}が変化`, priority: "low" };
  }
  if (next.rule === "streak") {
    if (old.coverage !== "complete" || next.coverage !== "complete" || old.values.atLeast !== "false" || next.values.atLeast !== "false" ||
      typeof old.values.value !== "number" || typeof next.values.value !== "number" || old.values.value === next.values.value) return null;
    return { title: "保存済み出場の連続記録が変化", priority: "normal" };
  }
  if (next.rule === "milestone") {
    const before = old.values.value, after = next.values.value, step = next.values.step;
    if (old.coverage !== "complete" || next.coverage !== "complete" || typeof before !== "number" || typeof after !== "number" || typeof step !== "number" || after <= before) return null;
    const threshold = (Math.floor(before / step) + 1) * step;
    return after >= threshold ? { title: `保存済みSeason ${next.metric}が${threshold}に到達`, priority: "high" }
      : threshold - after <= 5 ? { title: `保存済みSeason ${next.metric} ${threshold}まで残り${threshold - after}`, priority: "low" } : null;
  }
  if (next.rule === "view") {
    if (old.coverage !== "complete" || next.coverage !== "complete") return null;
    const added = next.members?.filter(id => !old.members?.includes(id)) ?? [];
    return added.length ? { title: `保存条件に新しく${added.length}人が一致`, priority: "normal" } : null;
  }
  if (next.rule === "result") {
    if (next.eventDate && old.eventDate && (next.eventDate < old.eventDate || (next.eventDate === old.eventDate && Number(next.values.gameNumber) < Number(old.values.gameNumber)))) return null;
    return { title: old.values.gameId === next.values.gameId ? "保存済み試合記録の数値が変化" : "新しく確認できた試合記録", priority: "normal" };
  }
  return next.rule === "series" ? { title: "保存済みPostseason Seriesの状態が変化", priority: next.values.clinched === "true" ? "high" : "normal" }
    : { title: "保存済みの次戦予定が変化", priority: "low" };
}
export function evaluateWatch(state: PersonalWatchState, input: readonly WatchObservation[], now: number): PersonalWatchState {
  if (input.length > WATCH_LIMITS.observations) throw Error("Watch observation limit");
  if (new Set(input.map(o => o.key)).size !== input.length) throw Error("Duplicate Watch observation");
  const previous = new Map(state.observations.map(o => [o.key, o])), alerts = [...state.alerts], seen = new Set(state.seen);
  for (const raw of input) {
    const next = watchObservationSchema.parse(raw);
    if (!watchFresh(next, now) || next.observedAt > now || next.observedAt < now-90*86400_000 || ["unavailable", "unknown"].includes(next.coverage)) continue;
    const old = previous.get(next.key);
    if (old && ["league", "kind", "entityId", "rule", "season", "competition", "metric"].some(k => old[k as keyof WatchObservation] !== next[k as keyof WatchObservation])) throw Error("Watch scope collision");
    // Rollbacks and stale cached generations never replace the newer baseline.
    if (old && (next.effectiveDate < old.effectiveDate || (next.generatedAt && old.generatedAt && next.generatedAt < old.generatedAt) || (next.rule === "result" && old.eventDate && next.eventDate && (next.eventDate < old.eventDate || (next.eventDate === old.eventDate && Number(next.values.gameNumber) < Number(old.values.gameNumber)))))) continue;
    previous.set(next.key, next);
    const id = `${next.key}:${watchFingerprint([next.values, next.members])}`, alreadySeen = seen.has(id);
    seen.add(id);
    if (!old || !watchEnabled(next, state.preferences)) continue; // first observation / re-enable = baseline only
    const change = changed(old, next); if (!change) continue;
    if (alreadySeen) continue;
    alerts.unshift({ id, observation: next, previous: old.values, ...change, createdAt: now, read: false, dismissed: false });
  }
  const maxAge = now - 90 * 86400_000;
  return { ...state, checkedAt: now, observations: [...previous.values()].filter(o => o.observedAt >= maxAge).sort((a, b) => b.observedAt - a.observedAt).slice(0, WATCH_LIMITS.observations), alerts: alerts.filter(a => a.createdAt >= maxAge).slice(0, WATCH_LIMITS.alerts), seen: [...seen].slice(-WATCH_LIMITS.seen) };
}
