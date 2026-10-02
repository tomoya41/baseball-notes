import { describe, expect, it } from "vitest";
import { discoverNpbIdentityCandidates, verifyNpbIdentityCandidate } from "../src/infrastructure/providers/wikidata-npb-identity";
import { linkChadwickNpb } from "../src/infrastructure/providers/chadwick-npb-identity";
import { readWikipediaNpbProfile } from "../src/infrastructure/providers/wikipedia-npb-profile";
import { profileRegistrySchema } from "../src/domain/npb-profile-registry";
import { npbTeams } from "../src/data/npb-nf3";
import type { NpbPlayerDirectory } from "../src/domain/npb-player-directory";
import identities from "../src/data/npb-free-profile-identities.json";
import curated from "../src/data/npb-curated-profile-registry.json";
import assisted from "../src/data/npb-codex-assisted-profile-registry.json";
import { verifyWikipediaNpbIdentity } from "../src/infrastructure/providers/wikipedia-npb-identity";

const playerId = "00000000-0000-4000-8000-000000000001";
const at = "2026-10-03T00:00:00.000Z";
const player = { playerId, displayName: "試験・選手", teamId: "npb:team:tigers", position: null, playerType: null,
  bats: null, throws: null, birthDate: null, birthPlace: null, nationality: null,
  battingAvailable: true, pitchingAvailable: false, recentAvailable: true } as const;
const directory: NpbPlayerDirectory = { schemaVersion: 2, league: "NPB", effectiveDate: "2026-10-01", generatedAt: at,
  teams: npbTeams.map(t => ({ id: t.id, name: t.name, shortName: t.short })), players: [player] };
const row = (id = "Q1", team = "Q127635", name = "試験選手") => ({ item: { value: `http://www.wikidata.org/entity/${id}` },
  npb: { value: "12345678" }, name: { value: name }, team: { value: `http://www.wikidata.org/entity/${team}` } });
const index = (rows = [row()]) => ({ results: { bindings: rows } });
const claim = (value: unknown) => ({ rank: "normal", mainsnak: { datavalue: { value } } });
const entity = { labels: { ja: { value: "試験選手" } }, aliases: {}, lastrevid: 42,
  claims: { P4260: [claim("12345678")], P54: [claim({ id: "Q127635" })] } };
const bridge = { playerId, wikidataId: "Q1", npbId: "12345678" };
const chadwick = { key_uuid: "00000000-0000-4000-8000-000000000002", key_npb: "12345678", key_wikidata: "Q1",
  key_mlbam: "987", key_retro: "", key_bbref: "", key_fangraphs: "", birth_year: "2000", birth_month: "2", birth_day: "29" };

describe("compound NPB identity, no name-only merge", () => {
  it("requires exact registered name plus canonical Team and unique external ID, verifying live claims", () => {
    const c = discoverNpbIdentityCandidates(index(), directory)[0]!;
    expect(c.status).toBe("candidate"); expect(verifyNpbIdentityCandidate(c, entity, player)).toMatchObject({ approved: true, sourceRevision: 42 });
    expect(discoverNpbIdentityCandidates(index([row("Q1", "Q1197407")]), directory)[0]!.status).toBe("unmatched");
    expect(discoverNpbIdentityCandidates(index([row("Q1", "Q127635", "試験")]), directory)[0]!.status).toBe("unmatched");
  });
  it("rejects same-name identities, changed teams/IDs and contradictory known birth date", () => {
    expect(discoverNpbIdentityCandidates(index([row(), row("Q2")]), directory)[0]!.status).toBe("ambiguous");
    const c = discoverNpbIdentityCandidates(index(), directory)[0]!;
    expect(verifyNpbIdentityCandidate(c, { ...entity, claims: { ...entity.claims, P4260: [claim("87654321")] } }, player).approved).toBe(false);
    expect(verifyNpbIdentityCandidate(c, { ...entity, claims: { ...entity.claims, P569: [claim({ time: "+2000-01-01T00:00:00Z", precision: 11 })] } }, { ...player, birthDate: "2001-01-01" }).approved).toBe(false);
  });
  it("does not infer current membership from historical team identity evidence", () => {
    expect(verifyNpbIdentityCandidate(discoverNpbIdentityCandidates(index(), directory)[0]!, entity, player)).not.toHaveProperty("currentTeam");
  });
});
describe("licensed Chadwick cross-reference", () => {
  it("joins exact NPB ID and preserves external IDs as references only", () => {
    expect(linkChadwickNpb([chadwick], [bridge])[0]).toMatchObject({ approved: true, birthDate: "2000-02-29", externalIds: { mlbam: "987" } });
  });
  it("rejects duplicates and inconsistent Wikidata, leaving incomplete dates null", () => {
    expect(linkChadwickNpb([chadwick, chadwick], [bridge])[0]!.approved).toBe(false);
    expect(linkChadwickNpb([{ ...chadwick, key_wikidata: "Q2" }], [bridge])[0]!.approved).toBe(false);
    expect(linkChadwickNpb([{ ...chadwick, birth_day: "" }], [bridge])[0]).toMatchObject({ approved: true, birthDate: null });
  });
});
describe("profile fact definitions/provenance", () => {
  it("requires explicit club and unique NPB ID beyond an exact article title, with no surname inference", () => {
    const content = "{{Infobox baseball player\n|所属球団=[[阪神タイガース]]\n}}\n{{NPB|12345678}}";
    const page = { title: "試験・選手", pageprops: { wikibase_item: "Q1" }, revisions: [{ revid: 123, slots: { main: { content } } }] };
    expect(verifyWikipediaNpbIdentity(page, player, player.displayName, "阪神タイガース")?.npbId).toBe("12345678");
    expect(verifyWikipediaNpbIdentity(page, player, "試験", "阪神タイガース")).toBeNull();
    expect(verifyWikipediaNpbIdentity(page, player, player.displayName, "読売ジャイアンツ")).toBeNull();
    expect(verifyWikipediaNpbIdentity({ ...page, revisions: [{ revid: 123, slots: { main: { content: content + "{{NPB|87654321}}" } } }] }, player, player.displayName, "阪神タイガース")).toBeNull();
  });
  it("structures school history without graduation, joining date, current jersey or prose inference", () => {
    const content = "{{Infobox baseball player\n|経歴=\n* [[試験高等学校]]\n* [[試験大学]]\n* 球団名 (2021 - )\n|初出場=2021年4月1日\n|プロ入り年度={{NPBドラフト|2020}}\n|ドラフト順位=育成選手ドラフト2位\n|背番号=22\n}}";
    const r = readWikipediaNpbProfile({ title: "試験", pageprops: { wikibase_item: "Q1" }, revisions: [{ revid: 123, timestamp: at, slots: { main: { content } } }] }, bridge, at);
    expect(r.entries.find(e => e.field === "amateurHistory")?.value).toEqual([{ name: "試験高等学校", category: "high_school", from: null, to: null }, { name: "試験大学", category: "university", from: null, to: null }]);
    expect(r.entries.find(e => e.field === "draftType")?.value).toBe("developmental");
    expect(r.entries.some(e => ["npbDebutYear", "joinedYear", "uniformNumber"].includes(e.field))).toBe(false);
    expect(r.entries.every(e => e.verificationMethod === "automated" && e.sourceRevision === 123 && e.verificationStatus !== "human_reviewed")).toBe(true);
  });
  it("validates every committed candidate, one-to-one identities and honest human-review provenance", () => {
    expect(profileRegistrySchema.parse(curated).entries.every(e => e.verificationMethod === "automated" && e.verificationStatus !== "human_reviewed")).toBe(true);
    for (const key of ["playerId", "npbId", "wikidataId"] as const) expect(new Set(identities.map(b => b[key])).size).toBe(identities.length);
    expect(profileRegistrySchema.parse(assisted).entries.every(e => e.verificationMethod === "codex_assisted" && e.verificationStatus !== "human_reviewed")).toBe(true);
  });
});
