import {expect,it} from "vitest";
import {npbSeasonalHome} from "../src/domain/npb-seasonal-home";

it.each([["2026-01-15", "winter"],["2026-02-01","spring"],["2026-03-31","spring"],["2026-04-01","regular"],["2026-09-30","regular"],["2026-10-01","autumn"],["2026-11-01","winter"]])("selects an editorial season on the Japanese calendar: %s",(date,mode)=>{
 expect(npbSeasonalHome(Date.parse(date+"T03:00:00Z")).mode).toBe(mode);
});
it("switches at Japan midnight, keeps user selection explicit, and never presents old CS as a new year's event",()=>{
 expect(npbSeasonalHome(Date.parse("2026-10-31T15:00:00Z")).mode).toBe("winter");
 const date=Date.parse("2027-02-01T00:00:00Z");
 expect(npbSeasonalHome(date,"autumn")).toMatchObject({mode:"autumn",automatic:"spring",manual:true});
 expect(npbSeasonalHome(date,"autumn").links[0]!.label).toContain("2026年");
 expect(npbSeasonalHome(date,"invalid")).toMatchObject({mode:"spring",manual:false});
 expect(npbSeasonalHome(date).links.some(l=>l.to.includes("view=young"))).toBe(true);
 expect(npbSeasonalHome(date).links.some(l=>l.label.includes("前年"))).toBe(false);
 for(const mode of ["spring","regular","autumn","winter"])expect(npbSeasonalHome(date,mode).links.some(l=>/ranking|\/form/.test(l.to))).toBe(false);
});
