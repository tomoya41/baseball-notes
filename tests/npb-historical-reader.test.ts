import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { readNpbHistoricalManifest, readNpbHistoricalSeason } from "../src/application/npb-historical-reader";
import { historicalBattingKeys, npbHistoricalManifestSchema } from "../src/domain/npb-historical";
const remember=vi.hoisted(()=>vi.fn());
vi.mock("../src/infrastructure/public-response-cache",()=>({publicDataFetch:vi.fn(),rememberPublicResponse:remember}));
const id="00000000-0000-4000-8000-000000000001";
const dataset={schemaVersion:1,league:"NPB",temporalScope:"historical",competition:"regular",granularity:"season_aggregate",license:"CC-BY-SA-4.0",observedAt:"2026-10-02T00:00:00Z",inputSha256:"a".repeat(64),transformation:"Synthetic test, never public",coverage:"partial",players:[{playerId:id,name:"テスト",article:"テスト",revision:1,revisionAt:"2026-01-01T00:00:00Z",wikidataId:"Q123",npbId:"12345",contentSha256:"b".repeat(64)}],rows:[{playerId:id,season:2025,role:"batting",teamId:"npb:team:tigers",metrics:Object.fromEntries(historicalBattingKeys.map(k=>[k,null]))}]};
const body=JSON.stringify(dataset);
function index(text=body){return npbHistoricalManifestSchema.parse({schemaVersion:1,league:"NPB",competition:"regular",temporalScope:"historical",coverage:"partial",license:"CC-BY-SA-4.0",inputSha256:dataset.inputSha256,observedAt:dataset.observedAt,seasons:[{season:2025,rows:1,players:1,bytes:Buffer.byteLength(text),sha256:createHash("sha256").update(text).digest("hex")}],players:[{playerId:id,name:"テスト",seasons:[2025]}]});}
describe("NPB Historical bounded validated reader",()=>{
  it("reads one annual payload and commits only verified content for offline reuse",async()=>{
    remember.mockClear();const request=vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    expect((await readNpbHistoricalSeason(2025,index(),request)).rows).toHaveLength(1);expect(request).toHaveBeenCalledTimes(1);expect(remember).toHaveBeenCalledTimes(1);
  });
  it("rejects a changed payload before committing a saved response",async()=>{
    remember.mockClear();const request=vi.fn<typeof fetch>().mockResolvedValue(new Response(body.replace('"name":"テスト"','"name":"changed"')));
    await expect(readNpbHistoricalSeason(2025,index(),request)).rejects.toThrow(/hash/);expect(remember).not.toHaveBeenCalled();
  });
  it.each([{competition:"postseason"},{coverage:"complete"},{inputSha256:"c".repeat(64)},{observedAt:"2026-10-03T00:00:00Z"},{rows:[{...dataset.rows[0],season:2024}]}])("rejects unsupported/cross-generation data %j even with matching transport hash",async change=>{
    const altered=JSON.stringify({...dataset,...change}),request=vi.fn<typeof fetch>().mockResolvedValue(new Response(altered));
    await expect(readNpbHistoricalSeason(2025,index(altered),request)).rejects.toThrow();
  });
  it("does not fetch unavailable seasons or replace missing HTTP data with zero",async()=>{
    const request=vi.fn<typeof fetch>().mockResolvedValue(new Response(null,{status:404}));
    await expect(readNpbHistoricalSeason(2026,index(),request)).rejects.toThrow(/not admitted/);expect(request).not.toHaveBeenCalled();
    await expect(readNpbHistoricalSeason(2025,index(),request)).rejects.toThrow(/404/);
  });
  it("validates manifest shape and refuses oversized payloads",async()=>{
    await expect(readNpbHistoricalManifest(vi.fn<typeof fetch>().mockResolvedValue(new Response('{}')))).rejects.toThrow();
    await expect(readNpbHistoricalSeason(2025,index(),vi.fn<typeof fetch>().mockResolvedValue(new Response(' '.repeat(300001))))).rejects.toThrow(/bound/);
  });
});
