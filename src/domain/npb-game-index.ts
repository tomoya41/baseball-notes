import { z } from "zod";
const count=z.number().int().nonnegative().nullable();
const team=z.strictObject({id:z.string().startsWith("npb:team:"),name:z.string().min(1),score:count});
export const gameIndexRowSchema=z.strictObject({gameId:z.string().startsWith("npb:game:"),date:z.iso.date(),
  gameNumber:z.number().int().positive(),scheduledTime:z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  status:z.enum(["final","scheduled","postponed","canceled","suspended","unknown"]),home:team,away:team,
  completeness:z.enum(["complete","partial","failed","pending","unverified"]).nullable(),
  battingAvailable:z.boolean(),pitchingAvailable:z.boolean(),detailAvailable:z.boolean()});
export const gameDateIndexSchema=z.strictObject({schemaVersion:z.literal(1),league:z.literal("NPB"),date:z.iso.date(),
  generatedAt:z.iso.datetime(),coverage:z.enum(["complete","partial","failed","no_games","unknown"]),games:z.array(gameIndexRowSchema)})
  .superRefine((p,c)=>{if(p.games.some(g=>g.date!==p.date)||new Set(p.games.map(g=>g.gameId)).size!==p.games.length||
    (p.coverage==="no_games"&&p.games.some(g=>g.status==="final")))c.addIssue({code:"custom",message:"Inconsistent dated Game index"});});
export const gameManifestSchema=z.strictObject({schemaVersion:z.literal(1),league:z.literal("NPB"),
  from:z.iso.date(),to:z.iso.date(),effectiveDate:z.iso.date(),generatedAt:z.iso.datetime()});
export const recentGamesSchema=z.strictObject({schemaVersion:z.literal(1),league:z.literal("NPB"),effectiveDate:z.iso.date(),
  generatedAt:z.iso.datetime(),games:z.array(gameIndexRowSchema).max(6)});
export type GameIndexRow=z.infer<typeof gameIndexRowSchema>;
export type GameDateIndex=z.infer<typeof gameDateIndexSchema>;
export type GameManifest=z.infer<typeof gameManifestSchema>;
export function orderGames(rows:readonly GameIndexRow[]):GameIndexRow[]{
  return [...rows].sort((a,b)=>(a.scheduledTime??"99:99").localeCompare(b.scheduledTime??"99:99")||
    a.gameNumber-b.gameNumber||a.gameId.localeCompare(b.gameId));
}
export function shiftGameDate(date:string,offset:number):string {
  z.iso.date().parse(date);const d=new Date(`${date}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);
}
