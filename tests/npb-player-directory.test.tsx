import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { openDataClient, migrateData } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { NpbPlayerDirectoryRepository } from "../src/data/npb-player-directory";
import { writeNpbPlayerDirectoryAtomically } from "../src/data/npb-player-directory-payload";
import { preservePublishedNpbPlayerDirectory } from "../src/data/npb-player-directory-preservation";
import { npbPlayerDirectorySchema, searchNpbPlayers, type NpbPlayerDirectory } from "../src/domain/npb-player-directory";
import { StaticPlayerDirectoryRepository } from "../src/infrastructure/providers/static-player-directory-repository";
import { NpbPlayerSearchView } from "../src/ui/npb-player-search";

const ids = {
  nakashima: "00000000-0000-4000-8000-000000000001",
  uehara: "00000000-0000-4000-8000-000000000002",
  sakamoto: "00000000-0000-4000-8000-000000000003",
  both: "00000000-0000-4000-8000-000000000004",
  noFact: "00000000-0000-4000-8000-000000000005",
};
const teamNames = ["阪神", "巨人", "DeNA", "中日", "広島", "ヤクルト", "ソフトバンク", "日本ハム", "オリックス", "楽天", "西武", "ロッテ"];
const teams = teamNames.map((name, index) => ({ id: `team-${index}`, name, shortName: name }));
const players: NpbPlayerDirectory["players"] = [
  { playerId: ids.nakashima, displayName: "中島大輔", teamId: teams[9]!.id, position: null, battingAvailable: true, pitchingAvailable: false },
  { playerId: ids.uehara, displayName: "上原健太", teamId: teams[7]!.id, position: null, battingAvailable: false, pitchingAvailable: true },
  { playerId: ids.sakamoto, displayName: "坂本誠志郎", teamId: teams[0]!.id, position: null, battingAvailable: true, pitchingAvailable: false },
  { playerId: ids.both, displayName: "二刀流選手", teamId: teams[1]!.id, position: null, battingAvailable: true, pitchingAvailable: true },
  { playerId: ids.noFact, displayName: "新規選手", teamId: teams[2]!.id, position: null, battingAvailable: false, pitchingAvailable: false },
];
const fixture = npbPlayerDirectorySchema.parse({ schemaVersion: 1, league: "NPB",
  effectiveDate: "2026-09-25", generatedAt: "2026-09-26T00:00:00.000Z", teams, players });
function view(state: "loading" | "ready" | "error", value: NpbPlayerDirectory | null = fixture, query = "") {
  return renderToStaticMarkup(<MemoryRouter><NpbPlayerSearchView directory={value} state={state}
    query={query} onQueryChange={() => undefined} teamId="" onTeamChange={() => undefined}
    role="all" onRoleChange={() => undefined} /></MemoryRouter>);
}

describe("NPB Player Directory", () => {
  it("ranks exact, prefix and partial matches; ignores name whitespace", () => {
    expect(searchNpbPlayers(players, "坂本誠志郎")[0]?.playerId).toBe(ids.sakamoto);
    expect(searchNpbPlayers(players, "坂本")[0]?.playerId).toBe(ids.sakamoto);
    expect(searchNpbPlayers(players, "誠志郎")[0]?.playerId).toBe(ids.sakamoto);
    expect(searchNpbPlayers(players, "坂本 誠志郎")[0]?.playerId).toBe(ids.sakamoto);
    expect(searchNpbPlayers(players, "存在しない")).toEqual([]);
    const order = [players[0]!, { ...players[1]!, displayName: "中島" },
      { ...players[2]!, displayName: "山中島" }];
    expect(searchNpbPlayers(order, "中島").map((item) => item.displayName))
      .toEqual(["中島", "中島大輔", "山中島"]);
  });

  it("combines real team and role filters without dropping two-way or no-Fact players", () => {
    expect(searchNpbPlayers(players, "", { teamId: teams[0]!.id }).map((item) => item.playerId)).toEqual([ids.sakamoto]);
    expect(searchNpbPlayers(players, "", { role: "batter" }).some((item) => item.playerId === ids.both)).toBe(true);
    expect(searchNpbPlayers(players, "", { role: "pitcher" }).some((item) => item.playerId === ids.both)).toBe(true);
    expect(searchNpbPlayers(players, "", { role: "pitcher", teamId: teams[0]!.id })).toEqual([]);
    expect(searchNpbPlayers(players, "", { role: "all" }).some((item) => item.playerId === ids.noFact)).toBe(true);
  });

  it("renders canonical links and localized loading, empty and error states", () => {
    const ready = view("ready", fixture, "坂本 誠志郎");
    expect(ready).toContain(`/NPB/players/${ids.sakamoto}`);
    expect(ready).toContain("坂本誠志郎");
    expect(ready).not.toContain("サンプル選手");
    expect(ready).toContain("選手名を検索");
    expect(ready).toContain("すべての球団");
    const noFact = view("ready", fixture, "新規選手");
    expect(noFact).toContain(`/NPB/players/${ids.noFact}`);
    expect(noFact).toContain("最近の成績なし");
    expect(view("ready", fixture, "なし")).toContain("該当する選手が見つかりません");
    expect(view("loading", null)).toContain("読み込み中");
    expect(view("error", null)).toContain("選手一覧を取得できませんでした");
  });

  it("uses only validated static data and last-success cache", async () => {
    const values = new Map<string, string>();
    const cache = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); } };
    const first = new StaticPlayerDirectoryRepository("https://example.test/app/", async () => Response.json(fixture), cache);
    expect((await first.findLatestNpb()).players.length).toBe(5);
    const offline = new StaticPlayerDirectoryRepository("https://example.test/app/",
      async () => { throw new Error("offline"); }, cache);
    expect((await offline.findLatestNpb()).players.length).toBe(5);
    await expect(new StaticPlayerDirectoryRepository("https://other.test/",
      async () => Response.json({ schemaVersion: 1, players: [] }), cache).findLatestNpb()).rejects.toThrow();
    expect(() => npbPlayerDirectorySchema.parse({ ...fixture, secret: "forbidden" })).toThrow();
  });

  it("generates with five SELECTs from existing masters and Fact availability, without writes", async () => {
    const root = await mkdtemp(join(tmpdir(), "npb-directory-"));
    const client = openDataClient("file::memory:");
    try {
      await migrateData(client);
      await new NpbRepository(client).syncTeamMappings("2026-09-26T00:00:00.000Z");
      for (const player of players) await client.execute({ sql: `INSERT INTO master_history
        (entity_kind,entity_id,valid_from,payload_json,source_key,source_record_id,collected_at)
        VALUES ('player',?,'2026-09-25',?,'nf3',?,'2026-09-26T00:00:00.000Z')`,
      args: [player.playerId, JSON.stringify({ name: player.displayName,
        teamId: player.teamId === teams[0]!.id ? "npb:team:tigers" : "npb:team:giants" }),
      player.playerId] });
      await client.execute({ sql: `INSERT INTO standings_daily
        (snapshot_date,season,league,competition_group,team_id,rank,wins,losses,ties,games_played,pct,games_behind_leader,streak,source_key,collected_at,calculated_at)
        VALUES ('2026-09-25',2026,'NPB','Central','npb:team:tigers',1,1,0,0,1,1,0,1,'nf3','2026-09-26T00:00:00Z','2026-09-26T00:00:00Z')` });
      await client.execute({ sql: `INSERT INTO player_game_batting
        (game_id,player_id,team_id,source_key,source_record_id,collected_at)
        VALUES ('game',?,'npb:team:giants','nf3','bat','2026-09-26T00:00:00Z')`, args: [ids.nakashima] });
      await client.execute({ sql: `INSERT INTO player_game_pitching
        (fact_id,game_id,player_id,team_id,source_key,source_record_id,collected_at)
        VALUES ('pitch','game',?,'npb:team:giants','nf3','pitch','2026-09-26T00:00:00Z')`, args: [ids.uehara] });
      const before = (await client.execute("SELECT COUNT(*) AS n FROM player_game_batting")).rows[0]?.n;
      const value = await new NpbPlayerDirectoryRepository(client).read("2026-09-26T00:00:00.000Z");
      expect(value.players.length).toBe(5);
      expect(value.players.find((player) => player.playerId === ids.nakashima)?.battingAvailable).toBe(true);
      expect(value.players.find((player) => player.playerId === ids.uehara)?.pitchingAvailable).toBe(true);
      expect(value.players.find((player) => player.playerId === ids.noFact)?.battingAvailable).toBe(false);
      expect((await client.execute("SELECT COUNT(*) AS n FROM player_game_batting")).rows[0]?.n).toBe(before);
      const path = join(root, "latest.json");
      await writeNpbPlayerDirectoryAtomically(path, value);
      expect(npbPlayerDirectorySchema.parse(JSON.parse(await readFile(path, "utf8"))).players.length).toBe(5);
    } finally { client.close(); await rm(root, { recursive: true, force: true }); }
  });

  it("preserves only a validated public directory across a full Pages deploy", async () => {
    const root = await mkdtemp(join(tmpdir(), "npb-directory-preserve-"));
    try {
      const path = join(root, "latest.json");
      expect(await preservePublishedNpbPlayerDirectory(path, "https://example.test/players.json",
        async () => Response.json(fixture))).toBe("preserved");
      const previous = await readFile(path, "utf8");
      expect(await preservePublishedNpbPlayerDirectory(path, "https://example.test/players.json",
        async () => Response.json({ players: [] }))).toBe("skipped");
      expect(await readFile(path, "utf8")).toBe(previous);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
