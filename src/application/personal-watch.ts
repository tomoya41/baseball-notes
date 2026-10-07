import type { SettingsStore } from "./ports";
import { emptyWatchState, evaluateWatch, WATCH_LIMITS, watchStateSchema, watchPreferencesSchema, type PersonalWatchState, type WatchObservation, type WatchPreferences } from "../domain/personal-watch";
export const PERSONAL_WATCH_KEY = "baseball:personal-watch:v1";
export class PersonalWatch {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly storage: SettingsStore, private readonly now: () => number = Date.now) {}
  async read(): Promise<PersonalWatchState> {
    const raw = await this.storage.get(PERSONAL_WATCH_KEY); if (!raw) return emptyWatchState();
    try {
      let value: unknown = JSON.parse(raw);
      if (value && typeof value === "object" && "schemaVersion" in value && value.schemaVersion === 0) value = { ...value, schemaVersion: 1, seen: [], checkedAt: null };
      const state = watchStateSchema.parse(value);
      // A v0 read-state migration also seeds dedup from retained alerts.
      return { ...state, seen: [...new Set([...state.seen, ...state.alerts.map(a => a.id)])].slice(-WATCH_LIMITS.seen) };
    } catch { throw Error("Watchの保存形式を読み込めません。他の保存内容は維持しています。Watchのみリセットできます。"); }
  }
  private change(update: (state: PersonalWatchState) => PersonalWatchState, reset = false) {
    const work = this.queue.then(async () => {
      const state = watchStateSchema.parse(update(reset ? emptyWatchState() : await this.read()));
      const json = JSON.stringify(state); if (new TextEncoder().encode(json).length > WATCH_LIMITS.bytes) throw Error("Watch保存容量の上限です。Watchの履歴をリセットしてください。");
      try { await this.storage.set(PERSONAL_WATCH_KEY, json); } catch { throw Error("Watchを端末へ保存できません。確認状態は更新していません。保存容量を確認してください。"); }
      return state;
    }); this.queue = work.catch(() => undefined); return work;
  }
  observe(rows: WatchObservation[], league?: "NPB" | "MLB", activeEntities?: string[]) {
    return this.change(s => evaluateWatch({ ...s, observations: league && activeEntities ? s.observations.filter(o => o.league !== league || activeEntities.includes(`${o.kind}:${o.entityId}`)) : s.observations }, rows, this.now()));
  }
  preferences(preferences: WatchPreferences) {
    return this.change(s => ({ ...s, preferences: watchPreferencesSchema.parse(preferences), observations: [] })); // rule changes start a fresh baseline
  }
  preference(key: keyof WatchPreferences, enabled: boolean) {
    return this.change(s => ({ ...s, preferences: { ...s.preferences, [key]: enabled }, observations: [] }));
  }
  markRead(id?: string, league?: "NPB" | "MLB") { return this.change(s => ({ ...s, alerts: s.alerts.map(a => (!id || a.id === id) && (!league || a.observation.league === league) ? { ...a, read: true } : a) })); }
  dismiss(id: string) { return this.change(s => ({ ...s, alerts: s.alerts.map(a => a.id === id ? { ...a, read: true, dismissed: true } : a) })); }
  reset() { return this.change(emptyWatchState, true); }
}
