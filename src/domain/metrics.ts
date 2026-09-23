import type { MetricDefinition, MetricValue } from "./models";

export const metrics: Record<string, MetricDefinition> = {
  avg: {
    id: "avg",
    name: "AVG",
    fullName: "打率",
    description: "打数のうち、安打になった割合です。安打 ÷ 打数で計算します。",
    interpretation: "高いほど安打を打つ頻度が高いことを示します。",
    caveat:
      "四球は含みません。少ない打数では大きく変動し、長打の価値も区別しません。",
    advanced: false,
    format: "rate",
  },
  hr: {
    id: "hr",
    name: "HR",
    fullName: "本塁打",
    description: "対象期間に打ったホームランの本数です。",
    interpretation: "多いほど本塁打による得点への貢献が大きくなります。",
    caveat: "出場機会や球場の違いも考慮して比べます。",
    advanced: false,
    format: "count",
  },
  ops: {
    id: "ops",
    name: "OPS",
    fullName: "出塁率 ＋ 長打率",
    description: "塁に出る力と、長打を打つ力をまとめて見る指標です。",
    interpretation: "高いほど打撃の総合的な貢献が大きい傾向があります。",
    caveat:
      "球場や年代によって基準が変わります。走塁や守備の評価は含みません。",
    advanced: false,
    format: "rate",
  },
  era: {
    id: "era",
    name: "ERA",
    fullName: "防御率",
    description:
      "9イニングあたりの自責点です。自責点 × 27 ÷ 投球アウト数で計算します。",
    interpretation: "低いほど自責点を抑えています。",
    caveat: "守備や球場の影響があります。投球回が少ないと値が大きく動きます。",
    advanced: false,
    format: "decimal",
  },
  outs: {
    id: "outs",
    name: "IP",
    fullName: "投球回",
    description: "投手が記録したアウト数をイニングで表します。",
    interpretation: "1回は3アウト。「1/3回」は1アウトです。",
    caveat:
      "6回1/3を6.1という小数として計算しません。内部ではアウト数を使います。",
    advanced: false,
    format: "outs",
  },
  barrelPct: {
    id: "barrelPct",
    name: "Barrel%",
    fullName: "バレル率",
    description:
      "打球のうち、安打や長打になりやすい速度と角度の組み合わせを満たした割合です。",
    interpretation: "高いほど、質の高い強い打球を打てていると読めます。",
    caveat:
      "計測データが必要です。未提供は0%ではありません。リーグ間で同じ計測があるとは限りません。",
    advanced: true,
    format: "percent",
  },
};
export function ratio(numerator: number, denominator: number): MetricValue {
  return denominator === 0
    ? { status: "missing", reason: "計算に必要な出場機会がありません" }
    : { status: "available", value: numerator / denominator };
}
export function formatMetric(
  value: MetricValue,
  definition: MetricDefinition,
): string {
  if (value.status !== "available") return "—";
  switch (definition.format) {
    case "rate":
      return value.value.toFixed(3).replace(/^0\./, ".");
    case "decimal":
      return value.value.toFixed(2);
    case "percent":
      return `${(value.value * 100).toFixed(1)}%`;
    case "outs": {
      const remainder = value.value % 3;
      return `${Math.floor(value.value / 3)}回${remainder ? ` ${remainder}/3` : ""}`;
    }
    case "count":
      return String(value.value);
  }
}
