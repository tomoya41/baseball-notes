import { z } from "zod";
import { favoriteSchema, type Favorite } from "../domain/models";
import { canonicalEntityRefSchema } from "../domain/cross-league";
import { viewConditions } from "../domain/portable-conditions";
import { watchPreferencesSchema, type PersonalWatchState } from "../domain/personal-watch";
import { Favorites } from "./favorites";
import { PersonalLibrary, personalLibrarySchema, activityFromRoute, activityPath, type PersonalState } from "./personal-library";
import { PersonalWatch } from "./personal-watch";
import { PERSONAL_KEYS, PersonalSettingsStore } from "./personal-settings";
import type { SettingsStore } from "./ports";

export const PERSONAL_BACKUP_MAX_BYTES = 1_000_000;
const favorite = favoriteSchema.strict().refine(v => canonicalEntityRefSchema.safeParse({ league: v.league, kind: v.kind, id: v.entityId }).success);
const dataSchema = z.strictObject({ favorites: z.array(favorite).max(2000), library: personalLibrarySchema, watch: watchPreferencesSchema });
const bodySchema = z.strictObject({ format: z.literal("baseball-notes-personal-backup"), version: z.literal(1), createdAt: z.iso.datetime(), data: dataSchema });
const fileSchema = bodySchema.extend({ checksum: z.string().regex(/^[0-9a-f]{64}$/) });
type Body = z.infer<typeof bodySchema>;
type Data = z.infer<typeof dataSchema>;
type Current = Data & { watchState: PersonalWatchState };
export type RestoreMode = "merge" | "replace";
export type BackupCounts = { favorites: number; collections: number; views: number; activity: number };
export type RestorePreview = { token: string; createdAt: string; mode: RestoreMode; before: BackupCounts; after: BackupCounts; expiredActivity: number };
const counts = (v: Data): BackupCounts => ({ favorites: v.favorites.length, collections: v.library.collections.length, views: v.library.views.length, activity: v.library.activity.length });
const ref = (v: Favorite) => `${v.league}:${v.kind}:${v.entityId}`;
const member = (v: { league: string; playerId: string }) => `${v.league}:${v.playerId}`;
const digest = async (v: unknown) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(v))))].map(b => b.toString(16).padStart(2, "0")).join("");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const valid = (ok: boolean) => { if (!ok) throw Error("バックアップの形式や保存内容を確認できません。"); };

function validateData(data: Data, now: number) {
  valid(new Set(data.favorites.map(ref)).size === data.favorites.length);
  valid(data.favorites.every(f => Date.parse(f.addedAt) <= now + 300_000));
  for (const group of [data.library.views, data.library.collections]) valid(new Set(group.map(v => v.id)).size === group.length);
  for (const v of data.library.views) {
    valid(v.savedAt >= 0 && v.savedAt <= now + 300_000 && viewConditions(new URLSearchParams(v.conditions)) === v.conditions);
  }
  for (const c of data.library.collections) {
    valid(c.updatedAt >= 0 && c.updatedAt <= now + 300_000);
    valid(new Set(c.players.map(member)).size === c.players.length);
    valid(c.players.every(p => canonicalEntityRefSchema.safeParse({ league: p.league, kind: "player", id: p.playerId }).success));
  }
  for (const a of data.library.activity) {
    const path = activityPath(a), parsed = activityFromRoute(path.split("?")[0]!, path.split("?")[1] ?? "", a.visitedAt);
    valid(a.visitedAt >= 0 && a.visitedAt <= now + 300_000 && !!parsed && parsed.conditions === a.conditions);
    if (a.kind === "players" || a.kind === "teams" || a.kind === "games") valid(canonicalEntityRefSchema.safeParse({ league: a.league, kind: a.kind === "players" ? "player" : a.kind === "teams" ? "team" : "game", id: a.entityId }).success);
  }
  valid(JSON.stringify(data.library).length <= 250000);
}
async function current(view: SettingsStore, now: number): Promise<Current> {
  const [favorites, library, watchState] = await Promise.all([new Favorites(view, () => now).list(), new PersonalLibrary(view, () => now).read(), new PersonalWatch(view, () => now).read()]);
  const data = dataSchema.parse({ favorites, library, watch: watchState.preferences }); validateData(data, now);
  return { ...data, watchState };
}
function merged(destination: Data, incoming: Data, uuid: () => string): Data {
  const favorites = [...destination.favorites, ...incoming.favorites.filter(f => !destination.favorites.some(v => ref(v) === ref(f)))];
  const collections = structuredClone(destination.library.collections), views = structuredClone(destination.library.views);
  for (const c of incoming.library.collections) {
    const exact = collections.some(v => v.name === c.name && same(v.players.map(member).sort(), c.players.map(member).sort())); if (exact) continue;
    const old = collections.find(v => v.id === c.id);
    if (old?.name === c.name) { old.players = [...old.players, ...c.players.filter(p => !old.players.some(v => member(v) === member(p)))]; old.updatedAt = Math.max(old.updatedAt, c.updatedAt); }
    else collections.push({ ...structuredClone(c), id: old ? uuid() : c.id });
  }
  for (const v of incoming.library.views) {
    if (views.some(old => old.name === v.name && old.league === v.league && old.kind === v.kind && old.conditions === v.conditions)) continue;
    views.push({ ...v, id: views.some(old => old.id === v.id) ? uuid() : v.id });
  }
  const activityKey = (a: PersonalState["activity"][number]) => JSON.stringify([a.league, a.kind, a.entityId, a.conditions]);
  const activity = [...destination.library.activity, ...incoming.library.activity].sort((a, b) => b.visitedAt - a.visitedAt).filter((a, i, rows) => rows.findIndex(v => activityKey(v) === activityKey(a)) === i).slice(0, 60);
  return { favorites, library: { version: 1, collections, views, activity }, watch: destination.watch };
}

/** Files contain user selections only; no statistical observations, alerts, caches or device tokens. */
export class PersonalBackup {
  private plans = new Map<string, { before: string; next: Data; preview: RestorePreview; expiresAt: number }>();
  private generation = 0;
  constructor(private readonly store: PersonalSettingsStore, private readonly now: () => number = Date.now, private readonly uuid = () => crypto.randomUUID()) {}
  async export(): Promise<{ text: string; filename: string }> {
    const now = this.now(), state = await this.store.snapshot(view => current(view, now));
    const body: Body = { format: "baseball-notes-personal-backup", version: 1, createdAt: new Date(now).toISOString(), data: { favorites: state.favorites, library: state.library, watch: state.watch } };
    const text = JSON.stringify({ ...body, checksum: await digest(body) }, null, 2);
    if (new TextEncoder().encode(text).length > PERSONAL_BACKUP_MAX_BYTES) throw Error("保存内容がファイルの上限（1MB）を超えています。");
    return { text, filename: `baseball-notes-backup-${body.createdAt.slice(0, 10)}.json` };
  }
  async preview(text: string, mode: RestoreMode): Promise<RestorePreview> {
    const generation = ++this.generation; this.plans.clear();
    if (!text || new TextEncoder().encode(text).length > PERSONAL_BACKUP_MAX_BYTES || !["merge", "replace"].includes(mode)) throw Error("1MB以内のバックアップファイルを選んでください。");
    let parsed: z.infer<typeof fileSchema>;
    try { parsed = fileSchema.parse(JSON.parse(text.replace(/^\uFEFF/, ""))); } catch { throw Error("Baseball Notesの対応するバックアップ形式ではありません。"); }
    const { checksum, ...body } = parsed; valid(checksum === await digest(body));
    const now = this.now(); valid(Date.parse(body.createdAt) <= now + 300_000); validateData(body.data, now);
    const activity = body.data.library.activity.filter(a => a.visitedAt >= now - 90 * 86400000);
    const incoming = { ...body.data, library: { ...body.data.library, activity } };
    const before = await this.store.snapshot(view => current(view, now));
    let next: Data;
    try { next = dataSchema.parse(mode === "replace" ? incoming : merged(before, incoming, this.uuid)); validateData(next, now); }
    catch { throw Error("追加後の保存件数が上限を超えるか、内容が一致しません。置き換えを選ぶか保存内容を整理してください。"); }
    const token = this.uuid(), preview = { token, createdAt: body.createdAt, mode, before: counts(before), after: counts(next), expiredActivity: body.data.library.activity.length - activity.length };
    const fingerprint = await digest(before);
    if (generation !== this.generation) throw Error("別のファイルを確認中です。");
    this.plans.set(token, { before: fingerprint, next, preview, expiresAt: now + 300000 });
    return structuredClone(preview);
  }
  cancel() { this.generation++; this.plans.clear(); }
  async restore(token: string): Promise<void> {
    const plan = this.plans.get(token); this.generation++; this.plans.clear();
    if (!plan || this.now() > plan.expiresAt) throw Error("確認の有効期限が切れました。ファイルをもう一度選んでください。");
    await this.store.transaction(async view => {
      const before = await current(view, this.now());
      if (await digest(before) !== plan.before) throw Error("確認後に保存内容が変更されました。もう一度取り込み内容を確認してください。");
      const next = plan.next, changed = !same({ favorites: before.favorites, library: before.library, watch: before.watch }, next);
      const watch = changed ? { ...before.watchState, preferences: next.watch, observations: [], checkedAt: null } : before.watchState;
      await view.set(PERSONAL_KEYS.favorites, JSON.stringify({ version: 1, items: next.favorites }));
      await view.set(PERSONAL_KEYS.library, JSON.stringify(next.library));
      await view.set(PERSONAL_KEYS.watch, JSON.stringify(watch));
    }, true);
  }
}
