export const tournamentAwardPositions = {
  pitcher: "投手", catcher: "捕手", first_base: "一塁手", second_base: "二塁手",
  third_base: "三塁手", shortstop: "遊撃手", outfield: "外野手", designated_hitter: "指名打者",
};

export function tournamentAwardName(kind: string) {
  return kind === "wbc" ? "オールWBCチーム" : "大会ベストナイン";
}
