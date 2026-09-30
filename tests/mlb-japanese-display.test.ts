import { describe, expect, it } from "vitest";
import names from "../src/data/mlb-japanese-names.json";
import { japaneseHistoricalPayload, japaneseMlbPlayerName, japaneseMlbTeamName, matchesMlbPlayerName } from "../src/domain/mlb-japanese-display";

const idFor = (english: string) => Object.entries(names.players).find(([, row]) => row.en === english)![0];
const ohtani = idFor("Shohei Ohtani"), trout = idFor("Mike Trout");

describe("Japanese MLB presentation without identity or Fact changes", () => {
  it("uses kanji for all collected Japanese players and familiar foreign spellings", () => {
    expect(japaneseMlbPlayerName(ohtani, "Shohei Ohtani")).toBe("大谷翔平");
    expect(japaneseMlbPlayerName(idFor("Yoshi Tsutsugo"), "Yoshi Tsutsugo")).toBe("筒香嘉智");
    expect(japaneseMlbPlayerName(idFor("Gosuke Katoh"), "Gosuke Katoh")).toBe("加藤豪将");
    expect(japaneseMlbPlayerName(idFor("Yu Darvish"), "Yu Darvish")).toBe("ダルビッシュ有");
    expect(japaneseMlbPlayerName(trout, "Mike Trout")).toBe("マイク・トラウト");
    for (const [english, japanese] of [["Pete Alonso", "ピート・アロンソ"], ["Junior Caminero", "ジュニア・カミネロ"],
      ["DJ LeMahieu", "DJ・ルメイヒュー"], ["Eugenio Suarez", "エウヘニオ・スアレス"]] as const) {
      expect(japaneseMlbPlayerName(idFor(english), english)).toBe(japanese);
    }
    expect(Object.values(names.players).filter(row => /\p{Script=Han}/u.test(row.ja))).toHaveLength(23);
  });
  it("does not assign a translation to a same-name different canonical identity", () => {
    expect(japaneseMlbPlayerName("mlb:player:unknown", "Shohei Ohtani")).toBe("Shohei Ohtani");
    expect(japaneseMlbPlayerName("missing", null)).toBeNull();
    expect(japaneseMlbPlayerName("missing", "Unverified Name")).toBe("Unverified Name");
  });
  it("supports Japanese and original English, accents, spaces, and punctuation", () => {
    for (const query of ["大谷", "大谷 翔平", "SHOHEI OHTANI", "shōhei"]) expect(matchesMlbPlayerName(ohtani, "大谷翔平", query)).toBe(true);
    for (const query of ["マイク・トラウト", "マイク トラウト", "Mike Trout", "trout"]) expect(matchesMlbPlayerName(trout, "マイク・トラウト", query)).toBe(true);
    expect(matchesMlbPlayerName(trout, "マイク・トラウト", "大谷")).toBe(false);
    expect(matchesMlbPlayerName("missing", "Unverified Name", "unverified")).toBe(true);
  });
  it("localizes every team by canonical identity, with a safe unknown fallback", () => {
    expect(Object.keys(names.teams)).toHaveLength(30);
    expect(japaneseMlbTeamName("mlb:team:28b25091-aacd-5b48-9f8e-ff5808a165c6", "Los Angeles Dodgers")).toBe("ロサンゼルス・ドジャース");
    expect(japaneseMlbTeamName("unknown", "Future Team")).toBe("Future Team");
  });
  it("projects profile, index, boxscore, records and exact BvP names only", () => {
    const pa = Object.freeze({ playerId: ohtani, name: "Shohei Ohtani", pa: 0, ab: null, starter: false });
    const pitch = Object.freeze({ playerId: trout, name: "Mike Trout", outsRecorded: 0, appearanceOrder: null });
    const game = Object.freeze({ game: Object.freeze({ id: "canonical-game", batting: Object.freeze([pa]), pitching: Object.freeze([pitch]) }) });
    const result = japaneseHistoricalPayload("games/game.json", game);
    expect(result.game.batting[0]).toEqual({ ...pa, name: "大谷翔平" });
    expect(result.game.pitching[0]).toEqual({ ...pitch, name: "マイク・トラウト" });
    expect(game.game.batting[0]!.name).toBe("Shohei Ohtani");
    const profile = { player: { id: ohtani, name: "Shohei Ohtani" }, batting: [pa] };
    expect(japaneseHistoricalPayload("players/player.json", profile)).toEqual({ ...profile, player: { ...profile.player, name: "大谷翔平" } });
    expect(japaneseHistoricalPayload("players/index.json", { players: [profile.player] }).players[0]!.name).toBe("大谷翔平");
    const records = { records: [{ metric: "HR", rows: [{ ...pa, rank: 1, value: 54 }] }] };
    expect(japaneseHistoricalPayload("records/2024.json", records).records[0]!.rows[0]).toEqual({ ...records.records[0]!.rows[0], name: "大谷翔平" });
    const advanced = { batting: { opponents: [pitch], splits: [{ key: "outs:0", PA: 0 }] }, pitching: { opponents: [pa], splits: [] } };
    const localized = japaneseHistoricalPayload("advanced/range/player.json", advanced);
    expect(localized.batting.opponents[0]!.name).toBe("マイク・トラウト");
    expect(localized.batting.splits).toBe(advanced.batting.splits);
    expect(japaneseHistoricalPayload("advanced/capabilities.json", advanced)).toBe(advanced);
    expect(japaneseHistoricalPayload("schedule/2025/date.json", game)).toBe(game);
  });
  it("keeps source evidence, canonical IDs and a Japanese label for each registry entry", () => {
    for (const [id, row] of Object.entries(names.players)) {
      expect(id).toMatch(/^mlb:player:[0-9a-f-]{36}$/);
      expect(row.ja).toMatch(/[\p{Script=Han}ァ-ヶ]/u);
      expect(row.evidence === "editorial" || /^https:\/\/www.wikidata.org\/wiki\/Q\d+$/.test(row.evidence)).toBe(true);
    }
  });
});
