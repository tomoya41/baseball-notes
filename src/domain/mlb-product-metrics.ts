import type { ExplorerValues } from "./data-explorer";
import { seasonCheckpointSteps } from "./npb-season-milestones";

/** MLB Game Facts: BB includes IBB, excludes HBP; BF/PA are official completed opportunities. */
export function mlbProductMetrics(input: ExplorerValues | null, role: "batting" | "pitching"): ExplorerValues | null {
  if (!input) return null;
  const result = { ...input };
  const rate = (key: string, numerator: string[], denominator: string, scale: number) => {
    const fields = [...numerator, denominator].map(k => input[k]);
    const complete = fields.every(m => m?.status === "complete" && m.value !== null);
    result[key] = { value: complete && input[denominator]!.value! > 0
      ? numerator.reduce((n, k) => n + input[k]!.value!, 0) * scale / input[denominator]!.value! : null,
    status: complete ? input[denominator]!.value! > 0 ? "complete" : "unavailable" : fields.some(m => m?.status === "partial") ? "partial" : "unavailable" };
  };
  rate("K%", ["SO"], role === "batting" ? "PA" : "BF", 100);
  rate("BB%", ["BB"], role === "batting" ? "PA" : "BF", 100);
  if (role === "pitching") {
    rate("WHIP", ["H", "BB"], "outsRecorded", 3);
    rate("BB9", ["BB"], "outsRecorded", 27);
  }
  return result;
}

/** Shared with Watch. These are season checkpoints, never Career totals or achievement dates. */
export function seasonCheckpoints(batting: ExplorerValues | null, pitching: ExplorerValues | null) {
  return Object.entries(seasonCheckpointSteps).flatMap(([metric, step]) => {
    const role = ["H", "HR", "RBI", "SB"].includes(metric) ? "batting" : "pitching";
    const m = (role === "batting" ? batting : pitching)?.[metric];
    if (m?.status !== "complete" || m.value === null || !Number.isSafeInteger(m.value) || m.value < 0) return [];
    const previous = Math.floor(m.value / step) * step, next = previous + step;
    return [{ metric, role, value: m.value, step, previous, next, remaining: next - m.value }];
  });
}
