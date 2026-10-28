import { expect, it } from "vitest";
import { buildHonorCatalog, honorCatalogSchema, honorRecipientBucket } from "../src/domain/honor-discovery";
import type { Honor, HonorRecipient } from "../src/domain/player-honors";

const player = (id: string): HonorRecipient => ({ id, name: "Same Name", identityStatus: "verified", links: [], externalIds: {}, counts: {} });
const row = (id: string, recipientId: string, year: number): Honor => ({ id: id.repeat(64), recipientId, league: "MLB", year, division: "NL", awardId: "mlb_mvp", name: "MVP", sourceName: "Most Valuable Player", kind: "award", position: null, seasonTeams: [], joint: null, sourceId: "source", evidenceSha256: "a".repeat(64), reportedCareerWins: null });
it("keeps same-name source recipients separate and derives collected counts from actual rows", () => {
  const a = player("lahman:fixture01"), b = player("lahman:fixture02");
  const catalog = buildHonorCatalog("MLB", [row("a", a.id, 1990), row("b", a.id, 2004), row("c", b.id, 2001)], [a, b]);
  expect(catalog.players).toHaveLength(2);
  expect(catalog.players[0]).toMatchObject({ id: a.id, years: [2004, 1990], total: 2, playerId: null });
  expect(catalog.players[1]).toMatchObject({ id: b.id, years: [2001], total: 1 });
  expect(catalog.awards).toEqual([{ id: "mlb_mvp", name: "MVP" }]);
  expect(() => buildHonorCatalog("MLB", [row("a", a.id, 2004)], [])).toThrow("Missing");
});
it("rejects future years, duplicate identities, league crossover and fabricated profile joins", () => {
  const p = player("lahman:fixture01"), c = buildHonorCatalog("MLB", [row("a", p.id, 2004)], [p]);
  expect(honorCatalogSchema.safeParse({ ...c, players: [c.players[0], c.players[0]] }).success).toBe(false);
  expect(honorCatalogSchema.safeParse({ ...c, players: [{ ...c.players[0], years: [2026] }] }).success).toBe(false);
  expect(honorCatalogSchema.safeParse({ ...c, players: [{ ...c.players[0], id: "npb:12345678" }] }).success).toBe(false);
  expect(honorCatalogSchema.safeParse({ ...c, players: [{ ...c.players[0], playerId: "same name" }] }).success).toBe(false);
  expect(honorCatalogSchema.safeParse({ ...c, players: [{ ...c.players[0], awardIds: ["invented"] }] }).success).toBe(false);
});
it("buckets source IDs deterministically without making them canonical player IDs", () => {
  expect(honorRecipientBucket("lahman:bondsba01")).toMatch(/^[a-f0-9]{2}$/);
});
