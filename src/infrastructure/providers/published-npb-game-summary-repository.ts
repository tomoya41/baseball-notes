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
    if (date !== undefined) z.iso.date().parse(date);
    const indexedDate = date ?? gameDateLookupSchema.parse(await this.index()).dates[gameId];
    if (!indexedDate) return null;
    const day = gameDateIndexSchema.parse(await this.surface.date(indexedDate));
    if (day.date !== indexedDate) throw Error("Saved Game date mismatch");
    const matches = day.games.filter(g => g.gameId === gameId);
    if (matches.length !== 1) return null;
    return { game: matches[0]!, generatedAt: day.generatedAt, coverage: day.coverage };
  }
}
