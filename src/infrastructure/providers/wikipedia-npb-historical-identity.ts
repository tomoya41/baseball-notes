import { createHash } from "node:crypto";
import { z } from "zod";
import { baseballInfobox } from "./wikipedia-npb-profile";

export const historicalIdentitySchema=z.strictObject({
  playerId:z.uuid(),wikidataId:z.string().regex(/^Q\d+$/),npbId:z.string().regex(/^\d{8}$/),
  scope:z.literal("historical_only"),article:z.string().min(1),pageId:z.number().int().positive(),
  revision:z.number().int().positive(),wikidataRevision:z.number().int().positive(),birthDate:z.iso.date(),
  observedAt:z.iso.datetime(),wikidataObservedAt:z.iso.datetime().optional(),
});
export type HistoricalIdentity=z.infer<typeof historicalIdentitySchema>;
/** Stable UUIDv8 in a distinct namespace; names, clubs and current roles never generate identity. */
export function historicalIdentityId(npbId:string) {
  if(!/^\d{8}$/.test(npbId))throw Error("Invalid NPB identity");
  const b=createHash("sha256").update(`baseball-notes:npb-historical-only:v1:${npbId}`).digest().subarray(0,16);
  b[6]=(b[6]!&15)|128;b[8]=(b[8]!&63)|128;const h=b.toString("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
const claim=z.object({rank:z.string().optional(),mainsnak:z.object({datavalue:z.object({value:z.unknown()}).optional()})});
const usable=(claims:z.infer<typeof claim>[]=[]):unknown[]=>{
  const rows=claims.filter(c=>c.rank!=="deprecated"),preferred=rows.filter(c=>c.rank==="preferred");
  return (preferred.length?preferred:rows).map(c=>c.mainsnak.datavalue?.value);
};
export function verifyHistoricalIdentity(rawPage:unknown,rawEntity:unknown,observedAt:string,existing:readonly {playerId:string;npbId:string;wikidataId:string}[]) {
  const p=z.object({pageid:z.number().int().positive(),title:z.string(),pageprops:z.object({wikibase_item:z.string()}),revisions:z.array(z.object({revid:z.number().int().positive(),slots:z.object({main:z.object({content:z.string()})})})).length(1)}).parse(rawPage);
  const e=z.object({id:z.string(),lastrevid:z.number().int().positive(),sitelinks:z.object({jawiki:z.object({title:z.string()})}),claims:z.record(z.string(),z.array(claim))}).parse(rawEntity);
  if(e.id!==p.pageprops.wikibase_item||e.sitelinks.jawiki.title!==p.title)throw Error("Article/QID/sitelink mismatch");
  const text=p.revisions[0]!.slots.main.content;
  const ids=[...new Set([...text.matchAll(/(?:\{\{NPB\s*\|\s*|https?:\/\/(?:www\.)?npb\.(?:jp|or\.jp)\/bis\/players\/)(\d{8})(?=[\s|}.])/gi)].map(m=>m[1]!))];
  const wd=usable(e.claims.P4260);
  if(ids.length!==1||wd.length!==1||wd[0]!==ids[0])throw Error("NPB external-ID evidence mismatch");
  // Strip only citation syntax, not alternate dates or arbitrary templates. The remaining value must match exactly.
  const birthCell=(baseballInfobox(text).get("生年月日")??"").replace(/<ref\b[^>]*\/>|<ref\b[^>]*>[^]*?<\/ref\s*>/gi,"").replace(/\{\{R\|[\w-]+\}\}/g,"").trim();
  const birth=/^\{\{生年月日と年齢\|(\d{4})\|(\d{1,2})\|(\d{1,2})\}\}$/.exec(birthCell);
  const birthDate=birth?`${birth[1]}-${birth[2]!.padStart(2,"0")}-${birth[3]!.padStart(2,"0")}`:null;
  const dates=usable(e.claims.P569).map(v=>{const d=z.object({time:z.string(),precision:z.literal(11),calendarmodel:z.literal("http://www.wikidata.org/entity/Q1985727")}).safeParse(v);return d.success?d.data.time.slice(1,11):null;});
  if(!birthDate||dates.length!==1||dates[0]!==birthDate)throw Error("Independent day-precision birthdate mismatch");
  const matches=existing.filter(b=>b.npbId===ids[0]||b.wikidataId===e.id);
  if(matches.length) {
    if(matches.length!==1||matches[0]!.npbId!==ids[0]||matches[0]!.wikidataId!==e.id)throw Error("Conflicting existing identity");
    return {kind:"existing" as const,bridge:matches[0]!};
  }
  return {kind:"new" as const,bridge:historicalIdentitySchema.parse({playerId:historicalIdentityId(ids[0]!),wikidataId:e.id,npbId:ids[0],scope:"historical_only",article:p.title,pageId:p.pageid,revision:p.revisions[0]!.revid,wikidataRevision:e.lastrevid,birthDate,observedAt})};
}
