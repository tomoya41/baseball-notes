import { z } from "zod";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const honorsSourceSchema = z.strictObject({ id:z.string(), name:z.string(), url:z.url(), license:z.enum(["CC-BY-SA-3.0","CC-BY-SA-4.0","CC0-1.0","ODC-BY-1.0","Retrosheet-notice"]), sha256:hash, revision:z.number().int().positive().optional(), authorsUrl:z.url().optional() });
export const honorRecipientSchema = z.strictObject({ id:z.string().min(1), name:z.string().min(1), identityStatus:z.enum(["verified","unresolved"]).optional(), externalIds:z.record(z.string(),z.string()), links:z.array(z.strictObject({ league:z.enum(["NPB","MLB"]), playerId:z.string(), seasons:z.array(z.number().int()) })), counts:z.record(z.string(),z.number().int().positive()) });
export const honorSchema = z.strictObject({ id:hash, recipientId:z.string(), league:z.enum(["NPB","MLB"]), year:z.number().int().min(1871).max(2025), division:z.string().nullable(), awardId:z.string().regex(/^[a-z0-9_-]+$/), name:z.string().min(1), sourceName:z.string().min(1), sourceNote:z.string().nullable().optional(), kind:z.enum(["title","award"]), position:z.string().nullable(), seasonTeams:z.array(z.strictObject({ name:z.string(), id:z.string().nullable() })), joint:z.boolean().nullable(), sourceId:z.string(), evidenceSha256:hash, reportedCareerWins:z.number().int().positive().nullable() });
export const honorsPageSchema = z.strictObject({ schemaVersion:z.literal(1), recipients:z.array(honorRecipientSchema), records:z.array(honorSchema), sources:z.array(honorsSourceSchema) }).superRefine((d,c)=>{
  const ids=new Set(d.recipients.map(p=>p.id)),sources=new Set(d.sources.map(s=>s.id));
  if(ids.size!==d.recipients.length||sources.size!==d.sources.length||new Set(d.records.map(r=>r.id)).size!==d.records.length||d.records.some(r=>!ids.has(r.recipientId)||!sources.has(r.sourceId)))c.addIssue({code:"custom",message:"Honor identity/provenance reference mismatch"});
  for(const p of d.recipients)for(const l of p.links)if(!z.uuid().safeParse(l.playerId.replace(/^mlb:player:/,"")).success||(l.league==="MLB"&&!l.playerId.startsWith("mlb:player:")))c.addIssue({code:"custom",message:"Invalid canonical honor link"});
});
export type Honor = z.infer<typeof honorSchema>;
export type HonorRecipient = z.infer<typeof honorRecipientSchema>;
export type HonorsPage = z.infer<typeof honorsPageSchema>;
export const contextPath=/^(?:honors\/(?:years\/(?:NPB|MLB)\/\d{4}|players\/(?:NPB|MLB)\/[a-f0-9]{2})|scoreboards\/(?:NPB|MLB)\/\d{4}-\d{2}-(?:regular|postseason))\.json$/;
export const contextManifestSchema=z.strictObject({schemaVersion:z.literal(1),observedAt:z.iso.datetime(),cutoff:z.literal(2025),coverage:z.literal("partial"),attribution:z.string().min(1),years:z.strictObject({NPB:z.array(z.number().int().min(1936).max(2025)),MLB:z.array(z.number().int().min(1871).max(2025))}),counts:z.record(z.string(),z.number().int().nonnegative()),files:z.record(z.string().regex(contextPath),z.strictObject({sha256:hash,bytes:z.number().int().positive().max(1_000_000)}))});
export type ContextManifest=z.infer<typeof contextManifestSchema>;
export const playerHonorBucket=(id:string)=>id.replace(/^mlb:player:/,"").slice(0,2);
/** NPB seasons resolves both Current and historical-only identities. */
export function honorProfilePath(link:HonorRecipient["links"][number],year:number){return `/${link.league}/players/${encodeURIComponent(link.playerId)}${link.league==="NPB"?`/seasons${link.seasons.includes(year)?`?season=${year}`:""}`:""}`;}
