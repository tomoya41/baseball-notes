/** Supported parser/contract range; publication still requires per-season validation. */
export const MLB_HISTORICAL_SEASONS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025] as const;
export const MLB_BASELINE_SEASONS = [2020, 2021, 2022, 2023, 2024, 2025] as const;
export const MLB_HISTORICAL_RANGE = "2016–2025";
export function supportedHistoricalSeason(year: number): boolean {
  return (MLB_HISTORICAL_SEASONS as readonly number[]).includes(year);
}
