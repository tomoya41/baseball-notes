import { Preferences } from "@capacitor/preferences";
import type { CacheStore, SettingsStore } from "../application/ports";

export class PreferenceStore implements SettingsStore {
  async get(key: string): Promise<string | null> {
    return (await Preferences.get({ key })).value;
  }
  async set(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }
}

// Disposable normalized catalog snapshots, one per provider/league. No raw feeds.
export class IndexedDbCache implements CacheStore {
  constructor(private readonly databaseName = "baseball-cache-v1") {}
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("catalogs");
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error);
      };
      request.onblocked = () => {
        reject(new Error("Cache database blocked"));
      };
    });
  }
  private async transaction(
    key: string,
    mode: IDBTransactionMode,
    value?: unknown,
  ): Promise<unknown> {
    const database = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction("catalogs", mode);
        const store = transaction.objectStore("catalogs");
        const request =
          mode === "readonly" ? store.get(key) : store.put(value, key);
        transaction.oncomplete = () => {
          resolve(request.result as unknown);
        };
        transaction.onabort = () => {
          reject(transaction.error ?? new Error("Cache transaction aborted"));
        };
        transaction.onerror = () => {
          reject(transaction.error);
        };
      });
    } finally {
      database.close();
    }
  }
  read(key: string): Promise<unknown> {
    return this.transaction(key, "readonly");
  }
  async write(key: string, value: unknown): Promise<void> {
    await this.transaction(key, "readwrite", value);
  }
}
