// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatTable } from "../src/ui/stat-table";
import { MetricLabel } from "../src/ui/components";
let root: Root, container: HTMLDivElement;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const render = async (node: ReactNode) => act(async () => root.render(node));

describe("responsive statistics without a separate scroll region", () => {
  it("keeps a single data tree, zero and unknown values, and names every cell", async () => {
    await render(<StatTable><thead><tr><th>選手</th><th><MetricLabel metric="OPS" /></th><th>H</th></tr></thead><tbody>{["長い選手名", "別の選手"].map(name => <tr key={name}><th scope="row">{name}</th><td>—</td><td>0</td></tr>)}</tbody></StatTable>);
    expect(document.querySelectorAll("table")).toHaveLength(1);
    expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
    expect([...document.querySelectorAll("td .stat-table-content")].map(c => c.textContent)).toEqual(["—", "0", "—", "0"]);
    for (const cell of document.querySelectorAll("td")) {
      const [column, row] = cell.getAttribute("headers")!.split(" ");
      expect(document.getElementById(column!)?.getAttribute("scope")).toBe("col");
      expect(document.getElementById(row!)?.getAttribute("scope")).toBe("row");
    }
    expect(document.querySelector(".stat-table-label")?.textContent).toBe("OPS");
    expect(document.querySelector(".stat-table-label")?.getAttribute("aria-hidden")).toBe("true");
  });
  it("retains lineup order when the player identity is the second column", async () => {
    await render(<StatTable><thead><tr><th>打順</th><th>選手</th><th>H</th></tr></thead><tbody><tr><td>2番</td><th scope="row">選手名</th><td>3</td></tr></tbody></StatTable>);
    expect(document.querySelector(".stat-table-identity")?.textContent).toBe("選手名");
    expect(document.querySelector("td .stat-table-label")?.textContent).toBe("打順");
    expect(document.querySelector("td .stat-table-content")?.textContent).toBe("2番");
  });
});
