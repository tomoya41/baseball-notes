import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const css = readFileSync("src/ui/final-design.css", "utf8");
function luminance(hex: string) {
  const channels = hex.replace("#", "").match(/../g)!.map(n => parseInt(n, 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
}
const contrast = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
describe("selected date legibility", () => {
  it("maintains normal-text contrast in both explicit and system dark themes", () => {
    const dark = [...css.matchAll(/--brand: (#[0-9a-f]{6}); --brand-strong: #[0-9a-f]{6}; --brand-soft: #[0-9a-f]{6}; --on-brand: (#[0-9a-f]{6});/g)];
    expect(dark).toHaveLength(3);
    for (const match of dark) expect(contrast(match[1]!, match[2]!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#a43e1d", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});
