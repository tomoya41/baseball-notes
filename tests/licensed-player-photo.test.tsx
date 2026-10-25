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
        expect(identities.find((i:{playerId:string})=>i.playerId===p.playerId)).toMatchObject({wikidataId:p.qid,npbId:'npbId' in p?p.npbId:undefined,verificationStatus:'source_verified'});
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
  it("keeps Japan Series additions dated and available only for the exact approved identity/years",()=>{
    for(const id of ["21a327b4-3924-422a-a1fc-d853e236a201","fe02470d-7c15-4c03-8a17-d6d339445ebe","2b2a8d97-2a6e-441c-9a33-0d79d2a7d147","304e870e-71ba-4df7-8682-99ad852ee751"]){
      const p=licensedPlayerPhotos.find(p=>p.playerId===id)!;
      const render=(who:string,year:number)=>renderToStaticMarkup(<MemoryRouter><LicensedPlayerPhoto playerId={who} season={year}/></MemoryRouter>);
      expect(render(id,2026)).toContain(`${p.season}年撮影`);
      expect(render(p.name,2026)).toBe("");expect(render(id,p.season-1)).toBe("");expect(render(id,2027)).toBe("");
      expect(render(id,2026)).not.toContain("予告先発");
    }
  });
  it("does not attach ShareAlike obligations to the independently released CC0 photograph",()=>{
    const text=renderToStaticMarkup(<PlayerPhotoCredits/>);
    const sugiyama=text.split("杉山一樹の原写真・履歴")[1]!.split("</p>")[0];
    expect(sugiyama).toContain("CC0 1.0");expect(sugiyama).toContain("Hotta Akahane");
    expect(sugiyama).not.toContain("同じライセンス");
  });
});
