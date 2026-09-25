import { metrics } from "../domain/metrics";
import { formatMetric } from "./formatters";

export function formatRecentMetric(key: string, metric: { value: number | null; status: string } | undefined): string {
  if (!metric || metric.status !== "complete" || metric.value === null) return "—";
  if (key === "outsRecorded") return Number.isInteger(metric.value) && metric.value >= 0
    ? `${Math.floor(metric.value / 3)}.${metric.value % 3}` : "—";
  const definition = ({ AVG: metrics.avg, OBP: metrics.obp, SLG: metrics.slg, OPS: metrics.ops,
    ERA: metrics.era, K9: { ...metrics.era!, precision: 1 } } as Record<string, typeof metrics[string]>)[key];
  return definition ? formatMetric({ status: "available", value: metric.value }, definition) :
    new Intl.NumberFormat("ja-JP").format(metric.value);
}
