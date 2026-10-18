import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { readNpbHistoricalManifest, readNpbHistoricalSeason } from "../src/application/npb-historical-reader";
import { publicDataFetch } from "../src/infrastructure/public-response-cache";
import { historicalBattingKeys, npbHistoricalManifestSchema } from "../src/domain/npb-historical";
import release from "../src/data/npb-historical-release.json";
const remember=vi.hoisted(()=>vi.fn());
vi.mock("../src/infrastructure/public-response-cache",()=>({publicDataFetch:vi.fn(),rememberPublicResponse:remember}));
const id="00000000-0000-4000-8000-000000000001";
const dataset={schemaVersion:1,league:"NPB",temporalScope:"historical",competition:"regular",granularity:"season_aggregate",license:"CC-BY-SA-4.0",observedAt:"2026-10-02T00:00:00Z",inputSha256:"a".repeat(64),transformation:"Synthetic test, never public",coverage:"partial",players:[{playerId:id,name:"テスト",article:"テスト",revision:1,revisionAt:"2026-01-01T00:00:00Z",wikidataId:"Q123",npbId:"12345",contentSha256:"b".repeat(64)}],rows:[{playerId:id,season:2025,role:"batting",teamId:"npb:team:tigers",metrics:Object.fromEntries(historicalBattingKeys.map(k=>[k,null]))}]};
const body=JSON.stringify(dataset);
function index(text=body){return npbHistoricalManifestSchema.parse({schemaVersion:1,league:"NPB",competition:"regular",temporalScope:"historical",coverage:"partial",license:"CC-BY-SA-4.0",inputSha256:dataset.inputSha256,observedAt:dataset.observedAt,seasons:[{season:2025,rows:1,players:1,bytes:Buffer.byteLength(text),sha256:createHash("sha256").update(text).digest("hex")}],players:[{playerId:id,name:"テスト",seasons:[2025]}]});}
describe("NPB Historical bounded validated reader",()=>{
  it("separates overlapping corrected annual reads even when their source archive is unchanged",async()=>{
    const corrected=JSON.stringify({...dataset,transformation:"Corrected normalized data"});
    let resolveOld!:(r:Response)=>void,resolveNew!:(r:Response)=>void;
    vi.mocked(publicDataFetch).mockReset().mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve;})).mockImplementationOnce(()=>new Promise(resolve=>{resolveNew=resolve;}));
    const old=readNpbHistoricalSeason(2025,index()),current=readNpbHistoricalSeason(2025,index(corrected));
    expect(publicDataFetch).toHaveBeenCalledTimes(2);
    resolveNew(new Response(corrected));resolveOld(new Response(body));
    expect((await current).transformation).toBe("Corrected normalized data");expect((await old).transformation).toBe(dataset.transformation);
  });
  it("revalidates each caller's generation metadata even when the annual hash is shared",async()=>{
    let resolve!:(r:Response)=>void;
    vi.mocked(publicDataFetch).mockReset().mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
    const first=readNpbHistoricalSeason(2025,index());
    const other=readNpbHistoricalSeason(2025,{...index(),observedAt:"2026-10-03T00:00:00Z"});
    const rejection=expect(other).rejects.toThrow(/generation/);
    resolve(new Response(body));await first;await rejection;expect(publicDataFetch).toHaveBeenCalledTimes(1);
  });
  it("reads one annual payload and commits only verified content for offline reuse",async()=>{
    remember.mockClear();const request=vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    expect((await readNpbHistoricalSeason(2025,index(),request)).rows).toHaveLength(1);expect(request).toHaveBeenCalledTimes(1);expect(remember).toHaveBeenCalledTimes(1);
    expect(String(request.mock.calls[0]?.[0])).toContain(`/historical/${release.sha256}/2025.json`);
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
  it("requires historical-only DOB metadata to match the verified annual identity before caching",async()=>{
    const text=JSON.stringify({...dataset,players:[{...dataset.players[0]!,identityScope:"historical_only",birthDate:"1980-04-01"}]}),m=index(text);
    m.players[0]!.identityScope="historical_only";m.players[0]!.birthDate="1980-04-01";
    expect((await readNpbHistoricalSeason(2025,m,vi.fn<typeof fetch>().mockResolvedValue(new Response(text)))).players[0]!.birthDate).toBe("1980-04-01");
    remember.mockClear();m.players[0]!.birthDate="1981-04-01";
    await expect(readNpbHistoricalSeason(2025,m,vi.fn<typeof fetch>().mockResolvedValue(new Response(text)))).rejects.toThrow(/generation/);expect(remember).not.toHaveBeenCalled();
    delete m.players[0]!.identityScope;expect(npbHistoricalManifestSchema.safeParse(m).success).toBe(false);
  });
  it("validates manifest shape and refuses oversized payloads",async()=>{
    await expect(readNpbHistoricalManifest(vi.fn<typeof fetch>().mockResolvedValue(new Response('{}')))).rejects.toThrow();
    await expect(readNpbHistoricalSeason(2025,index(),vi.fn<typeof fetch>().mockResolvedValue(new Response(' '.repeat(500001))))).rejects.toThrow(/bound/);
  });
});
