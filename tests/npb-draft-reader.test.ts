import { it,expect,vi,afterEach } from "vitest";
import { createHash,webcrypto } from "node:crypto";
import { draftFixture } from "./fixtures/npb-draft";
import { readNpbDraftEvent } from "../src/application/npb-draft-event-reader";
import { rememberPublicResponse } from "../src/infrastructure/public-response-cache";
const state=vi.hoisted(()=>({pin:{sha256:"c".repeat(64),bodySha256:"",forecastSha256:"",bytes:0}}));
vi.mock("../src/data/npb-draft-2026-release.json",()=>({default:state.pin}));
vi.mock("../src/infrastructure/public-response-cache",()=>({publicDataFetch:vi.fn(),rememberPublicResponse:vi.fn()}));
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();});
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
function payload(extra=false){const data=draftFixture(),body=JSON.stringify(extra?{...data,unreviewed:true}:data);Object.assign(state.pin,{bytes:Buffer.byteLength(body),bodySha256:hash(body),forecastSha256:hash(JSON.stringify(data.forecast))});vi.stubGlobal("crypto",webcrypto);return {body,data};}
it("loads one bounded static payload and remembers it only after validation",async()=>{const p=payload(),request=vi.fn(async()=>new Response(p.body));expect(await readNpbDraftEvent(request)).toEqual(p.data);expect(request).toHaveBeenCalledTimes(1);expect(String(request.mock.calls[0])).not.toContain("api/recent");expect(rememberPublicResponse).toHaveBeenCalledTimes(1);});
it.each(["body","forecast","schema"])("rejects %s mismatch without caching",async kind=>{const p=payload(kind==="schema");if(kind==="body")state.pin.bodySha256="0".repeat(64);if(kind==="forecast")state.pin.forecastSha256="0".repeat(64);await expect(readNpbDraftEvent(async()=>new Response(p.body))).rejects.toThrow();expect(rememberPublicResponse).not.toHaveBeenCalled();});
