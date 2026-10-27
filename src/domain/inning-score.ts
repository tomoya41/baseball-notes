import { z } from "zod";
export const inningCellSchema=z.union([z.number().int().nonnegative(),z.null(),z.literal("X"),z.string().regex(/^\d+x$/),z.literal("pending")]);
export type InningCell=z.infer<typeof inningCellSchema>;
const side=z.strictObject({id:z.string(),runs:z.number().int().nonnegative(),hits:z.number().int().nonnegative().nullable(),errors:z.number().int().nonnegative().nullable(),innings:z.array(inningCellSchema).max(30)});
export const inningScoreSchema=z.strictObject({gameId:z.string(),league:z.enum(["NPB","MLB"]),season:z.number().int(),date:z.iso.date(),competition:z.enum(["regular","postseason"]),away:side,home:side,sourceId:z.string(),evidenceSha256:z.string().regex(/^[a-f0-9]{64}$/)}).superRefine((d,c)=>{
  if(!d.date.startsWith(`${d.season}-`)||d.away.id===d.home.id)c.addIssue({code:"custom",message:"Inning game scope mismatch"});
  for(const [index,s] of[d.away,d.home].entries())if(s.innings.some((v,i)=>typeof v==="string"&&v!=="pending"&&(index!==1||i!==s.innings.length-1)))c.addIssue({code:"custom",message:"End marker outside final home inning"});
  for(const s of[d.away,d.home])if(s.innings.length&&s.innings.every(v=>v!==null&&v!=="pending")&&s.innings.reduce<number>((n,v)=>n+(v==="X"?0:Number(typeof v==="string"?v.replace(/x$/,""):v)),0)!==s.runs)c.addIssue({code:"custom",message:"Inning runs do not match final score"});
});
export type InningScore=z.infer<typeof inningScoreSchema>;
export const inningScorePageSchema=z.strictObject({schemaVersion:z.literal(1),games:z.array(inningScoreSchema),sources:z.array(z.object({id:z.string(),url:z.url(),name:z.string(),license:z.string(),sha256:z.string()}))}).superRefine((d,c)=>{if(new Set(d.games.map(g=>g.gameId)).size!==d.games.length||d.games.some(g=>!d.sources.some(s=>s.id===g.sourceId)))c.addIssue({code:"custom",message:"Inning provenance mismatch"});});
