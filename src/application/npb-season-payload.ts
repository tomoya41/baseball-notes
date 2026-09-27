import { z } from "zod";
import type { PlayerPeriodBatchResult } from "./player-period-batch";
import type { AggregateMetric } from "../domain/player-period";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";

export const seasonBattingKeys=["G","PA","AB","R","H","2B","3B","HR","RBI","BB","HBP","SH","SF","SO","SB","CS","AVG","OBP","SLG","OPS"] as const;
export const seasonPitchingKeys=["G","GS","outsRecorded","BF","H","HR","SO","R","ER","pitchCount","W","L","HLD","SV","ERA","K9"] as const;
const metricSchema=z.strictObject({value:z.number().finite().nonnegative().nullable(),
  status:z.enum(["complete","partial","unavailable"]),observedFacts:z.number().int().nonnegative(),factCount:z.number().int().nonnegative()});
const metricsSchema=(keys:readonly string[])=>z.object(Object.fromEntries(keys.map(k=>[k,metricSchema]))).strict();
const statsSchema=(keys:readonly string[])=>z.strictObject({factCount:z.number().int().positive(),metrics:metricsSchema(keys)});
export const npbSeasonPayloadSchema=z.strictObject({schemaVersion:z.literal(1),league:z.literal("NPB"),season:z.literal(2026),
  effectiveDate:z.iso.date(),generatedAt:z.iso.datetime(),period:z.strictObject({from:z.iso.date(),to:z.iso.date()}),
  coverage:z.strictObject({status:z.enum(["complete","partial","unknown","unavailable"]),
    summary:z.strictObject({dates:z.number().int().nonnegative(),complete:z.number().int().nonnegative(),
      noGames:z.number().int().nonnegative(),partial:z.number().int().nonnegative(),unknown:z.number().int().nonnegative(),failed:z.number().int().nonnegative()})}),
  readiness:z.strictObject({status:z.enum(["ready","not_ready"]),reasons:z.array(z.string()),
    counting:z.enum(["ready","not_ready"]),rateQualifier:z.enum(["verified","pending"])}),
  players:z.array(z.strictObject({playerId:z.string().min(1),displayName:z.string().min(1),teamId:z.string().nullable(),
    batting:statsSchema(seasonBattingKeys).nullable(),pitching:statsSchema(seasonPitchingKeys).nullable()})),
  rankings:z.strictObject({batting:z.array(z.unknown()).max(0),pitching:z.array(z.unknown()).max(0)}),
}).superRefine((value,ctx)=>{
  if(value.period.to!==value.effectiveDate || value.period.from>value.period.to)
    ctx.addIssue({code:"custom",message:"Season period/effective date mismatch"});
  if(new Set(value.players.map(p=>p.playerId)).size!==value.players.length)
    ctx.addIssue({code:"custom",message:"Duplicate canonical Player"});
});
export type NpbSeasonPayload=z.infer<typeof npbSeasonPayloadSchema>;

// Internal candidates are never a public ranking. Official qualifiers are intentionally unresolved.
export function seasonRankingReadModel(batch:PlayerPeriodBatchResult) {
  const rank=(role:"batters"|"pitchers",key:string,ascending=false)=>(batch[role] as readonly {playerId:string;metrics:Record<string,AggregateMetric>}[])
    .filter(p=>p.metrics[key]?.status==="complete" && p.metrics[key]?.value!==null)
    .map(p=>({playerId:p.playerId,value:p.metrics[key]!.value!,sample:p.metrics[role==="batters"?"PA":"outsRecorded"]!}))
    .sort((a,b)=>(ascending?a.value-b.value:b.value-a.value)||a.playerId.localeCompare(b.playerId))
    .map((p,index)=>({...p,rank:index+1}));
  const batting=Object.fromEntries(["HR","RBI","H","SB"].map(key=>[key,rank("batters",key)]));
  const pitching=Object.fromEntries(["SO","W","HLD","SV"].map(key=>[key,rank("pitchers",key)]));
  return {counting:{batting,pitching},rates:{status:"not_ready" as const,reason:"official_qualifier_unverified",
    candidates:{AVG:rank("batters","AVG"),OPS:rank("batters","OPS"),ERA:rank("pitchers","ERA",true),K9:rank("pitchers","K9")}},
    // Simple season records only; the same counting read model, no all-time/career claims.
    records:{batting,pitching}};
}

export function buildNpbSeasonPayload(batch:PlayerPeriodBatchResult,directory:NpbPlayerDirectory,generatedAt=new Date().toISOString()):NpbSeasonPayload {
  if(batch.period!=="season" || batch.window.from!=="2026-03-27") throw new Error("Verified 2026 regular-season batch required");
  const metadata=new Map(directory.players.map(p=>[p.playerId,p]));
  const batters=new Map(batch.batters.map(p=>[p.playerId,p])),pitchers=new Map(batch.pitchers.map(p=>[p.playerId,p]));
  const project=(stats:{factCount:number;metrics:Record<string,AggregateMetric>}|undefined,keys:readonly string[])=>stats ? {
    factCount:stats.factCount,metrics:Object.fromEntries(keys.map(k=>[k,stats.metrics[k] as AggregateMetric]))}:null;
  const players=[...new Set([...batters.keys(),...pitchers.keys()])].sort().map(playerId=>{
    const player=metadata.get(playerId);
    if(!player) throw new Error(`Canonical Player display metadata unavailable: ${playerId}`);
    return {playerId,displayName:player.displayName,teamId:player.teamId,
      batting:project(batters.get(playerId),seasonBattingKeys),pitching:project(pitchers.get(playerId),seasonPitchingKeys)};
  });
  const reasons=[...(batch.coverage.status!=="complete"?["season_coverage_not_complete"]:[]),
    "official_qualifier_unverified","public_ranking_not_enabled"];
  return npbSeasonPayloadSchema.parse({schemaVersion:1,league:"NPB",season:2026,effectiveDate:batch.window.to,generatedAt,
    period:{from:batch.window.from,to:batch.window.to},coverage:{status:batch.coverage.status,summary:batch.coverage.summary},
    readiness:{status:"not_ready",reasons,counting:batch.coverage.status==="complete"?"ready":"not_ready",rateQualifier:"pending"},
    players,rankings:{batting:[],pitching:[]}});
}
