import { describe,expect,it } from "vitest";
import { historicalIdentityId,verifyHistoricalIdentity } from "../src/infrastructure/providers/wikipedia-npb-historical-identity";
import { assertHistoricalBridge } from "../src/infrastructure/providers/npb-historical-admission";
import registry from "../src/data/npb-historical-only-identities.json";
const claim=(value:unknown,rank="normal")=>({rank,mainsnak:{datavalue:{value}}});
const birth={time:"+1980-04-05T00:00:00Z",precision:11,calendarmodel:"http://www.wikidata.org/entity/Q1985727"};
const page={pageid:100,title:"同名選手",pageprops:{wikibase_item:"Q123"},revisions:[{revid:200,slots:{main:{content:"{{Infobox baseball player\n|選手名=同名選手\n|生年月日={{生年月日と年齢|1980|4|5}}\n}}\n{{NPB|12345678}}"}}}]};
const entity={id:"Q123",lastrevid:300,sitelinks:{jawiki:{title:page.title}},claims:{P4260:[claim("12345678")],P569:[claim(birth)]}};
const at="2026-10-16T00:00:00Z";
describe("historical-only identity admission",()=>{
  it("requires independent exact IDs, article continuity and day-precision birthdate",()=>{
    const result=verifyHistoricalIdentity(page,entity,at,[]);
    expect(result.kind).toBe("new");expect(result.bridge).toMatchObject({playerId:historicalIdentityId("12345678"),scope:"historical_only",birthDate:"1980-04-05",pageId:100,revision:200,wikidataRevision:300});
    expect(()=>verifyHistoricalIdentity(page,{...entity,id:"Q999"},at,[])).toThrow(/sitelink/);
    expect(()=>verifyHistoricalIdentity(page,{...entity,claims:{...entity.claims,P4260:[claim("87654321")]}},at,[])).toThrow(/external-ID/);
    for(const b of [{...birth,precision:9},{...birth,time:"+1980-04-06T00:00:00Z"}])expect(()=>verifyHistoricalIdentity(page,{...entity,claims:{...entity.claims,P569:[claim(b)]}},at,[])).toThrow(/birthdate/);
  });
  it("preserves existing IDs and rejects one-sided identity conflicts",()=>{
    const existing={playerId:"00000000-0000-4000-8000-000000000001",wikidataId:"Q123",npbId:"12345678"};
    expect(verifyHistoricalIdentity(page,entity,at,[existing])).toEqual({kind:"existing",bridge:existing});
    expect(()=>verifyHistoricalIdentity(page,entity,at,[{...existing,npbId:"87654321"}])).toThrow(/Conflicting/);
    expect(()=>verifyHistoricalIdentity(page,{...entity,claims:{...entity.claims,P4260:[claim("12345678"),claim("87654321")]}},at,[])).toThrow();
  });
  it("does not merge equal names, and ignores deprecated claims",()=>{
    expect(historicalIdentityId("12345678")).not.toBe(historicalIdentityId("87654321"));
    expect(verifyHistoricalIdentity(page,{...entity,claims:{...entity.claims,P4260:[claim("12345678"),claim("87654321","deprecated")]}},at,[]).kind).toBe("new");
  });
  it.each(["{{R|npb_prof}}",'<ref name="source">{{Cite web|title=source}}</ref>'])("accepts a cited exact birth date without accepting extra dates: %s",suffix=>{
    const cited={...page,revisions:[{...page.revisions[0]!,slots:{main:{content:page.revisions[0]!.slots.main.content.replace("{{生年月日と年齢|1980|4|5}}",`{{生年月日と年齢|1980|4|5}}${suffix}`)}}}]};
    expect(verifyHistoricalIdentity(cited,entity,at,[]).kind).toBe("new");
    const ambiguous={...cited,revisions:[{...cited.revisions[0]!,slots:{main:{content:cited.revisions[0]!.slots.main.content.replace(suffix,"1981年")}}}]};
    expect(()=>verifyHistoricalIdentity(ambiguous,entity,at,[])).toThrow(/birthdate/);
  });
  it("admits only the curated, noncolliding historical namespace and pinned article revisions",()=>{
    for(const p of registry.players){const b={...p,identityScope:"historical_only" as const};expect(()=>assertHistoricalBridge(b,{article:p.article,revision:p.revision})).not.toThrow();expect(()=>assertHistoricalBridge(b,{article:p.article,revision:p.revision+1})).toThrow();expect(()=>assertHistoricalBridge({playerId:p.playerId,npbId:p.npbId,wikidataId:p.wikidataId})).toThrow();}
    expect(()=>assertHistoricalBridge({playerId:historicalIdentityId("12345678"),npbId:"12345678",wikidataId:"Q123",identityScope:"historical_only"})).toThrow();
  });
});
