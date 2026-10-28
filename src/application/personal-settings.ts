import { z } from "zod";
import type { SettingsStore } from "./ports";

export const PERSONAL_KEYS = { favorites: "baseball:favorites:v1", library: "baseball:personal-library:v1", watch: "baseball:personal-watch:v1" } as const;
export const PERSONAL_JOURNAL_KEY = "baseball:personal-restore:journal:v1";
export const PERSONAL_RESTORED_EVENT = "baseball:personal-restored";
const keys = Object.values(PERSONAL_KEYS);
const entry = z.strictObject({ key: z.enum(keys as [string, ...string[]]), before: z.string().nullable(), after: z.string().nullable() });
const journalSchema = z.strictObject({ version: z.literal(1), id: z.string().uuid(), phase: z.enum(["pending", "committed"]), entries: z.array(entry).min(2).max(3) }).refine(j => new Set(j.entries.map(e => e.key)).size === j.entries.length);
type Journal = z.infer<typeof journalSchema>;
type Backend = SettingsStore & { remove(key: string): Promise<void> };
const error = () => Error("保存状態を確認できません。データは削除せず保持しています。");

/** Existing keys remain authoritative. A bounded write-ahead journal protects multi-key restore. */
export class PersonalSettingsStore implements SettingsStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly raw: Backend) {}
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      if (typeof navigator !== "undefined" && navigator.locks) { let result!: T; await navigator.locks.request("baseball:personal-settings:v1", async () => { result = await work(); }); return result; }
      return work();
    });
    this.queue = next.catch(() => undefined); return next;
  }
  private async journal(): Promise<Journal | null> {
    const raw = await this.raw.get(PERSONAL_JOURNAL_KEY); if (raw === null) return null;
    try { if (new TextEncoder().encode(raw).length > 2_000_000) throw error(); return journalSchema.parse(JSON.parse(raw)); } catch { throw error(); }
  }
  private checked(key: string) { if (!keys.includes(key as typeof keys[number])) throw error(); }
  private async write(key: string, value: string | null) {
    if (await this.raw.get(key) === value) return;
    if (value === null) await this.raw.remove(key); else await this.raw.set(key, value);
  }
  private async recover() {
    const journal = await this.journal(); if (!journal) return;
    for (const item of journal.entries) await this.write(item.key, journal.phase === "pending" ? item.before : item.after);
    await this.raw.remove(PERSONAL_JOURNAL_KEY);
  }
  snapshot<T>(work: (view: SettingsStore) => Promise<T>): Promise<T> {
    return this.exclusive(async () => {
      const journal = await this.journal();
      return work({ get: async key => { this.checked(key); const item = journal?.entries.find(e => e.key === key); return item ? journal!.phase === "pending" ? item.before : item.after : this.raw.get(key); }, set: async () => { throw error(); } });
    });
  }
  get(key: string) { return this.snapshot(view => view.get(key)); }
  set(key: string, value: string) { return this.transaction(view => view.set(key, value)); }
  transaction<T>(work: (view: SettingsStore) => Promise<T>, restore = false): Promise<T> {
    return this.exclusive(async () => {
      await this.recover();
      const before = new Map<string, string | null>(), next = new Map<string, string>();
      const get = async (key: string) => { this.checked(key); if (next.has(key)) return next.get(key)!; if (!before.has(key)) before.set(key, await this.raw.get(key)); return before.get(key)!; };
      const result = await work({ get, set: async (key, value) => { await get(key); next.set(key, value); } });
      // Also reject edits from an older/uncoordinated client before the first write.
      for (const [key, value] of before) if (await this.raw.get(key) !== value) throw Error("保存内容が変更されました。もう一度ファイルを確認してください。");
      const entries = [...next].filter(([key, value]) => restore || before.get(key) !== value).map(([key, after]) => ({ key, before: before.get(key)!, after }));
      if (!entries.length) return result;
      if (entries.length === 1) { await this.raw.set(entries[0]!.key, entries[0]!.after); return result; }
      const pending: Journal = { version: 1, id: crypto.randomUUID(), phase: "pending", entries };
      const raw = JSON.stringify(pending); if (new TextEncoder().encode(raw).length > 2_000_000) throw Error("復元に必要な保存容量が不足しています。");
      try {
        await this.raw.set(PERSONAL_JOURNAL_KEY, raw);
        for (const item of entries) await this.raw.set(item.key, item.after);
        await this.raw.set(PERSONAL_JOURNAL_KEY, JSON.stringify({ ...pending, phase: "committed" }));
      } catch {
        let committed: boolean;
        try { const stored = await this.journal(); committed = stored?.id === pending.id && stored.phase === "committed"; } catch { throw error(); }
        if (!committed) { try { await this.recover(); } catch { /* Pending journal serves the complete old snapshot even if physical rollback is interrupted. */ } throw error(); }
      }
      try { await this.raw.remove(PERSONAL_JOURNAL_KEY); } catch { /* A committed journal serves the complete new snapshot until recovery can finish. */ }
      return result;
    });
  }
}

export function mutatePersonalSettings<T>(store: SettingsStore, work: (view: SettingsStore) => Promise<T>): Promise<T> {
  return store instanceof PersonalSettingsStore ? store.transaction(work) : work(store);
}
