import {createHash} from "node:crypto";
import {describe,expect,it,vi} from "vitest";
import {verifyRetainedFiles} from "../scripts/verify-npb-historical-publication";
import legacy from "../src/data/npb-historical-legacy-release.json";
import retained from "../src/data/npb-historical-retained-releases.json";
import retainedCs from "../src/data/npb-cs-retained-releases.json";
import currentCs from "../src/data/npb-cs-release.json";
const body=Buffer.from("immutable v3"),pin={bytes:body.length,sha256:createHash("sha256").update(body).digest("hex")};
describe("retained Historical publication guard",()=>{
  it("retains the first published CS generation when a later parser admits another participant",()=>{
    const original=retainedCs.find(p=>p.sha256==="2f66f68780e7c7605ad45a55f455535532f8a4011ccab18e60859821fab1e836");
    expect(original).toMatchObject({bytes:111154,games:8,players:125,rows:125,bodySha256:"be7bc59301fa222850bd7301a4f62857064ccda3ffdece09192c1a221e92df71"});
    expect(retainedCs.every(p=>p.sha256!==currentCs.sha256)).toBe(true);
  });
  it("pins the complete legacy manifest and eleven annual URLs",()=>{
    expect(Object.keys(legacy.files).sort()).toEqual(["manifest.json",...Array.from({length:11},(_,i)=>`${2015+i}.json`)].sort());
  });
  it("also protects every namespaced generation used by installed APKs",()=>{
    expect(retained.length).toBeGreaterThan(0);
    for(const pin of retained){expect(pin.sha256).toMatch(/^[a-f0-9]{64}$/);expect(Object.keys(pin.files).sort()).toEqual(Object.keys(legacy.files).sort());}
  });
  it("verifies every retained file even when the new generation is valid",async()=>{
    const read=vi.fn().mockResolvedValue(body);expect(await verifyRetainedFiles(read,{"manifest.json":pin,"2025.json":pin})).toBe(2);expect(read.mock.calls.map(([p])=>p)).toEqual(["manifest.json","2025.json"]);
  });
  it("rejects altered or missing root files instead of reporting a new-family-only PASS",async()=>{
    await expect(verifyRetainedFiles(vi.fn().mockResolvedValue(Buffer.from("altered data")),{"2025.json":pin})).rejects.toThrow(/Retained/);
    await expect(verifyRetainedFiles(vi.fn().mockRejectedValue(Error("HTTP 404")),{"manifest.json":pin})).rejects.toThrow(/404/);
  });
});
