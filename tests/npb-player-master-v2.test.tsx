import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { openDataClient, migrateData } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { NpbPlayerDirectoryRepository } from "../src/data/npb-player-directory";
import { NpbPlayerMasterV2Importer, ProfileIdentityError, prepareVerifiedPlayerImport } from "../src/data/npb-player-master-v2";
import { verifiedPlayerMappings } from "../src/data/npb-verified-player-mappings";
import { WikidataPlayerProfileProvider, type WikidataPlayerProfile } from "../src/infrastructure/providers/wikidata-player-profile-provider";
import { NpbPlayerProfileFacts } from "../src/ui/npb-player-profile";
import { PlayerRecentView } from "../src/ui/player-recent";

const profiles: WikidataPlayerProfile[] = [
  { sourceId: "Q124479656", name: "中島大輔", teamIds: ["Q1375077"], birthDate: "2001-06-04", birthPlace: "和歌山県", nationality: "日本", position: null },
  { sourceId: "Q22117979", name: "上原健太", teamIds: ["Q974277"], birthDate: "1994-03-29", birthPlace: null, nationality: "日本", position: "P" },
  { sourceId: "Q22118838", name: "坂本誠志郎", teamIds: ["Q127635"], birthDate: "1993-11-10", birthPlace: "兵庫県", nationality: "日本", position: "C" },
  { sourceId: "Q102246615", name: "早川隆久", teamIds: ["Q1375077"], birthDate: "1998-07-06", birthPlace: "横芝光町", nationality: "日本", position: "P" },
];
const existing = verifiedPlayerMappings.filter((item) => !item.newPlayer).map((item) => ({
  id: item.playerId, validFrom: "2026-09-25", sourceKey: "nf3",
  payload: { name: item.name, teamId: item.teamId },
}));

describe("Verified Player Master v2", () => {
  it("parses only explicit structured fields from two bounded Wikidata reads", async () => {
    let calls = 0;
    const request = async () => {
      calls++;
      return Response.json(calls === 1 ? { entities: { Q22117979: { labels: { ja: { value: "上原健太" } }, claims: {
        P569: [{ mainsnak: { datavalue: { value: { time: "+1994-03-29T00:00:00Z", precision: 11 } } } }],
        P54: [{ mainsnak: { datavalue: { value: { id: "Q974277" } } } }],
        P413: [{ mainsnak: { datavalue: { value: { id: "Q1048902" } } } }],
        P27: [{ mainsnak: { datavalue: { value: { id: "Q17" } } } }],
      } } } } : { entities: { Q17: { labels: { ja: { value: "日本" } } } } });
    };
    const found = await new WikidataPlayerProfileProvider(request as typeof fetch).read(["Q22117979"]);
    expect(calls).toBe(2);
    expect(found[0]).toEqual({ sourceId: "Q22117979", name: "上原健太", teamIds: ["Q974277"],
      birthDate: "1994-03-29", birthPlace: null, nationality: "日本", position: "P" });
  });

  it("preserves canonical IDs, imports one real no-Fact player, and remains idempotent", async () => {
    const client = openDataClient("file::memory:");
    try {
      await migrateData(client);
      await new NpbRepository(client).syncTeamMappings("2026-09-26T00:00:00.000Z");
      for (const item of existing) await client.execute({ sql: `INSERT INTO master_history
        (entity_kind,entity_id,valid_from,payload_json,source_key,source_record_id,collected_at)
        VALUES ('player',?,?,?,?,?,?)`, args: [item.id, item.validFrom, JSON.stringify(item.payload),
        "nf3", item.id, "2026-09-25T00:00:00Z"] });
      await client.execute({ sql: `INSERT INTO standings_daily
        (snapshot_date,season,league,competition_group,team_id,rank,wins,losses,ties,games_played,pct,games_behind_leader,streak,source_key,collected_at,calculated_at)
        VALUES ('2026-09-25',2026,'NPB','Central','npb:team:tigers',1,1,0,0,1,1,0,1,'nf3','2026-09-26T00:00:00Z','2026-09-26T00:00:00Z')` });
      const importer = new NpbPlayerMasterV2Importer(client);
      expect((await importer.import(profiles, true)).newPlayers).toBe(1);
      expect(Number((await client.execute("SELECT COUNT(*) AS n FROM master_history WHERE entity_kind='player'")).rows[0]?.n)).toBe(3);
      await importer.import(profiles, false);
      await importer.import(profiles, false);
      const directory = await new NpbPlayerDirectoryRepository(client).read("2026-09-26T01:31:44.000Z");
      expect(directory.schemaVersion).toBe(2);
      expect(directory.players.map((item) => item.playerId).sort()).toEqual(verifiedPlayerMappings.map((item) => item.playerId).sort());
      const noFact = directory.players.find((item) => item.displayName === "早川隆久")!;
      expect(noFact).toMatchObject({ playerId: "a66dfd52-1ae2-4245-b849-558f263e6422",
        position: "P", birthDate: "1998-07-06", battingAvailable: false, pitchingAvailable: false,
        recentAvailable: false });
      const counts = await client.execute(`SELECT COUNT(*) AS n FROM source_entity_mappings
        WHERE source_key='wikidata' AND entity_kind='player'`);
      expect(Number(counts.rows[0]?.n)).toBe(4);
      const master = await client.execute({ sql: `SELECT payload_json FROM master_history
        WHERE entity_kind='player' AND entity_id=? ORDER BY valid_from DESC LIMIT 1`, args: [noFact.playerId] });
      const stored = JSON.parse(String(master.rows[0]?.payload_json));
      expect(stored.profile.provenance.birthDate.sourceId).toBe("Q102246615");
      expect(stored.profile.bats).toBeNull();
      expect(Number((await client.execute("SELECT COUNT(*) AS n FROM player_game_batting")).rows[0]?.n)).toBe(0);
      expect(Number((await client.execute("SELECT COUNT(*) AS n FROM player_game_pitching")).rows[0]?.n)).toBe(0);
    } finally { client.close(); }
  });

  it("rejects ambiguous names, mismatched identity, external mapping conflicts, and position conflicts", () => {
    expect(() => prepareVerifiedPlayerImport([...existing, { id: "other", validFrom: "2026-09-25",
      sourceKey: "nf3", payload: { name: "早川隆久", teamId: "npb:team:eagles" } }], [], profiles))
      .toThrow(ProfileIdentityError);
    expect(() => prepareVerifiedPlayerImport(existing, [], profiles.map((item) => item.name === "上原健太"
      ? { ...item, birthDate: "1990-01-01" } : item))).toThrow("Unresolved external identity");
    expect(() => prepareVerifiedPlayerImport(existing, [{ sourceKey: "wikidata", sourceId: "Q22118838", playerId: "other" }], profiles))
      .toThrow("Conflicting source mapping");
    expect(() => prepareVerifiedPlayerImport(existing.map((item) => item.payload.name === "坂本誠志郎"
      ? { ...item, payload: { ...item.payload, position: "P" } } : item), [], profiles))
      .toThrow("Position conflict");
  });

  it("renders only verified available profile fields and preserves a no-Fact Recent empty state", () => {
    const base = { playerId: "a66dfd52-1ae2-4245-b849-558f263e6422", displayName: "早川隆久",
      teamId: "npb:team:eagles", position: "P" as const, playerType: "pitcher" as const,
      birthDate: "1998-07-06", birthPlace: "横芝光町", nationality: "日本",
      bats: null, throws: null, battingAvailable: false, pitchingAvailable: false, recentAvailable: false };
    const html = renderToStaticMarkup(<NpbPlayerProfileFacts player={base} />);
    expect(html).toContain("1998年7月6日");
    expect(html).toContain("横芝光町");
    expect(html).not.toContain("投 / ");
    expect(renderToStaticMarkup(<NpbPlayerProfileFacts player={{ ...base, birthDate: null, birthPlace: null }} />)).toBe("");
    const recent = renderToStaticMarkup(<PlayerRecentView period="7d" onPeriodChange={() => undefined}
      payload={null} state="missing" noFactKnown />);
    expect(recent).toContain("最近の成績データはありません");
    const emptyResponse = { player: { id: base.playerId, name: base.displayName,
      teamId: base.teamId, teamName: "楽天" }, asOfDate: "2026-09-25" as const,
      period: "7d" as const, batting: null, pitching: null };
    const empty = renderToStaticMarkup(<PlayerRecentView period="7d" onPeriodChange={() => undefined}
      payload={emptyResponse} state="ready" noFactKnown />);
    expect(empty).toContain("最近の成績データはありません");
    expect(empty).not.toContain("—〜—");
  });
});
