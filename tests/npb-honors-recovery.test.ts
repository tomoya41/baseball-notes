import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { parseNpbHonors } from "../src/infrastructure/providers/wikipedia-npb-honors";

const parse = (list: string) => parseNpbHonors(`=== 表彰 ===\n${list}`, "npb:12345678", "wiki:fixture:1");
const best = "[[ベストナイン (日本プロ野球)|ベストナイン]]";
const glove = "[[ゴールデングラブ賞]]";
it.each([
  [`* ${glove}：6回（遊撃手部門：2016年、2017年、2019年 - 2021年 三塁手部門：2024年）`, [[2016,"遊撃手部門"],[2017,"遊撃手部門"],[2019,"遊撃手部門"],[2020,"遊撃手部門"],[2021,"遊撃手部門"],[2024,"三塁手部門"]]],
  [`* ${best}：2回（遊撃手部門：2022年、二塁手部門：2025年）`, [[2022,"遊撃手部門"],[2025,"二塁手部門"]]],
  [`* ${best}：4回（外野手部門：2008年、2010年、2011年、指名打者部門：2020年）`, [[2008,"外野手部門"],[2010,"外野手部門"],[2011,"外野手部門"],[2020,"指名打者部門"]]],
  [`* ${best}：3回（一塁手部門：2008年\u3000外野手部門：2009年、2011年）`, [[2008,"一塁手部門"],[2009,"外野手部門"],[2011,"外野手部門"]]],
  [`* ${best}：1回（捕手部門 : 2024年）`, [[2024,"捕手部門"]]],
] as const)("recovers explicit position/year partitions without borrowing a player's current position: %s", (block, expected) => {
  const result = parse(block);
  expect(result.issues).toEqual([]);
  expect(result.rows.map(r => [r.year, r.position])).toEqual(expected);
  expect(result.rows.every(r => r.evidenceSha256 === createHash("sha256").update(block).digest("hex"))).toBe(true);
});
it("keeps a complete parent award independent of an unrelated nested award or historical note", () => {
  for (const child of [`** [[ゴールデングラブ賞#三井ゴールデン・グラブ レジェンズ|三井ゴールデン・グラブ レジェンズ]]（二塁手部門）`, "** この受賞者には別の表彰の受賞歴もある"]) {
    const block = `* ${glove}：10回（二塁手部門：2013年 - 2022年）\n${child}`, result = parse(block);
    expect(result.rows).toHaveLength(10);
    expect(new Set(result.rows.map(r => r.awardId))).toEqual(new Set(["npb_glove"]));
    expect(result.rows[0]!.evidenceSha256).toBe(createHash("sha256").update(block).digest("hex"));
  }
});
it("masks balanced known note templates, including nested markup and fake award lines, without interpreting them", () => {
  const result = parse(`* [[最多セーブ投手]]：2回（2013年{{Efn2|注記{{other|2026年}}}}、2021年{{Efn2|注記}}）\n{{Efn2|\n* ${best}：1回（2025年）\n}}`);
  expect(result.issues).toEqual([]);
  expect(result.rows.map(r => r.year)).toEqual([2013, 2021]);
  expect(parse(`* ${best}：1回（2024年）{{Efn2|未閉鎖`).rows).toEqual([]);
});
it("retains explicit dual-position awards in one year but rejects a duplicate of the same award/position/year", () => {
  expect(parse(`* ${best}：2回（投手部門：2016年、指名打者部門：2016年）`).rows).toHaveLength(2);
  const duplicate = parse(`* ${best}：2回（投手部門：2016年、投手部門：2016年）`);
  expect(duplicate.rows).toEqual([]);
  expect(duplicate.issues[0]?.reason).toBe("duplicate_award_position_year");
});
it.each([
  `* ${best}：3回（一塁手部門：2023年、二塁手部門：2024年）`,
  `* ${best}：2回（架空部門：2023年、二塁手部門：2024年）`,
  `* ${best}：2回（一塁手部門：2023年二塁手部門：2024年）`,
  `* ${best}：2回（2024年、2026年）`,
  `* ${best}：1回（2024年）候補`,
  `* ${best}：1回（2024年）\n** 投手部門：1回（2023年）`,
  `* ${best}：1回（2024年{{Unknown|value}}）`,
  `* ${best}：1回（捕手部門：2024年、）`,
  `* ${best}：2回（捕手部門：2023年、、一塁手部門：2024年）`,
  `* ${best}：1回（2024年）\n** 架空部門：1回（2024年）`,
])("holds unknown, contradictory, future and candidate records as a whole: %s", block => {
  const result = parse(block); expect(result.rows).toEqual([]); expect(result.issues).toHaveLength(1);
});
