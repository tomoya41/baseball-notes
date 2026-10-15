import {createHash} from "node:crypto";
import {describe,expect,it,vi} from "vitest";
import {verifyRetainedFiles} from "../scripts/verify-npb-historical-publication";
import legacy from "../src/data/npb-historical-legacy-release.json";
const body=Buffer.from("immutable v3"),pin={bytes:body.length,sha256:createHash("sha256").update(body).digest("hex")};
describe("retained Historical publication guard",()=>{
  it("pins the complete legacy manifest and eleven annual URLs",()=>{
    expect(Object.keys(legacy.files).sort()).toEqual(["manifest.json",...Array.from({length:11},(_,i)=>`${2015+i}.json`)].sort());
  });
  it("verifies every retained file even when the new generation is valid",async()=>{
    const read=vi.fn().mockResolvedValue(body);expect(await verifyRetainedFiles(read,{"manifest.json":pin,"2025.json":pin})).toBe(2);expect(read.mock.calls.map(([p])=>p)).toEqual(["manifest.json","2025.json"]);
  });
  it("rejects altered or missing root files instead of reporting a new-family-only PASS",async()=>{
    await expect(verifyRetainedFiles(vi.fn().mockResolvedValue(Buffer.from("altered data")),{"2025.json":pin})).rejects.toThrow(/Retained/);
    await expect(verifyRetainedFiles(vi.fn().mockRejectedValue(Error("HTTP 404")),{"manifest.json":pin})).rejects.toThrow(/404/);
  });
});
