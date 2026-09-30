import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { MlbHistoricalRoutes } from "../src/ui/mlb-historical";

vi.mock("../src/ui/use-mlb-historical", () => ({
  useHistoricalStatic: () => { throw Error("No network or cached manifest on first offline launch"); },
}));
describe("bundled offline attribution", () => {
  it("renders mandatory source credits without reading the data manifest", () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={["/MLB/sources"]}>
      <MlbHistoricalRoutes favorites={[]} saving={false} toggle={() => undefined} />
    </MemoryRouter>);
    expect(html).toContain("Retrosheet"); expect(html).toContain("Chadwick Register");
    expect(html).toContain("ODC Attribution License");
  });
});
