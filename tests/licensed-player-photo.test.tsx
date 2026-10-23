import { licensedPlayerPhotos } from "../src/presentation/licensed-player-photos";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { LicensedPlayerPhoto, PlayerPhotoCredits } from "../src/ui/licensed-player-photo";

describe("reviewed informational player portraits", () => {
  it("uses exact canonical ID and a dated historical portrait, never a name or current-roster inference", () => {
    const photo = licensedPlayerPhotos[0];
    const render = (id: string, season: number) => renderToStaticMarkup(<MemoryRouter><LicensedPlayerPhoto playerId={id} season={season} /></MemoryRouter>);
    expect(render(photo.playerId, 2024)).toContain("2024年撮影");
    expect(render(photo.playerId, 2025)).toContain("2024年撮影");
    expect(render(photo.playerId, 2023)).toBe("");
    expect(render(photo.playerId, 2026)).toBe("");
    expect(render("大谷翔平", 2024)).toBe("");
    expect(render(photo.playerId, 2024)).toContain("/MLB/sources");
  });
  it("pins the source bytes and matches existing independent QID bridges", () => {
    const cohort = JSON.parse(readFileSync("src/data/mlb-japan-cohort.json", "utf8"));
    for (const p of licensedPlayerPhotos) {
      expect(JSON.stringify(cohort)).toContain(`"${p.playerId}":"https://www.wikidata.org/entity/${p.qid}"`);
      const file = p.playerId === licensedPlayerPhotos[0].playerId ? "ohtani-2024" : "yamamoto-2024";
      expect(createHash("sha256").update(readFileSync(`src/assets/players/${file}-v1.webp`)).digest("hex")).toBe(p.sha256);
      expect(p.sourceSha1).toMatch(/^[a-f0-9]{40}$/);
    }
  });
  it("retains creator, changes, source revision and ShareAlike conditions", () => {
    const text = renderToStaticMarkup(<PlayerPhotoCredits />);
    for (const p of licensedPlayerPhotos) {
      expect(text).toContain(p.author); expect(text).toContain(p.source.replaceAll("&", "&amp;")); expect(text).toContain(p.licenseUrl);
    }
    expect(text).toContain("現在の所属・背番号");
    expect(text).toContain("同じライセンス");
  });
});
