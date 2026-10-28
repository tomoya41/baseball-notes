import { z } from "zod";
import { favoriteSchema } from "../domain/models";
import type { Favorite } from "../domain/models";
import type { SettingsStore } from "./ports";
import { favoriteMatches } from "../domain/cross-league";
import { mutatePersonalSettings, PERSONAL_KEYS } from "./personal-settings";

const schema = z.object({
  version: z.literal(1),
  items: z.array(favoriteSchema),
});
const key = PERSONAL_KEYS.favorites;
export class Favorites {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly storage: SettingsStore,
    private readonly now: () => number = Date.now,
  ) {}
  async list(storage = this.storage): Promise<Favorite[]> {
    const raw = await storage.get(key);
    if (raw === null) return [];
    try {
      return schema.parse(JSON.parse(raw)).items;
    } catch {
      throw new Error(
        "お気に入りの保存データを読み込めません。上書きせず保持しています。",
      );
    }
  }
  toggle(
    target: Pick<Favorite, "entityId" | "kind" | "league">,
    mode: "toggle" | "add" | "remove" = "toggle",
  ): Promise<Favorite[]> {
    const operation = this.queue.then(() => mutatePersonalSettings(this.storage, async storage => {
      const current = await this.list(storage);
      const match = (item: Favorite) => favoriteMatches(item, target);
      const exists=current.some(match);
      if((mode==="add"&&exists)||(mode==="remove"&&!exists))return current;
      const next = mode==="remove" || (mode==="toggle"&&exists)
        ? current.filter((item) => !match(item))
        : [
            ...current,
            { ...target, addedAt: new Date(this.now()).toISOString() },
          ];
      await storage.set(
        key,
        JSON.stringify(schema.parse({ version: 1, items: next })),
      );
      return next;
    }));
    this.queue = operation.catch(() => undefined);
    return operation;
  }
  add(target:Pick<Favorite,"entityId"|"kind"|"league">):Promise<Favorite[]>{return this.toggle(target,"add");}
  remove(target:Pick<Favorite,"entityId"|"kind"|"league">):Promise<Favorite[]>{return this.toggle(target,"remove");}
}
