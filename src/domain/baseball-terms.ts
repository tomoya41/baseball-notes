import { z } from "zod";

// Provider adapters map their own labels/codes into these canonical identities.
export const positionCodeSchema = z.enum([
  "P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "DH",
]);
export type PositionCode = z.infer<typeof positionCodeSchema>;
export const positionDefinitions: Record<PositionCode, string> = {
  P: "投手", C: "捕手", "1B": "一塁手", "2B": "二塁手",
  "3B": "三塁手", SS: "遊撃手", LF: "左翼手", CF: "中堅手",
  RF: "右翼手", OF: "外野手", DH: "指名打者",
};

export const pitchTypeDefinitions = {
  fourSeam: { ja: "フォーシーム", en: "Four-Seam Fastball" },
  sinker: { ja: "シンカー", en: "Sinker" },
  slider: { ja: "スライダー", en: "Slider" },
  sweeper: { ja: "スイーパー", en: "Sweeper" },
  curveball: { ja: "カーブ", en: "Curveball" },
  changeup: { ja: "チェンジアップ", en: "Changeup" },
  splitter: { ja: "スプリット", en: "Split-Finger" },
  cutter: { ja: "カットボール", en: "Cutter" },
} as const;
export type PitchType = keyof typeof pitchTypeDefinitions;
