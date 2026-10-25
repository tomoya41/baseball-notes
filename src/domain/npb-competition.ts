import { z } from "zod";
import { npbSeasonMetadataSchema } from "./npb-season";
import { postseasonRoundSchema } from "./competition";
import { historicalRates, npbHistoricalRowSchema, sumHistoricalRows, npbHistoricalPlayerSchema } from "./npb-historical";

/** Additive NPB-only contract. Legacy regular/postseason APIs remain unchanged. */
export const npbCompetitionScopeSchema=z.strictObject({
  league:z.literal("NPB"),season:npbSeasonMetadataSchema.shape.season,
  temporalScope:z.enum(["historical","saved_current"]),
  competition:npbSeasonMetadataSchema.shape.competitionType.extract(["regular","preseason","postseason"]),
  stage:postseasonRoundSchema.extract(["npb_cs_first","npb_cs_final","japan_series"]).nullable(),
}).refine(s=>s.competition==="postseason" ? s.stage!==null : s.stage===null,"Competition/stage mismatch");
export type NpbCompetitionScope=z.infer<typeof npbCompetitionScopeSchema>;
export const npbCompetitionLabels={regular:"公式戦",preseason:"オープン戦",npb_cs_first:"CS ファースト",npb_cs_final:"CS ファイナル",japan_series:"日本シリーズ"} as const;

// Reuse the validated aggregate inputs and arithmetic; never generate Game Facts from aggregates.
export const npbCompetitionAggregateSchema=npbHistoricalRowSchema.safeExtend({
  season:npbSeasonMetadataSchema.shape.season,
  scope:npbCompetitionScopeSchema,
}).refine(r=>r.season===r.scope.season,"Aggregate/scope season mismatch");
export type NpbCompetitionAggregate=z.infer<typeof npbCompetitionAggregateSchema>;
export const npbPostseasonAggregateDatasetSchema=z.strictObject({
  schemaVersion:z.literal(1),provider:z.literal("Wikipedia"),license:z.literal("CC-BY-SA-4.0"),
  temporalScope:z.literal("historical"),coverage:z.literal("partial"),granularity:z.literal("season_stage_aggregate"),
  observedAt:z.iso.datetime(),inputSha256:z.string().regex(/^[a-f0-9]{64}$/),transformation:z.string().min(1),
  players:z.array(npbHistoricalPlayerSchema).min(1).max(1000),rows:z.array(npbCompetitionAggregateSchema).min(1).max(10000),
}).superRefine((d,ctx)=>{
  const ids=new Set(d.players.map(p=>p.playerId)),keys=d.rows.map(r=>`${r.playerId}:${r.season}:${r.scope.stage}:${r.teamId}:${r.role}`);
  if(ids.size!==d.players.length||new Set(d.players.map(p=>p.npbId)).size!==d.players.length||new Set(keys).size!==keys.length||d.rows.some(r=>!ids.has(r.playerId)||r.season>2025||r.scope.temporalScope!=="historical"||r.scope.competition!=="postseason"))ctx.addIssue({code:"custom",message:"Invalid scoped historical identity/row"});
  if(d.players.some(p=>p.revisionAt>(p.sourceObservedAt??d.observedAt)||(p.sourceObservedAt??d.observedAt)>d.observedAt))ctx.addIssue({code:"custom",message:"Source revision postdates acquisition"});
});
export type NpbPostseasonAggregateDataset=z.infer<typeof npbPostseasonAggregateDatasetSchema>;
export function sumNpbCompetitionRows(input:readonly unknown[]) {
  const rows=input.map(r=>npbCompetitionAggregateSchema.parse(r));
  if(!rows.length)throw Error("Select one competition");
  const scope=rows[0]!.scope;
  if(rows.some(r=>r.scope.temporalScope!==scope.temporalScope||r.scope.competition!==scope.competition||r.scope.stage!==scope.stage))throw Error("Do not mix temporal scopes, competitions or stages");
  const keys=rows.map(r=>`${r.playerId}:${r.season}:${r.teamId}:${r.role}`);
  if(new Set(keys).size!==keys.length)throw Error("Duplicate aggregate");
  const total=sumHistoricalRows(rows);
  return {...total,metrics:{...total.metrics,...historicalRates(rows[0]!.role,total.metrics)},competition:scope.competition,stage:scope.stage,scopeLabel:"収録年度・シリーズの範囲のみ（全キャリア通算ではありません）"};
}

/** Collection state does not imply rights, player coverage, freshness or a Production Gate. */
export const npbCompetitionCoverageSchema=z.strictObject({
  scope:npbCompetitionScopeSchema,
  state:z.enum(["complete","partial","not_collected","failed","no_games","not_started"]),
  savedGames:z.number().int().nonnegative(),expectedGames:z.number().int().nonnegative().nullable(),
  playerStats:z.enum(["complete","partial","unavailable"]),
  evidence:z.array(z.url()),reason:z.string().min(1),
}).superRefine((c,ctx)=>{
  if(c.expectedGames!==null&&c.savedGames>c.expectedGames)ctx.addIssue({code:"custom",message:"Game counts exceed universe"});
  if(c.state==="complete"&&(c.expectedGames===null||c.expectedGames===0||c.savedGames!==c.expectedGames||!c.evidence.length))ctx.addIssue({code:"custom",message:"Complete requires independent universe and evidence"});
  if(c.state==="no_games"&&(c.savedGames!==0||c.expectedGames!==0||!c.evidence.length))ctx.addIssue({code:"custom",message:"No-games requires explicit evidence"});
  if(["not_collected","not_started"].includes(c.state)&&(c.savedGames!==0||c.playerStats!=="unavailable"))ctx.addIssue({code:"custom",message:"Unavailable is not a zero-stat appearance"});
});
