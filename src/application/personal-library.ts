import { z } from "zod";
import type { SettingsStore } from "./ports";
import type { League } from "../domain/models";
import { viewConditions } from "../domain/portable-conditions";
export { viewConditions } from "../domain/portable-conditions";

const league = z.enum(["NPB", "MLB"]), id = z.string().min(1).max(160).regex(/^[a-zA-Z0-9:_-]+$/);
export const libraryTargetSchema = z.strictObject({ league, playerId: id }).refine(p =>
  (p.league === "NPB" ? /^[0-9a-f-]{36}$/i : /^mlb:player:[0-9a-f-]{36}$/i).test(p.playerId), "Canonical player/league mismatch");
export type LibraryPlayer = z.infer<typeof libraryTargetSchema>;
const viewSchema = z.strictObject({ id, name: z.string().trim().min(1).max(60), league, kind: z.enum(["data", "history"]), conditions: z.string().max(6000), savedAt: z.number().finite() });
const collectionSchema = z.strictObject({ id, name: z.string().trim().min(1).max(60), players: z.array(libraryTargetSchema).max(100), updatedAt: z.number().finite() });
const activitySchema = z.strictObject({ league, kind: z.enum(["players", "teams", "games", "series", "data", "history"]), entityId: id.nullable(), conditions: z.string().max(6000), visitedAt: z.number().finite() });
const schema = z.strictObject({ version: z.literal(1), views: z.array(viewSchema).max(20), collections: z.array(collectionSchema).max(20), activity: z.array(activitySchema).max(60) });
export type PersonalState = z.infer<typeof schema>;
export type Activity = PersonalState["activity"][number];
const empty = (): PersonalState => ({ version: 1, views: [], collections: [], activity: [] });
export const PERSONAL_LIBRARY_KEY = "baseball:personal-library:v1";
const MAX_AGE = 90 * 86400000;
export function activityFromRoute(path: string, search: string, now: number): Activity | null {
  const [l, resource, rawId] = path.split("/").filter(Boolean), parsedLeague = league.safeParse(l);
  if (!parsedLeague.success) return null;
  let entityId: string | null = null, kind: Activity["kind"];
  if (resource === "data" || resource === "history") kind = resource;
  else {
    if (resource === "postseason") { kind = "series"; if (rawId !== "series") return null; }
    else if (resource === "players" || resource === "teams" || resource === "games") kind = resource;
    else return null;
    try { entityId = decodeURIComponent(resource === "postseason" ? path.split("/")[4] ?? "" : rawId ?? ""); } catch { return null; }
    if (!id.safeParse(entityId).success) return null;
    const prefix = parsedLeague.data === "MLB" ? `mlb:${kind === "players" ? "player" : kind === "teams" ? "team" : kind === "games" ? "game" : "series"}:` : kind === "players" ? "" : `npb:${kind === "teams" ? "team" : "game"}:`;
    if (!entityId.startsWith(prefix) || (kind === "players" && parsedLeague.data === "NPB" && !/^[0-9a-f-]{36}$/i.test(entityId))) return null;
  }
  const params = new URLSearchParams(search);
  // Activity never stores search text or Explorer cohorts; saving these requires an explicit Saved View.
  params.delete("recentPlayers");
  return { league: parsedLeague.data, kind, entityId, conditions: viewConditions(params, false), visitedAt: now };
}
export function activityPath(item: Activity): string {
  return `/${item.league}/${item.kind === "series" ? "postseason/series" : item.kind}${item.entityId ? `/${encodeURIComponent(item.entityId)}` : ""}${item.conditions ? `?${item.conditions}` : ""}`;
}
export class PersonalLibrary {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly storage: SettingsStore, private readonly now: () => number = Date.now, private readonly uuid: () => string = () => crypto.randomUUID()) {}
  async read(): Promise<PersonalState> {
    const raw = await this.storage.get(PERSONAL_LIBRARY_KEY); if (!raw) return empty();
    let value: unknown; try { value = JSON.parse(raw); } catch { throw Error("保存データが破損しています。リセットまで保持します。"); }
    // Version 0 used the same explicit item structures before Activity was introduced.
    if (value && typeof value === "object" && "version" in value && value.version === 0) value = { ...value, version: 1, activity: [] };
    const result = schema.safeParse(value); if (!result.success) throw Error("保存データの形式を読み込めません。リセットまで保持します。");
    const data = result.data;
    return { ...data, activity: data.activity.filter(a => a.visitedAt <= this.now() && a.visitedAt >= this.now() - MAX_AGE).slice(0, 60),
      views: data.views.map(v => ({ ...v, conditions: viewConditions(new URLSearchParams(v.conditions)) })),
      collections: data.collections.map(c => ({ ...c, players: c.players.filter((p, i, all) => all.findIndex(x => x.league === p.league && x.playerId === p.playerId) === i) })) };
  }
  private change(update: (s: PersonalState) => PersonalState, reset = false): Promise<PersonalState> {
    const work = this.queue.then(async () => {
      const next = schema.parse(update(reset ? empty() : await this.read()));
      const json = JSON.stringify(next); if (json.length > 250000) throw Error("保存容量の上限に達しました。");
      await this.storage.set(PERSONAL_LIBRARY_KEY, json); return next;
    }); this.queue = work.catch(() => undefined); return work;
  }
  reset() { return this.change(empty, true); }
  visit(item: Activity) { return this.change(s => ({ ...s, activity: [item, ...s.activity.filter(a => !(a.league === item.league && a.kind === item.kind && a.entityId === item.entityId && a.conditions === item.conditions))].slice(0, 60) })); }
  clearActivity() { return this.change(s => ({ ...s, activity: [] })); }
  saveView(name: string, l: League, kind: "data" | "history", params: URLSearchParams) {
    return this.change(s => { if (s.views.length >= 20) throw Error("保存した条件は20件までです。"); return { ...s, views: [viewSchema.parse({ id: this.uuid(), name, league: l, kind, conditions: viewConditions(params), savedAt: this.now() }), ...s.views] }; });
  }
  removeView(viewId: string) { return this.change(s => ({ ...s, views: s.views.filter(v => v.id !== viewId) })); }
  createCollection(name: string) { return this.change(s => { if (s.collections.length >= 20) throw Error("コレクションは20個までです。"); return { ...s, collections: [...s.collections, collectionSchema.parse({ id: this.uuid(), name, players: [], updatedAt: this.now() })] }; }); }
  renameCollection(collectionId: string, name: string) { return this.change(s => ({ ...s, collections: s.collections.map(c => c.id === collectionId ? collectionSchema.parse({ ...c, name, updatedAt: this.now() }) : c) })); }
  removeCollection(collectionId: string) { return this.change(s => ({ ...s, collections: s.collections.filter(c => c.id !== collectionId) })); }
  setPlayer(collectionId: string, target: LibraryPlayer, add: boolean) { return this.change(s => ({ ...s, collections: s.collections.map(c => {
    if (c.id !== collectionId) return c;
    const players = c.players.filter(p => p.league !== target.league || p.playerId !== target.playerId);
    return { ...c, players: add ? [...players, libraryTargetSchema.parse(target)] : players, updatedAt: this.now() };
  }) })); }
}
