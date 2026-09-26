import { describe, expect, it } from "vitest";
import { assessStoredPa } from "../scripts/audit-npb-fact-quality";

const completeCounts = { ab: 2, walks: 1, hbp: 0, sacrifice_hits: 0, sacrifice_flies: 0 };

describe("read-only NPB Fact quality audit", () => {
  it("keeps a known zero PA distinct from an unknown PA", () => {
    expect(assessStoredPa({ ...completeCounts, pa: 0 }).kind).toBe("known_zero");
    expect(assessStoredPa({ ...completeCounts, pa: null }).kind).toBe("field_complete_unverified");
  });

  it("does not reconstruct intentionally null PA from counting fields without source-token evidence", () => {
    expect(assessStoredPa({ ...completeCounts, pa: null }).safelyDerivable).toBe(false);
    expect(assessStoredPa({ ...completeCounts, pa: null }, true).safelyDerivable).toBe(true);
    expect(assessStoredPa({ ...completeCounts, hbp: null, pa: null }, true).safelyDerivable).toBe(false);
  });

  it("reports missing nullable fields instead of turning them into zero", () => {
    expect(assessStoredPa({ ...completeCounts, sacrifice_flies: null, pa: null }).kind).toBe("missing_fields");
  });
});
