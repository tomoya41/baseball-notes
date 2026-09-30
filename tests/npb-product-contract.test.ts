import { describe, it, expect } from "vitest";
import { buildNpbCatalog, buildNpbCapabilities } from "../src/application/npb-product-payload";
import { npbCatalogSchema, ageOnDate } from "../src/domain/npb-product-contract";
import { readReviewedMeasurements } from "../src/infrastructure/providers/wikidata-measurements";
import { npbTeams } from "../src/data/npb-nf3";
import type { NpbPlayerDirectory } from "../src/domain/npb-player-directory";
import type { NpbSeasonPayload } from "../src/application/npb-season-payload";
import { readNpbTeamSeason } from "../src/data/npb-team-season-repository";
import type { DataClient } from "../src/data/database";
import { unavailablePeriodCoverage } from "../src/domain/period-coverage";
import { StaticNpbProductRepository } from "../src/infrastructure/providers/static-npb-product-repository";

const id = "00000000-0000-4000-8000-000000000001", at = "2026-09-30T09:54:12.000Z", date = "2026-09-29";
const directory: NpbPlayerDirectory = { schemaVersion: 2, league: "NPB", effectiveDate: date, generatedAt: at,
  teams: npbTeams.map(t => ({ id: t.id, name: t.name, shortName: t.short })),
  players: [{ playerId: id, displayName: "確認済み選手", teamId: "npb:team:tigers", position: null, playerType: null,
    birthDate: null, birthPlace: null, nationality: null, bats: null, throws: null,
    battingAvailable: true, pitchingAvailable: true, recentAvailable: true }] };
const catalog = () => buildNpbCatalog(directory, { observedAt: at, effectiveDate: null,
  players: [{ playerId: id, heightCm: 180, weightKg: null }] });
const item = (value: unknown, rank = "normal") => ({ rank, mainsnak: { datavalue: { value } } });
function entity(extra: object) { return { entities: { Q1: { labels: { ja: { value: "確認済み選手" } }, claims: {
  P569: [item({ time: "+2000-01-01T00:00:00Z", precision: 11 })], P54: [item({ id: "Q2" })], ...extra } } } }; }
const bridge = [{ playerId: id, wikidataId: "Q1", name: "確認済み選手", birthDate: "2000-01-01", wikidataTeamId: "Q2" }];

describe("Astra public product contracts", () => {
  it("derives age from calendar dates without replacing unknown birth dates", () => {
    expect(ageOnDate("2001-06-04", "2026-06-03")).toBe(24);
    expect(ageOnDate("2001-06-04", "2026-06-04")).toBe(25);
    expect(ageOnDate(null, date)).toBeNull(); expect(ageOnDate("2030-01-01", date)).toBeNull();
    expect(() => ageOnDate("2001-13-01", date)).toThrow();
  });
  it("fetches Profile basics once for concurrent consumers and refreshes explicitly", async () => {
    let requests = 0;
    const repository = new StaticNpbProductRepository("https://example.com/", async () => {
      requests++; return Response.json(catalog());
    });
    const [a, b] = await Promise.all([repository.player(id), repository.catalog()]);
    expect(a).toEqual(b.players[0]); expect(requests).toBe(1);
    expect(await repository.player("00000000-0000-4000-8000-000000000999")).toBeNull();
    expect(requests).toBe(1); repository.invalidateCatalog(); await repository.player(id); expect(requests).toBe(2);
    await expect(repository.player("nf3-8")).rejects.toThrow(/Canonical/);
  });
  it("does not retain a poisoned or failed response", async () => {
    let requests = 0;
    const repository = new StaticNpbProductRepository("https://example.com/", async () => {
      requests++; return requests === 1 ? Response.json({ schemaVersion: 999 }) : Response.json(catalog());
    });
    await expect(repository.catalog()).rejects.toThrow(); expect(await repository.player(id)).not.toBeNull();
    expect(requests).toBe(2);
  });
  it("keeps nullable fields, both roles, affiliation context and unavailable visuals", () => {
    const value = catalog(), p = value.players[0]!;
    expect(p.profile).toMatchObject({ heightCm: 180, weightKg: null, measurementsEffectiveDate: null, draftYear: null });
    expect(p.membership).toMatchObject({ uniformNumber: null, uniformNumberEffectiveDate: null, scope: "latest_stored_affiliation" });
    expect(p.visual.photo.url).toBeNull(); expect(p.visual.photo.usage).toBe("unavailable");
    expect(value.teams.every(t => t.visual.primaryColor === null && t.visual.logo.url === null)).toBe(true);
    expect(p.battingAvailable && p.pitchingAvailable).toBe(true);
    expect(JSON.stringify(value)).not.toMatch(/nf3|wikidata|sourceId|sourceUrl|secret|token/);
    expect(catalog()).toEqual(value);
  });
  it("rejects unlicensed URL, missing credit, duplicate player and unknown team", () => {
    const v = catalog(), p = v.players[0]!;
    const change = (photo: object) => ({ ...v, players: [{ ...p, visual: { ...p.visual, photo } }] });
    expect(() => npbCatalogSchema.parse(change({ ...p.visual.photo, url: "https://example.com/photo.png" }))).toThrow();
    expect(() => npbCatalogSchema.parse(change({ ...p.visual.photo, usage: "allowed", url: "https://example.com/photo.png" }))).toThrow();
    expect(() => npbCatalogSchema.parse({ ...v, players: [p, p] })).toThrow();
    expect(() => npbCatalogSchema.parse({ ...v, players: [{ ...p, membership: { ...p.membership, teamId: "unknown" } }] })).toThrow();
  });
  it("separates blocked rights, unavailable granularity and existing production gates", () => {
    const coverage = unavailablePeriodCoverage({ from: date, to: date, timeZone: "Asia/Tokyo" });
    const season = { coverage, readiness: { status: "not_ready", reasons: ["season_coverage_not_complete"] } } as unknown as NpbSeasonPayload;
    const c = buildNpbCapabilities(catalog(), season, { status: "not_ready", reasons: ["scheduled_production_evidence_pending"] });
    expect(c.data.uniformNumber?.status).toBe("blocked_by_rights");
    expect(c.data.heightCm?.status).toBe("available"); expect(c.data.weightKg?.known).toBe(0);
    expect(c.data.directBvP?.status).toBe("source_unavailable"); expect(c.data.hot?.available).toBe(false);
    expect(c.data.countingRanking?.reasons).toEqual(["season_coverage_not_complete"]);
    expect(c.data.playerTeam?.status).toBe("partially_available");
  });
});
describe("CC0 reviewed measurement adapter", () => {
  it("converts explicit units, never guesses conflicting measurements", () => {
    const r = readReviewedMeasurements(entity({ P2048: [item({ amount: "+1.80", unit: "http://www.wikidata.org/entity/Q11573" })],
      P2067: [item({ amount: "+83", unit: "http://www.wikidata.org/entity/Q11570" }), item({ amount: "+84", unit: "http://www.wikidata.org/entity/Q11570" })] }), bridge);
    expect(r).toEqual([{ playerId: id, heightCm: 180, weightKg: null }]);
  });
  it("honors preferred/deprecated claims and preserves unknown units", () => {
    const r = readReviewedMeasurements(entity({ P2048: [item({ amount: "+180", unit: "http://www.wikidata.org/entity/Q174728" }, "preferred"),
      item({ amount: "+181", unit: "http://www.wikidata.org/entity/Q174728" }), item({ amount: "+182", unit: "http://www.wikidata.org/entity/Q174728" }, "deprecated")],
    P2067: [item({ amount: "+78", unit: "unknown" })] }), bridge);
    expect(r[0]).toMatchObject({ heightCm: 180, weightKg: null });
  });
  it("rejects a name-only match, a changed DOB and a missing entity", () => {
    const raw = entity({ P54: [item({ id: "Q3" })] });
    expect(() => readReviewedMeasurements(raw, bridge)).toThrow(/identity/);
    expect(() => readReviewedMeasurements(entity({}), [{ ...bridge[0]!, birthDate: "2000-01-02" }])).toThrow();
    expect(() => readReviewedMeasurements({ entities: {} }, bridge)).toThrow();
  });
});

describe("team Season read model", () => {
  it("uses three batch reads, keeps final partial Games and never exposes WHIP or source fields", async () => {
    const queries: string[] = [];
    const client = { execute: async ({ sql }: { sql: string }) => {
      queries.push(sql);
      return { rows: sql.includes("SELECT game_id") ? [
        { game_id: "g1", home_team_id: "npb:team:tigers", away_team_id: "npb:team:giants", home_score: 2, away_score: 1, venue: "球場" },
        { game_id: "g2", home_team_id: "npb:team:giants", away_team_id: "npb:team:tigers", home_score: 0, away_score: 0, venue: "別球場" },
      ] : [] };
    } } as unknown as DataClient;
    const coverage = unavailablePeriodCoverage({ from: "2026-03-27", to: date, timeZone: "Asia/Tokyo" });
    const a = await readNpbTeamSeason(client, catalog(), coverage);
    expect(queries).toHaveLength(3); expect(queries.every(q => q.startsWith("SELECT"))).toBe(true);
    expect(a.teams.find(t => t.teamId === "npb:team:tigers")).toMatchObject({ G: 2, W: 1, L: 0, T: 1,
      runsFor: 2, runsAgainst: 1, observedHomeVenues: ["球場"], gamesWithBattingFacts: 0 });
    expect(a.coverage.status).toBe("unavailable"); expect(a.scope).toBe("stored_final_games");
    expect(JSON.stringify(a)).not.toMatch(/WHIP|sourceUrl|sourceRecord/);
    expect(await readNpbTeamSeason(client, catalog(), coverage)).toEqual(a);
  });
  it("keeps unknown scores unknown, without treating a scheduled Game as final", async () => {
    const client = { execute: async ({ sql }: { sql: string }) => ({ rows: sql.includes("SELECT game_id") ? [
      { game_id: "g", home_team_id: "npb:team:tigers", away_team_id: "npb:team:giants", home_score: null, away_score: null, venue: null },
    ] : [] }) } as unknown as DataClient;
    const r = await readNpbTeamSeason(client, catalog(), unavailablePeriodCoverage({ from: date, to: date, timeZone: "Asia/Tokyo" }));
    expect(r.teams[0]).toMatchObject({ G: 1, W: 0, L: 0, T: 0, runsFor: null, scoreStatus: "unavailable" });
  });
});
