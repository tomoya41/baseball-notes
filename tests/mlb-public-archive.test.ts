import { describe, expect, it } from "vitest";
import { historicalPublicArchivePointer, parseHistoricalPublicArchive, validateHistoricalArchiveMembers, verifyHistoricalArchive } from "../src/data/mlb-public-archive";

describe("MLB public aggregate archive preservation", () => {
  it("uses a content-addressed asset in the existing repository", () => {
    const archive = new TextEncoder().encode("public aggregates only");
    const pointer = historicalPublicArchivePointer(archive);
    expect(parseHistoricalPublicArchive(pointer)).toEqual(pointer);
    expect(historicalPublicArchivePointer(archive)).toEqual(pointer);
    expect(() => verifyHistoricalArchive(archive, pointer.sha256)).not.toThrow();
    expect(() => verifyHistoricalArchive(new Uint8Array([0]), pointer.sha256)).toThrow("checksum");
  });
  it.each(["https://example.com/archive", "https://github.com/another/repo/releases/download/a/archive",
    "https://github.com/tomoya41/baseball-notes/releases/download/../historical-payload.tar.gz"])("rejects an untrusted URL: %s", assetUrl => {
    expect(() => parseHistoricalPublicArchive({ schemaVersion: 1, sha256: "a".repeat(64), assetUrl })).toThrow();
  });
  it("rejects missing or malformed metadata", () => {
    expect(() => parseHistoricalPublicArchive(null)).toThrow();
    expect(() => parseHistoricalPublicArchive({ schemaVersion: 2 })).toThrow();
  });
  it("permits only payload members, including the legacy archive layout", () => {
    expect(() => validateHistoricalArchiveMembers(["historical/", "historical/manifest.json.gz"])).not.toThrow();
    for (const names of [[], ["raw/plays.csv"], ["historical/../secret"], ["/historical/a"], ["historical\\a"]])
      expect(() => validateHistoricalArchiveMembers(names)).toThrow();
  });
});
