import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalDeepLink } from "../src/domain/native-navigation";

const StandardURL = URL;
const player = "mlb:player:e70b8d12-aa41-50c0-9c1b-d468d451355f";
const playerPath = `/MLB/players/${encodeURIComponent(player)}`;

afterEach(() => vi.unstubAllGlobals());

describe("native links on WebView with opaque non-special URL parsing", () => {
  it("keeps old-WebView cold links without relying on its custom-scheme hostname", () => {
    const customCalls: string[] = [];
    class LegacyWebViewURL extends StandardURL {
      constructor(input: string | URL, base?: string | URL) {
        super(input, base);
        if (/^baseballnotes:/i.test(String(input))) {
          customCalls.push(String(input));
          const opaquePath = `//${super.hostname}${super.pathname}`;
          Object.defineProperty(this, "hostname", { value: "" });
          Object.defineProperty(this, "pathname", { value: opaquePath });
        }
      }
    }
    vi.stubGlobal("URL", LegacyWebViewURL);
    // Official Chromium issue 40283413: non-special URL host/port were not
    // parsed. Fixture models that engine behavior, not a fabricated Game/Player.
    const legacy = new LegacyWebViewURL("baseballnotes://NPB/cs?season=2026");
    expect(legacy.hostname).toBe(""); expect(legacy.pathname).toBe("//NPB/cs");
    customCalls.length = 0;
    expect(canonicalDeepLink("baseballnotes://NPB/schedule?season=2027&date=2027-03-01")).toBe("/NPB/season?season=2027");
    expect(canonicalDeepLink(`baseballnotes://MLB/players/${encodeURIComponent(player)}`)).toBe(playerPath);
    expect(canonicalDeepLink("baseballnotes://NPB/cs?season=2026&stage=npb_cs_final")).toBe("/NPB/cs?season=2026&stage=npb_cs_final");
    expect(canonicalDeepLink("baseballnotes://MLB/monthly?season=2025&month=2025-08")).toBe("/MLB/monthly?season=2025&month=2025-08");
    expect(customCalls).toEqual([]);
  });
  it("normalizes only the admitted league authority, retaining encoded IDs and filters", () => {
    expect(canonicalDeepLink(`BASEBALLNOTES://mlb/players/${encodeURIComponent(player)}?season=2025&date=2025-08-31&token=private`))
      .toBe(`${playerPath}?season=2025&date=2025-08-31`);
    expect(canonicalDeepLink("baseballnotes://npb/cs?season=2026&q=A%26B%3DC%25")).toBe("/NPB/cs?season=2026&q=A%26B%3DC%25");
    expect(canonicalDeepLink(`https://tomoya41.github.io/baseball-notes/#${playerPath}?season=2025`)).toBe(`${playerPath}?season=2025`);
  });
  it.each([
    "baseballnotes://evil.example/NPB/cs", "baseballnotes://NPB.evil.example/cs", "baseballnotes://user@NPB/cs",
    "baseballnotes://NPB:443/cs", "baseballnotes://%4ePB/cs", "baseballnotes:////NPB/cs", "baseballnotes:NPB/cs",
    "baseballnotes://NPB\\cs", "baseballnotes://NPB/cs#ignored", "baseballnotes://NPB/cs?q=raw space",
    "baseballnotes://NPB/cs\n?season=2026", "https://evil.example/baseball-notes/#/NPB/cs",
    "https://tomoya41.github.io/other/#/NPB/cs", "http://tomoya41.github.io/baseball-notes/#/NPB/cs",
  ])("does not widen accepted schemes, authorities or malformed URLs: %s", input => {
    expect(canonicalDeepLink(input)).toBeNull();
  });
});
