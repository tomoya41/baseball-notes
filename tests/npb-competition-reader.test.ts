import { createHash } from "node:crypto";
import { beforeEach,describe,expect,it,vi } from "vitest";
import { readNpbPostseasonAggregates } from "../src/application/npb-competition-reader";
import { parseWikipediaNpbPostseason } from "../src/infrastructure/providers/wikipedia-npb-historical";
import source from "./fixtures/npb-historical/wikipedia-postseason.json";
const test=vi.hoisted(()=>({pin:{sha256:"a".repeat(64),bodySha256:"",bytes:0,inputSha256:"b".repeat(64),players:1,rows:4},remember:vi.fn()}));
vi.mock("../src/data/npb-postseason-release.json",()=>({default:test.pin}));
vi.mock("../src/infrastructure/public-response-cache",()=>({publicDataFetch:vi.fn(),rememberPublicResponse:test.remember}));
const parsed=parseWikipediaNpbPostseason(source.page,source.bridge,[2023,2024,2025]);
const fixture={schemaVersion:1,provider:"Wikipedia",license:"CC-BY-SA-4.0",temporalScope:"historical",coverage:"partial",granularity:"season_stage_aggregate",observedAt:"2026-10-02T22:34:47.574Z",inputSha256:test.pin.inputSha256,transformation:"Synthetic reader envelope with licensed excerpt",players:[parsed.player],rows:parsed.rows};
const pin=(body:string)=>{test.pin.bytes=Buffer.byteLength(body);test.pin.bodySha256=createHash("sha256").update(body).digest("hex");};
beforeEach(()=>{test.remember.mockClear();pin(JSON.stringify(fixture));});
describe("NPB scoped aggregate transport/cache boundary",()=>{
  it("requests one bounded admitted file and remembers only validated content",async()=>{
    const request=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(fixture)));
    expect((await readNpbPostseasonAggregates(request)).rows).toHaveLength(4);expect(request).toHaveBeenCalledTimes(1);expect(test.remember).toHaveBeenCalledTimes(1);
    expect(String(request.mock.calls[0]![0])).toContain(`/competitions/${test.pin.sha256}/postseason.json`);
  });
  it("refuses errors or altered content without poisoning an offline response",async()=>{
    await expect(readNpbPostseasonAggregates(vi.fn<typeof fetch>().mockResolvedValue(new Response(null,{status:404})))).rejects.toThrow(/404/);
    const body=JSON.stringify(fixture).replace('"coverage":"partial"','"coverage":"unknown"');
    await expect(readNpbPostseasonAggregates(vi.fn<typeof fetch>().mockResolvedValue(new Response(body)))).rejects.toThrow(/hash/);expect(test.remember).not.toHaveBeenCalled();
  });
  it.each([{temporalScope:"saved_current"},{coverage:"complete"},{provider:"nf3"},{rows:[{...fixture.rows[0]!,season:2026,scope:{...fixture.rows[0]!.scope,season:2026}}]}])("rejects transport-valid wrong semantics %j",async change=>{
    const body=JSON.stringify({...fixture,...change});pin(body);
    await expect(readNpbPostseasonAggregates(vi.fn<typeof fetch>().mockResolvedValue(new Response(body)))).rejects.toThrow();expect(test.remember).not.toHaveBeenCalled();
  });
});
