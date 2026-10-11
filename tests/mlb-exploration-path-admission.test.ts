import { describe, expect, it } from "vitest";
import { validStaticPayload } from "../src/domain/mlb-historical-public";

describe.each([2014, 2015])("Historical exploration path admission %i", season => {
  it.each(["regular", "postseason"] as const)("validates index/month paths against the %s payload schema", competitionType => {
    const base = { schemaVersion: 1, league: "MLB", season, competitionType, sourceFingerprint: "a".repeat(64) };
    const index = { ...base, firstDate: `${season}-08-01`, lastDate: `${season}-08-31`, coverage: "complete", gameCount: 0, months: [] };
    const month = { ...base, month: `${season}-08`, players: [], teams: [], batting: [] };
    const prefix = competitionType === "postseason" ? "postseason/" : "";
    for (const family of ["recent", "form"] as const) {
      const payloads = family === "recent" ? [index, { ...month, pitching: [] }] :
        [{ ...index, roleSourceHash: "b".repeat(64), roles: [] }, { ...month, starters: [], relievers: [], unknown: [] }];
      for (const [i, suffix] of ["index", `${season}-08`].entries()) {
        const path = `${prefix}exploration/${family}/${season}/${suffix}.json`, payload = payloads[i]!;
        expect(validStaticPayload(path, payload)).toBe(true);
        expect(validStaticPayload(path.replace(`/${season}/`, "/2013/"), payload)).toBe(false);
        expect(validStaticPayload(path, { ...payload, season: 2013 })).toBe(false);
        expect(validStaticPayload(path, { ...payload, season: 2026 })).toBe(false);
        expect(validStaticPayload(path, { ...payload, competitionType: competitionType === "regular" ? "postseason" : "regular" })).toBe(false);
      }
      expect(validStaticPayload(`${prefix}exploration/${family}/${season}/${season}-09.json`, payloads[1])).toBe(false);
    }
  });
});
