import { z } from "zod";
import { favoriteSchema } from "../domain/models";
import type { Favorite } from "../domain/models";
import type { SettingsStore } from "./ports";

const schema = z.object({
  version: z.literal(1),
  items: z.array(favoriteSchema),
});
const key = "baseball:favorites:v1";
export class Favorites {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly storage: SettingsStore,
    private readonly now: () => number = Date.now,
  ) {}
  async list(): Promise<Favorite[]> {
    const raw = await this.storage.get(key);
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
    const operation = this.queue.then(async () => {
      const current = await this.list();
      const match = (item: Favorite) =>
        item.kind === target.kind &&
        item.entityId === target.entityId &&
        item.league === target.league;
      const exists=current.some(match);
      if((mode==="add"&&exists)||(mode==="remove"&&!exists))return current;
      const next = mode==="remove" || (mode==="toggle"&&exists)
        ? current.filter((item) => !match(item))
        : [
            ...current,
            { ...target, addedAt: new Date(this.now()).toISOString() },
          ];
      await this.storage.set(
        key,
        JSON.stringify(schema.parse({ version: 1, items: next })),
      );
      return next;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
  add(target:Pick<Favorite,"entityId"|"kind"|"league">):Promise<Favorite[]>{return this.toggle(target,"add");}
  remove(target:Pick<Favorite,"entityId"|"kind"|"league">):Promise<Favorite[]>{return this.toggle(target,"remove");}
}
