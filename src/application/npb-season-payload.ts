import { z } from "zod";
import type { PlayerPeriodBatchResult } from "./player-period-batch";
import type { AggregateMetric } from "../domain/player-period";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";
import { qualifyNpbSeason } from "../domain/npb-ranking-qualifier";
import type { SeasonQualifierContext } from "../data/npb-season-qualifier";

export const seasonBattingKeys=["G","PA","AB","R","H","2B","3B","HR","RBI","BB","HBP","SH","SF","SO","SB","CS","AVG","OBP","SLG","OPS"] as const;
export const seasonPitchingKeys=["G","GS","outsRecorded","BF","H","HR","SO","R","ER","pitchCount","W","L","HLD","SV","ERA","K9"] as const;
const metricSchema=z.strictObject({value:z.number().finite().nonnegative().nullable(),
  status:z.enum(["complete","partial","unavailable"]),observedFacts:z.number().int().nonnegative(),factCount:z.number().int().nonnegative()})
  .superRefine((metric,ctx)=>{
    if(metric.observedFacts>metric.factCount || (metric.status==="complete" && metric.value===null) ||
      (metric.status==="unavailable" && metric.value!==null))
      ctx.addIssue({code:"custom",message:"Inconsistent metric availability/sample"});
  });
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
  const summary=value.coverage.summary;
  if(value.coverage.status!=="unavailable" && summary.dates!==summary.complete+summary.noGames+summary.partial+summary.failed+summary.unknown)
    ctx.addIssue({code:"custom",message:"Inconsistent coverage day counts"});
  if(value.coverage.status==="complete" && summary.partial+summary.failed+summary.unknown!==0)
    ctx.addIssue({code:"custom",message:"Complete coverage contains unverified dates"});
});
export type NpbSeasonPayload=z.infer<typeof npbSeasonPayloadSchema>;

// Internal candidates are never a public ranking; qualification also needs verified coverage/team context.
export function seasonRankingReadModel(batch:PlayerPeriodBatchResult,directory?:NpbPlayerDirectory,context?:SeasonQualifierContext) {
  const metadata=new Map(directory?.players.map(p=>[p.playerId,p]) ?? []);
  const qualifications=Object.fromEntries((["batters","pitchers"] as const).map(role=>[role,
    batch[role].map(p=>{
      const teamId=metadata.get(p.playerId)?.teamId ?? null;
      const key=role==="batters"?"batting":"pitching";
      return {playerId:p.playerId,...qualifyNpbSeason({role:key,coverageComplete:batch.coverage.status==="complete",
        teamGames:teamId?context?.teamGames.get(teamId) ?? null:null,
        playerTeamIds:context?.playerTeams.get(`${key}:${p.playerId}`) ?? [],displayTeamId:teamId,
        sample:(p.metrics as Record<string,AggregateMetric>)[role==="batters"?"PA":"outsRecorded"]!})};
    })]));
  const rank=(role:"batters"|"pitchers",key:string,ascending=false)=>(batch[role] as readonly {playerId:string;metrics:Record<string,AggregateMetric>}[])
    .filter(p=>p.metrics[key]?.status==="complete" && p.metrics[key]?.value!==null)
    .map(p=>({playerId:p.playerId,value:p.metrics[key]!.value!,sample:p.metrics[role==="batters"?"PA":"outsRecorded"]!}))
    .sort((a,b)=>(ascending?a.value-b.value:b.value-a.value)||a.playerId.localeCompare(b.playerId))
    .map((p,index)=>({...p,rank:index+1}));
  const batting=Object.fromEntries(["HR","RBI","H","SB"].map(key=>[key,rank("batters",key)]));
  const pitching=Object.fromEntries(["SO","W","HLD","SV"].map(key=>[key,rank("pitchers",key)]));
  const metricReadiness=(role:"batters"|"pitchers",keys:string[])=>Object.fromEntries(keys.map(key=>[key,
    batch.coverage.status==="complete" && batch[role].every(p=>(p.metrics as Record<string,AggregateMetric>)[key]?.status==="complete")?"ready":"not_ready"]));
  const countingReadiness={batting:metricReadiness("batters",Object.keys(batting)),pitching:metricReadiness("pitchers",Object.keys(pitching))};
  const countingReady=Object.values(countingReadiness).flatMap(Object.values).every(s=>s==="ready");
  const qualified=(role:"batters"|"pitchers",key:string,ascending=false)=>{
    const ids=new Set(qualifications[role]!.filter(p=>p.status==="qualified").map(p=>p.playerId));
    return rank(role,key,ascending).filter(p=>ids.has(p.playerId)).map((p,index)=>({...p,rank:index+1}));
  };
  const qualifierUnknown=Object.values(qualifications).flat().some(p=>p.status==="unknown");
  const rateReadiness=(role:"batters"|"pitchers",keys:string[])=>Object.fromEntries(keys.map(key=>[key,
    batch.coverage.status==="complete" && !qualifierUnknown && batch[role].every(p=>
      qualifications[role]!.find(q=>q.playerId===p.playerId)?.status!=="qualified" ||
      (p.metrics as Record<string,AggregateMetric>)[key]?.status==="complete")?"ready":"not_ready"]));
  const ratesReadiness={batting:rateReadiness("batters",["AVG","OPS"]),pitching:rateReadiness("pitchers",["ERA","K9"])};
  const ratesReady=Object.values(ratesReadiness).flatMap(Object.values).every(s=>s==="ready");
  return {counting:{batting,pitching},qualifications,countingReadiness,
    readiness:{counting:countingReady?"ready":"not_ready",rule:"verified",
      rates:ratesReady?"ready":"not_ready"},
    rates:{status:ratesReady?"ready":"not_ready",metricReadiness:ratesReadiness,
      reason:batch.coverage.status!=="complete"?"season_coverage_not_complete":qualifierUnknown?
        "qualifier_computation_pending":!ratesReady?"qualified_metric_incomplete":null,
      qualified:{AVG:qualified("batters","AVG"),OPS:qualified("batters","OPS"),ERA:qualified("pitchers","ERA",true),K9:qualified("pitchers","K9")},
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
    ...(batch.coverage.status!=="complete"?["qualifier_computation_requires_complete_coverage"]:[]),"public_ranking_not_enabled"];
  return npbSeasonPayloadSchema.parse({schemaVersion:1,league:"NPB",season:2026,effectiveDate:batch.window.to,generatedAt,
    period:{from:batch.window.from,to:batch.window.to},coverage:{status:batch.coverage.status,summary:batch.coverage.summary},
    readiness:{status:"not_ready",reasons,counting:seasonRankingReadModel(batch).readiness.counting,rateQualifier:"verified"},
    players,rankings:{batting:[],pitching:[]}});
}
