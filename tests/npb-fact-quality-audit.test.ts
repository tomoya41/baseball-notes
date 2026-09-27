import { describe, expect, it } from "vitest";
import { assessStoredPa, unresolvedGameEvidence } from "../scripts/audit-npb-fact-quality";

const completeCounts = { ab: 2, walks: 1, hbp: 0, sacrifice_hits: 0, sacrifice_flies: 0 };

describe("read-only NPB Fact quality audit", () => {
  it("retains unresolved canonical Game evidence and stable reason codes without classifying it complete",()=>{
    const result=unresolvedGameEvidence([{game_id:"g",game_date:"2026-03-31"}],
      [{game_id:"g",game_status:"partial",issues_json:JSON.stringify(["Unresolved possible existing/transferred player", "Check failed: plateAppearances"])},
        {game_id:"ok",game_status:"complete",issues_json:"[]"}]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({gameId:"g",date:"2026-03-31",status:"partial",reasonCodes:["identity_unresolved","validation_failure"]});
  });
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
