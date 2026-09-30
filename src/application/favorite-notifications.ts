import type { Favorite } from "../domain/models";
import type { SettingsStore } from "./ports";
import { favoriteNotificationTopics } from "../domain/eod-notifications";
export interface NotificationPort {
  status(): Promise<{ configured: boolean; granted: boolean }>;
  enable(): Promise<{ granted: boolean }>; disable(): Promise<void>;
  subscribe(options: { topic: string }): Promise<void>; unsubscribe(options: { topic: string }): Promise<void>;
}
export class FavoriteNotifications {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly store: SettingsStore, private readonly native: NotificationPort) {}
  async enabled() { return await this.store.get("baseball:notifications:enabled") === "true"; }
  private async topics(): Promise<string[]> {
    try { const value: unknown = JSON.parse(await this.store.get("baseball:notifications:topics") ?? "[]");
      return Array.isArray(value) ? value.filter((t): t is string => typeof t === "string" && /^npb-player-[0-9a-f-]{36}$/.test(t)) : [];
    } catch { return []; }
  }
  async setEnabled(on: boolean, favorites: Favorite[]) {
    if (on) {
      if (!(await this.native.status()).configured) throw Error("通知の準備がまだ完了していません。");
      if (favoriteNotificationTopics(favorites).length > 2000) throw Error("通知対象のお気に入りが上限を超えています。");
      if (!(await this.native.enable()).granted) throw Error("通知を許可すると成績更新を受け取れます。");
    }
    await this.store.set("baseball:notifications:enabled", String(on));
    if (!on) await this.native.disable();
    await this.sync(favorites);
  }
  sync(favorites: Favorite[]): Promise<void> {
    const operation = this.queue.then(async () => {
      const enabled = await this.enabled(), status = await this.native.status();
      if (!status.configured) return;
      const desired = enabled && status.granted ? favoriteNotificationTopics(favorites) : [];
      if (desired.length > 2000) throw Error("通知対象のお気に入りが上限を超えています。");
      let stored = await this.topics();
      for (const topic of stored.filter(t => !desired.includes(t))) {
        await this.native.unsubscribe({ topic }); stored = stored.filter(t => t !== topic);
        await this.store.set("baseball:notifications:topics", JSON.stringify(stored));
      }
      for (const topic of desired.filter(t => !stored.includes(t))) {
        await this.native.subscribe({ topic }); stored.push(topic);
        await this.store.set("baseball:notifications:topics", JSON.stringify(stored));
      }
    });
    this.queue = operation.catch(() => undefined); return operation;
  }
}
