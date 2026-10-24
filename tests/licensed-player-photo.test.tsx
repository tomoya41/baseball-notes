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
      if(p.playerId.startsWith('mlb:'))expect(JSON.stringify(cohort)).toContain(`"${p.playerId}":"https://www.wikidata.org/entity/${p.qid}"`);
      else {
        const identities=JSON.parse(readFileSync('src/data/npb-free-profile-identities.json','utf8'));
        expect(identities.find((i:{playerId:string})=>i.playerId===p.playerId)).toMatchObject({wikidataId:p.qid,npbId:'41745135',verificationStatus:'source_verified'});
      }
      expect(createHash("sha256").update(readFileSync(`src/assets/players/${p.assetName}-v1.webp`)).digest("hex")).toBe(p.sha256);
      expect(p.sourceSha1).toMatch(/^[a-f0-9]{40}$/);
    }
  });
  it("dates the independently bridged NPB portrait and never assigns it by a matching name",()=>{
    const photo=licensedPlayerPhotos[2];
    const render=(id:string,season:number)=>renderToStaticMarkup(<MemoryRouter><LicensedPlayerPhoto playerId={id} season={season}/></MemoryRouter>);
    for(const year of [2023,2024,2025,2026])expect(render(photo.playerId,year)).toContain('2023年撮影');
    expect(render(photo.playerId,2022)).toBe('');expect(render(photo.name,2026)).toBe('');
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
