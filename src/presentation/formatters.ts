import type { SampleSize } from "../domain/analysis";
import { pitchTypeDefinitions, positionDefinitions } from "../domain/baseball-terms";
import type { PitchType, PositionCode } from "../domain/baseball-terms";
import type { League, MetricDefinition, MetricValue, Player, Team } from "../domain/models";

const missing = "—";
const valid = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value);
const number = (value: number, digits: number) =>
  new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

export function formatMetric(value: MetricValue, definition: MetricDefinition): string {
  if (value.status !== "available" || !valid(value.value)) return missing;
  const amount = value.value;
  switch (definition.format) {
    case "rate":
      return number(amount, definition.precision).replace(/^0\./, ".");
    case "decimal":
      return number(amount, definition.precision);
    case "percent":
      return `${number(amount * 100, definition.precision)}%`;
    case "outs": {
      if (!Number.isInteger(amount) || amount < 0) return missing;
      const remainder = amount % 3;
      return `${Math.floor(amount / 3)}回${remainder ? ` ${remainder}/3` : ""}`;
    }
    case "count":
      return number(amount, definition.precision);
  }
}

export function formatVelocity(
  value: number | null | undefined,
  unit: "mph" | "km/h",
  showOriginal = false,
): string {
  if (!valid(value)) return missing;
  const primary = `${number(unit === "mph" ? value * 1.609344 : value, 1)} km/h`;
  return showOriginal && unit === "mph" ? `${primary}（${number(value, 1)} mph）` : primary;
}

export function formatDistance(
  value: number | null | undefined,
  unit: "m" | "ft",
  showOriginal = false,
): string {
  if (!valid(value)) return missing;
  const primary = `${number(unit === "ft" ? value * 0.3048 : value, 1)} m`;
  return showOriginal && unit === "ft" ? `${primary}（${number(value, 1)} ft）` : primary;
}

export function formatHeight(
  value: number | null | undefined,
  unit: "cm" | "in",
  showOriginal = false,
): string {
  if (!valid(value)) return missing;
  const primary = `${number(unit === "in" ? value * 2.54 : value, 0)} cm`;
  return showOriginal && unit === "in" ? `${primary}（${number(value, 1)} in）` : primary;
}

export function formatWeight(
  value: number | null | undefined,
  unit: "kg" | "lb",
  showOriginal = false,
): string {
  if (!valid(value)) return missing;
  const primary = `${number(unit === "lb" ? value * 0.45359237 : value, 1)} kg`;
  return showOriginal && unit === "lb" ? `${primary}（${number(value, 1)} lb）` : primary;
}

// Timestamps remain UTC/offset-aware in storage; only presentation uses JST.
export function formatDateTime(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return missing;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}

export function formatDate(value: string | null | undefined, short = false): string {
  if (!value) return missing;
  // A date-only baseball business date must not shift with the viewer's timezone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day || new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== value) return missing;
    return short ? `${month}月${day}日` : `${year}年${month}月${day}日`;
  }
  if (!Number.isFinite(Date.parse(value))) return missing;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: short ? undefined : "numeric",
    month: "long", day: "numeric",
  }).format(new Date(value));
}

export function formatInning(inning: number | null | undefined, half: "top" | "bottom"): string {
  return valid(inning) && Number.isInteger(inning) && inning > 0
    ? `${inning}回${half === "top" ? "表" : "裏"}` : missing;
}

export function formatPlayerName(player: Player): string {
  return player.names.japanese ?? player.names.english ?? player.names.canonical;
}

export function formatTeamName(team: Team | null | undefined, style: "full" | "short" | "code" = "full"): string {
  if (!team) return "所属情報なし";
  if (style === "code") return team.names.abbreviation ?? team.names.japaneseShort ?? team.names.canonical;
  if (style === "short") return team.names.japaneseShort ?? team.names.japaneseFull ?? team.names.canonical;
  return team.names.japaneseFull ?? team.names.canonical;
}

export function formatPositions(positions: readonly PositionCode[], detailed = false): string {
  if (positions.length === 0) return "守備位置不明";
  return positions.map((code) => detailed ? `${code} ${positionDefinitions[code]}` : code).join(" / ");
}

export function formatPitchType(type: PitchType | null | undefined): string {
  return type ? pitchTypeDefinitions[type].ja : "球種不明";
}

export function formatSample(size: SampleSize, unit: keyof SampleSize): string {
  const count = size[unit];
  if (!valid(count)) return "母数不明";
  const labels: Record<keyof SampleSize, string> = {
    PA: "打席", AB: "打数", BF: "対戦打者", pitches: "球", swings: "スイング",
    "outside-zone-pitches": "ゾーン外投球", BBE: "計測打球", outs: "アウト", matchups: "対戦",
  };
  return `${number(count, 0)}${labels[unit]}`;
}

export function formatSampleWarning(warning: string | null): string | null {
  if (warning === null) return null;
  if (warning.includes("不明")) return "母数不明";
  return warning.includes("サンプルが少ない") ? "参考値" : null;
}

// A top-% label is only safe when the percentile's ranking semantics are known.
export function formatTopPercentile(
  percentile: number | null | undefined,
  definition: MetricDefinition,
  league: League,
): string | null {
  if (!valid(percentile) || percentile < 0 || percentile > 100 ||
      !definition.percentileBasis || definition.higherIsBetter === undefined) return null;
  const favorablePercentile = definition.percentileBasis === "performance" || definition.higherIsBetter
    ? percentile : 100 - percentile;
  return `${league} 上位${number(100 - favorablePercentile, 0)}%`;
}
