// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps NPB condition disclosures stacked while MLB's condition selector stays inline", () => {
  document.body.innerHTML = `
    <details class="analysis-condition" open><summary>対戦相手</summary><section>成績</section></details>
    <label class="analysis-condition">条件<select><option>打順</option></select></label>
  `;
  const style = document.createElement("style");
  try {
    style.textContent = readFileSync("src/ui/styles.css", "utf8");
    document.head.append(style);
    expect(window.getComputedStyle(document.querySelector("details")!).display).toBe("block");
    expect(window.getComputedStyle(document.querySelector("label")!).display).toBe("flex");
  } finally {
    style.remove();
    document.body.replaceChildren();
  }
});
