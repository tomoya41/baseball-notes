import { expect, it } from "vitest";
import { historicalImportYears, yearsForSavedIdentity } from "../src/data/npb-historical-years";
it("preserves default years and excludes Current 2026", () => {
  expect(historicalImportYears(2015, false)).toEqual(Array.from({ length: 11 }, (_, i) => 2015 + i));
  expect(historicalImportYears(2005, true).at(-1)).toBe(2025);
});
it("requires independently selected Directory scope before older-year expansion", () => {
  expect(() => historicalImportYears(2010, false)).toThrow("Directory");
  for (const year of [1999, 2026, NaN, 2012.5]) expect(() => historicalImportYears(year, true)).toThrow();
});
it("expands only saved Directory identities and never broadens OB rows", () => {
  const years = [2005, 2014, 2015, 2025], ids = new Set(["current"]);
  expect(yearsForSavedIdentity(years, "current", false, ids)).toEqual(years);
  expect(yearsForSavedIdentity(years, "current", true, ids)).toEqual([2015, 2025]);
  expect(yearsForSavedIdentity(years, "unknown", false, ids)).toEqual([2015, 2025]);
});
