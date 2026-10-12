import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { MlbFollowPlayer } from "../src/ui/mlb-follow-board";
const fixture = vi.hoisted(() => ({ status: "ready", value: { seasonTotals: {
  "2024": { batting: { PA: { value: 731 }, OPS: { value: 1.036 }, HR: { value: 54 } }, pitching: null },
  "2023": { batting: { PA: { value: 599 }, OPS: { value: 1.066 }, HR: { value: 44 } }, pitching: { ERA: { value: 3.14 }, SO: { value: 167 } } },
} }, retry: () => {} }));
vi.mock("../src/ui/use-mlb-historical", () => ({ useHistoricalStatic: () => fixture }));
const player = { id: "mlb:player:e70b8d12-aa41-50c0-9c1b-d468d451355f", name: "大谷翔平", positions: ["P", "DH"], seasons: [2023, 2024, 2025] };
function card(season: number) { return renderToStaticMarkup(<MemoryRouter><MlbFollowPlayer player={player} season={season} favorites={[]} toggle={() => {}} saving={false} featured /></MemoryRouter>); }
describe("Home player season context", () => {
  it("keeps batting-only recorded seasons without carrying pitching roles from other years", () => {
    const html = card(2024); expect(html).toContain("2024年 · 打撃"); expect(html).toContain("1.036"); expect(html).toContain("54"); expect(html).not.toContain("投球"); expect(html).not.toContain("投手・指名打者");
  });
  it("retains both sets of recorded facts when both exist in the selected year", () => {
    const html = card(2023); expect(html).toContain("2023年 · 打撃・投球"); expect(html).toContain("1.066"); expect(html).toContain("3.14"); expect(html).toContain("167");
  });
  it("does not substitute another year's numbers for a missing selected season", () => {
    const html = card(2025); expect(html).toContain("2025年の成績は未収録"); expect(html).not.toContain("1.036"); expect(html).not.toContain("3.14");
  });
});
