import { z } from "zod";
export const recordsSchema=z.strictObject({schemaVersion:z.literal(1),league:z.literal("NPB"),season:z.literal(2026),
  effectiveDate:z.iso.date(),coverage:z.enum(["complete","partial","unknown","unavailable"]),
  readiness:z.enum(["ready","not_ready"]),qualifierStatus:z.enum(["verified","pending"]),reasons:z.array(z.string()),
  categories:z.array(z.strictObject({metric:z.enum(["HR","H","RBI","SB","SO","W","SV","HLD"]),role:z.enum(["batting","pitching"]),
    rows:z.array(z.strictObject({playerId:z.string().min(1),displayName:z.string(),rank:z.number().int().positive(),value:z.number().finite().nonnegative()}))}))})
  .superRefine((p,c)=>{if(p.readiness==="not_ready"&&p.categories.some(x=>x.rows.length))c.addIssue({code:"custom",message:"Provisional ranking leak"});
    if(p.readiness==="ready"&&(p.coverage!=="complete"||p.qualifierStatus!=="verified"))c.addIssue({code:"custom",message:"Unverified Records gate"});});
export type NpbRecords=z.infer<typeof recordsSchema>;
