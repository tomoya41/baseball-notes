import { z } from "zod";
import type { GameSurfaceReader, GameSummaryReader, PublishedGameSummary } from "../../application/game-surface";
import { gameDateIndexSchema, gameDateLookupSchema } from "../../domain/npb-game-index";

const gameIdSchema = z.string().regex(/^npb:game:[0-9a-f]{20}$/);
export class PublishedNpbGameSummaryRepository implements GameSummaryReader {
  constructor(private readonly surface: Pick<GameSurfaceReader, "date">,
    private readonly index: () => Promise<unknown>) {}
  async find(gameId: string, date?: string): Promise<PublishedGameSummary | null> {
    gameIdSchema.parse(gameId);
    // A supplied date is a hint only. Identity is checked against the actual dated payload.
    if (date !== undefined) {
      const hinted = await this.findOnDate(gameId, z.iso.date().parse(date));
      if (hinted) return hinted;
    }
    const indexedDate = gameDateLookupSchema.parse(await this.index()).dates[gameId];
    return indexedDate && indexedDate !== date ? this.findOnDate(gameId, indexedDate) : null;
  }

  private async findOnDate(gameId: string, date: string): Promise<PublishedGameSummary | null> {
    const day = gameDateIndexSchema.parse(await this.surface.date(date));
    if (day.date !== date) throw Error("Saved Game date mismatch");
    const game = day.games.find(row => row.gameId === gameId);
    return game ? { game, generatedAt: day.generatedAt, coverage: day.coverage } : null;
  }
}
