import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NpbProfileDetails } from "../src/ui/npb-product";
import { profileRegistrySchema, type ProfileRegistryEntry } from "../src/domain/npb-profile-registry";
import { applyNpbProfileRegistry } from "../src/application/npb-free-profile";
import { buildNpbCatalog, buildNpbCapabilities } from "../src/application/npb-product-payload";
import { npbTeams } from "../src/data/npb-nf3";
import type { NpbPlayerDirectory } from "../src/domain/npb-player-directory";
import { readWikipediaNpbProfile, baseballInfobox } from "../src/infrastructure/providers/wikipedia-npb-profile";
import { readNpbProfileRegistry } from "../src/infrastructure/providers/wikidata-npb-profile-registry";
import type { NpbSeasonPayload } from "../src/application/npb-season-payload";
import registry from "../src/data/npb-free-profile-registry.json";
import wikipedia from "../src/data/npb-wikipedia-profile-registry.json";

const id = "00000000-0000-4000-8000-000000000001", at = "2026-10-01T22:00:00.000Z", date = "2026-09-30";
const directory: NpbPlayerDirectory = { schemaVersion: 2, league: "NPB", effectiveDate: date, generatedAt: at,
  teams: npbTeams.map(t => ({ id: t.id, name: t.name, shortName: t.short })),
  players: [{ playerId: id, displayName: "保存済み選手", teamId: "npb:team:tigers", position: null, playerType: null,
    birthDate: null, birthPlace: null, nationality: null, bats: null, throws: null,
    battingAvailable: true, pitchingAvailable: false, recentAvailable: true }] };
const catalog = () => buildNpbCatalog(directory, { observedAt: at, effectiveDate: null, players: [] });
const entry = (field: ProfileRegistryEntry["field"], value: unknown, extra: Partial<ProfileRegistryEntry> = {}): ProfileRegistryEntry => ({ playerId: id,
  field, value, sourceName: "Wikidata", sourceUrl: "https://www.wikidata.org/wiki/Q1", license: "CC0", rightsEvidenceUrl: "https://www.wikidata.org/wiki/Wikidata:Licensing",
  publicReuseAllowed: true, verifiedAt: at, effectiveFrom: null, effectiveTo: null, verificationStatus: "source_verified", reviewer: "Codex", notes: "Source verified", additionalSourceUrls: [], ...extra });
const snapshot = (entries: ProfileRegistryEntry[]) => ({ schemaVersion: 1, observedAt: at, entries });
const apply = (entries: ProfileRegistryEntry[]) => applyNpbProfileRegistry(directory, catalog(), snapshot(entries));
const sourceClaim = (value: unknown) => ({ mainsnak: { datavalue: { value } }, rank: "normal" });
const bridge = { playerId: id, wikidataId: "Q1", npbId: "12345678" };

describe("rights-safe field registry", () => {
  it("fills nullable profiles and keeps IDs, names, affiliations and Fact availability", () => {
    const r = apply([entry("bats", "left"), entry("throws", "right"), entry("position", "P"), entry("birthDate", "2000-10-01")]);
    expect(r.directory.players[0]).toMatchObject({ playerId: id, displayName: "保存済み選手", teamId: "npb:team:tigers", bats: "left", throws: "right", playerType: "pitcher", battingAvailable: true, pitchingAvailable: false });
    expect(r.catalog.players[0]!.profile.ageYears).toBe(25); expect(r.conflicts).toEqual([]);
  });
  it("preserves known values and records the incoming disagreement", () => {
    const d = structuredClone(directory); d.players[0]!.birthDate = "2001-01-01";
    const c = catalog(); c.players[0]!.profile.birthDate = "2001-01-01";
    const r = applyNpbProfileRegistry(d, c, snapshot([entry("birthDate", "2000-01-01")]));
    expect(r.directory.players[0]!.birthDate).toBe("2001-01-01"); expect(r.conflicts[0]).toMatchObject({ reason: "known_value_preserved", existing: "2001-01-01", incoming: "2000-01-01" });
  });
  it("does not select one conflicting source, even if the other has priority/recency", () => {
    const r = apply([entry("heightCm", 180), entry("heightCm", 181, { verifiedAt: "2026-10-02T01:00:00.000Z" })]);
    expect(r.catalog.players[0]!.profile.heightCm).toBeNull(); expect(r.conflicts[0]!.reason).toBe("competing_source_values");
  });
  it("compares position/school sets independently of source order, preserving known arrays", () => {
    const rows = [entry("knownPositions", ["外野手", "一塁手"]), entry("knownPositions", ["一塁手", "外野手"]),
      entry("schools", ["学校B", "学校A"]), entry("schools", ["学校A", "学校B"])];
    const r = apply(rows); expect(r.conflicts).toEqual([]);
    expect(r.catalog.players[0]!.profile.knownPositions).toEqual(["一塁手", "外野手"]);
    const known = catalog(); known.players[0]!.profile.knownPositions = ["外野手", "一塁手"];
    const again = applyNpbProfileRegistry(directory, known, snapshot(rows));
    expect(again.catalog.players[0]!.profile.knownPositions).toEqual(["外野手", "一塁手"]);
    expect(again.conflicts).toEqual([]);
    expect(apply([entry("knownPositions", ["外野手"]), entry("knownPositions", ["一塁手"])]).conflicts).toHaveLength(1);
  });
  it("keeps strict comparison for scalar values and other array fields", () => {
    const a = { name: "球団A", teamId: null, from: "2020", to: "2021", uniformNumber: null };
    const b = { ...a, name: "球団B", from: "2021", to: "2022" };
    expect(apply([entry("affiliations", [a, b]), entry("affiliations", [b, a])]).conflicts).toHaveLength(1);
  });
  it("blocks contradictory primary positions even when the listed-position group already conflicts", () => {
    const rows = [entry("position", "P"), entry("knownPositions", ["投手"]), entry("knownPositions", ["三塁手", "一塁手", "二塁手"])];
    for (const ordered of [rows, [...rows].reverse()]) {
      const r = apply(ordered);
      expect(r.directory.players[0]!.position).toBeNull(); expect(r.directory.players[0]!.playerType).toBeNull();
      expect(r.catalog.players[0]!.profile.position).toBeNull();
      expect(r.catalog.players[0]!.profile.knownPositions).toBeUndefined();
      expect(r.conflicts.map(v => v.reason).sort()).toEqual(["competing_source_values", "cross_field_position_conflict"]);
    }
    const d = structuredClone(directory); d.players[0]!.position = "3B";
    const c = catalog(); c.players[0]!.profile.position = "3B";
    const known = applyNpbProfileRegistry(d, c, snapshot(rows));
    expect(known.directory.players[0]!.position).toBe("3B"); expect(known.catalog.players[0]!.profile.position).toBe("3B");
  });
  it("supports broad position labels but rejects incompatible source lists in either direction", () => {
    for (const [position, knownPositions] of [["3B", ["内野手"]], ["RF", ["外野手"]], ["OF", ["右翼手", "中堅手"]]] as const)
      expect(apply([entry("position", position), entry("knownPositions", knownPositions)]).conflicts).toEqual([]);
    const bad = apply([entry("position", "C"), entry("knownPositions", ["投手"])]);
    expect(bad.directory.players[0]!.position).toBeNull(); expect(bad.catalog.players[0]!.profile.knownPositions).toBeUndefined();
    expect(bad.conflicts).toHaveLength(2);
    const blocked = apply([entry("position", "C"), entry("knownPositions", ["投手"], { publicReuseAllowed: false })]);
    expect(blocked.directory.players[0]!.position).toBe("C"); expect(blocked.conflicts).toEqual([]);
  });
  it("renders origin and birthplace as separate profile facts", () => {
    const r = apply([entry("originPlace", "出身の地域"), entry("birthPlace", "出生した地域")]);
    const html = renderToStaticMarkup(createElement(NpbProfileDetails, { player: r.catalog.players[0]! }));
    expect(html).toContain("<dt>出身</dt><dd>出身の地域</dd>");
    expect(html).toContain("<dt>出生地</dt><dd>出生した地域</dd>");
    expect(renderToStaticMarkup(createElement(NpbProfileDetails, { player: catalog().players[0]! }))).not.toContain("<dt>出生地</dt>");
  });
  it("ignores pending/rights-blocked/future evidence and never creates absent players", () => {
    const r = apply([entry("bats", "left", { verificationStatus: "pending" }), entry("throws", "right", { publicReuseAllowed: false }),
      entry("birthDate", "2030-01-01"), entry("heightCm", 180, { playerId: "00000000-0000-4000-8000-000000000002" })]);
    expect(r.directory).toEqual(directory); expect(r.catalog).toEqual(catalog());
  });
  it("does not describe automated review as human review", () => {
    expect(() => profileRegistrySchema.parse(snapshot([entry("heightCm", 180, { verificationStatus: "human_reviewed" })]))).toThrow(/human reviewer/i);
    expect(profileRegistrySchema.parse(registry).entries.some(e => e.verificationStatus === "human_reviewed")).toBe(false);
  });
  it("retains year precision and does not turn historical jersey into current membership", () => {
    const r = apply([entry("affiliations", [{ name: "阪神タイガース", teamId: "npb:team:tigers", from: "2020", to: null, uniformNumber: "7" }]),
      entry("uniformNumber", "7", { effectiveFrom: "2020", effectiveTo: null })]);
    expect(r.catalog.players[0]!.profile.affiliations?.[0]?.from).toBe("2020"); expect(r.catalog.players[0]!.membership.uniformNumber).toBeNull();
  });
  it("requires same-day team evidence for a current jersey", () => {
    const r = apply([entry("uniformNumber", "7", { effectiveFrom: date, effectiveTo: date })]);
    expect(r.catalog.players[0]!.membership.uniformNumber).toBeNull();
    const good = apply([entry("affiliations", [{ name: "阪神タイガース", teamId: "npb:team:tigers", from: date, to: date, uniformNumber: "7" }]),
      entry("uniformNumber", "7", { effectiveFrom: date, effectiveTo: date })]);
    expect(good.catalog.players[0]!.membership.uniformNumber).toBe("7");
  });
  it("never uses competing or rights-blocked affiliations as current membership proof", () => {
    const affiliation = entry("affiliations", [{ name: "阪神タイガース", teamId: "npb:team:tigers", from: date, to: date, uniformNumber: "7" }]);
    const number = entry("uniformNumber", "7", { effectiveFrom: date, effectiveTo: date });
    expect(apply([number, { ...affiliation, publicReuseAllowed: false }]).catalog.players[0]!.membership.uniformNumber).toBeNull();
    const competing = entry("affiliations", [{ name: "別球団", teamId: null, from: date, to: date, uniformNumber: "7" }]);
    const r = apply([number, affiliation, competing]);
    expect(r.catalog.players[0]!.membership.uniformNumber).toBeNull(); expect(r.conflicts).toHaveLength(1);
  });
  it("keeps a known player classification while filling an unknown profile position", () => {
    const d = structuredClone(directory); d.players[0]!.playerType = "fielder";
    expect(applyNpbProfileRegistry(d, catalog(), snapshot([entry("position", "P")])).directory.players[0]!.playerType).toBe("fielder");
  });
  it("rejects unknown canonical Teams and wrong units/types", () => {
    expect(() => apply([entry("draftTeamId", "npb:team:unknown")])).toThrow(/canonical/);
    expect(() => apply([entry("heightCm", "180")])).toThrow();
  });
  it("keeps attribution, license and modification notices through repeated projection", () => {
    const rows = [entry("bats", "left", { license: "CC-BY-SA-4.0", sourceName: "Wikipedia contributors", sourceUrl: "https://ja.wikipedia.org/w/index.php?oldid=123" })];
    const a = apply(rows), b = applyNpbProfileRegistry(a.directory, a.catalog, snapshot(rows));
    expect(b).toEqual(a); expect(a.catalog.players[0]!.profile.credits?.[0]).toMatchObject({ fields: ["bats"], modified: true, licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" });
  });
  it("reports partial counts without changing HOT/Ranking/Career/Coverage", () => {
    const c = apply([entry("schools", ["確認済み学校"]), entry("draftYear", 2020)]).catalog;
    const s = { coverage: { status: "partial", summary: { dates: 1, complete: 0, noGames: 0, partial: 1, unknown: 0, failed: 0 } },
      readiness: { status: "not_ready", reasons: ["season_coverage_not_complete"] } } as unknown as NpbSeasonPayload;
    const hot = { status: "not_ready" as const, reasons: ["operations_pending"] };
    const before = buildNpbCapabilities(catalog(), s, hot), after = buildNpbCapabilities(c, s, hot);
    expect(after.data.draft).toMatchObject({ available: true, known: 1, total: 1 });
    for (const key of ["hot", "rateRanking", "countingRanking", "careerStats"]) expect(after.data[key]).toEqual(before.data[key]);
    expect(after.coverage).toEqual(before.coverage);
  });
});
describe("documented Wikimedia adapters", () => {
  const text = "{{Infobox baseball player\n|画像=not-imported.jpg\n|利き腕=右\n|打席=左\n|身長=180\n|体重=80\n|生年月日={{生年月日と年齢|2000|1|2}}\n|プロ入り年度={{NPBドラフト|2019}}\n|ドラフト順位=育成選手ドラフト1位\n|守備位置=[[捕手]]\n|初出場=2020年3月1日\n}}\n|身長=999\nStats and prose not imported";
  const page = { title: "同名選手", pageprops: { wikibase_item: "Q1" }, revisions: [{ revid: 123, timestamp: at, slots: { main: { content: text } } }] };
  it("uses exact Wikidata identity, not a page title/name match", () => {
    expect(() => readWikipediaNpbProfile({ ...page, pageprops: { wikibase_item: "Q2" } }, bridge, at)).toThrow(/identity/);
    expect(readWikipediaNpbProfile(page, bridge, at).entries.some(e => e.field === "throws" && e.value === "right")).toBe(true);
  });
  it("handles nested templates/links and excludes photographs, prose and tables", () => {
    const r = readWikipediaNpbProfile(page, bridge, at);
    expect(r.entries.find(e => e.field === "heightCm")?.value).toBe(180);
    expect(r.entries.find(e => e.field === "birthDate")?.value).toBe("2000-01-02");
    expect(r.entries.find(e => e.field === "draftRound")?.value).toBe("育成1位");
    expect(JSON.stringify(r)).not.toMatch(/not-imported|Stats and prose|999/);
    expect(r.entries.every(e => e.license === "CC-BY-SA-4.0" && e.sourceUrl.endsWith("oldid=123"))).toBe(true);
  });
  it("fails closed on missing/incomplete/duplicate infoboxes or unknown syntax", () => {
    expect(() => baseballInfobox("no template")).toThrow(); expect(() => baseballInfobox("{{Infobox baseball player\n|身長=180")).toThrow();
    expect(() => baseballInfobox("{{Infobox baseball player\n|身長=180\n|身長=181}}")).toThrow(/Duplicate/);
    const r = readWikipediaNpbProfile({ ...page, revisions: [{ ...page.revisions[0]!, slots: { main: { content: text.replace("打席=左", "打席=不明").replace("{{NPBドラフト|2019}}", "2019年MLBドラフト") } } }] }, bridge, at);
    expect(r.entries.some(e => e.field === "bats" || e.field === "draftYear")).toBe(false);
  });
  it("does not infer handedness from generic sports properties or current membership from P54", () => {
    const claims = { P4260: [sourceClaim("12345678")], P741: [sourceClaim({ id: "Q2" })], P54: [sourceClaim({ id: "Q3" })] };
    const r = readNpbProfileRegistry({ entities: { Q1: { claims } } }, { entities: { Q3: { labels: { ja: { value: "球団" } } } } }, [bridge], at, { Q3: "npb:team:tigers" });
    expect(r.registry.entries.map(e => e.field)).toEqual(["affiliations"]);
    expect(r.registry.entries[0]!.value).toEqual([{ name: "球団", teamId: "npb:team:tigers", from: null, to: null, uniformNumber: null }]);
  });
  it("retains conflicting valid source quantities for cross-source conflict detection", () => {
    const q = (amount: string) => sourceClaim({ amount, unit: "http://www.wikidata.org/entity/Q11570" });
    const r = readNpbProfileRegistry({ entities: { Q1: { claims: { P4260: [sourceClaim("12345678")], P2067: [q("+80"), q("+81")] } } } }, { entities: {} }, [bridge], at, {});
    expect(r.registry.entries.map(e => e.value)).toEqual([80, 81]); expect(apply(r.registry.entries).catalog.players[0]!.profile.weightKg).toBeNull();
  });
  it("ships validated reusable field data, never pretending the whole master is reviewed", () => {
    const entries = [...profileRegistrySchema.parse(registry).entries, ...profileRegistrySchema.parse(wikipedia).entries];
    expect(new Set(entries.map(e => e.playerId)).size).toBe(116); expect(entries.every(e => e.publicReuseAllowed)).toBe(true);
    expect(entries.filter(e => e.verificationStatus === "human_reviewed")).toHaveLength(0);
  });
  it("does not publish the bundled Ishikawa position contradiction", () => {
    const playerId = "6294da4c-056c-4c57-afff-e923dba33a9f";
    const d = structuredClone(directory); d.players[0]!.playerId = playerId;
    const c = buildNpbCatalog(d, { observedAt: at, effectiveDate: null, players: [] });
    const r = applyNpbProfileRegistry(d, c, { ...registry, entries: [...registry.entries, ...wikipedia.entries] });
    expect(r.directory.players[0]!.position).toBeNull();
    expect(r.conflicts).toContainEqual(expect.objectContaining({ field: "position", reason: "cross_field_position_conflict" }));
  });
});
