import { z } from "zod";
import { npbCompetitionAggregateSchema } from "./npb-competition";
import { npbHistoricalPlayerSchema, npbHistoricalRowSchema, sumHistoricalRows } from "./npb-historical";

export const csSourceSchema = z.strictObject({ pageId: z.number().int().positive(), title: z.string().min(1), revision: z.number().int().positive(), revisionAt: z.iso.datetime(), contentSha256: z.string().regex(/^[a-f0-9]{64}$/) });
const gameSchema = z.strictObject({ id: z.string().regex(/^npb:game:[a-f0-9]{20}$/), date: z.iso.date(), stage: z.enum(["npb_cs_first", "npb_cs_final"]), homeTeamId: npbHistoricalRowSchema.shape.teamId, awayTeamId: npbHistoricalRowSchema.shape.teamId, homeScore: z.number().int().nonnegative(), awayScore: z.number().int().nonnegative(), homeHits: z.number().int().nonnegative().nullable(), awayHits: z.number().int().nonnegative().nullable(), sourcePageId: z.number().int().positive(), status: z.literal("final") });
export const csGameObservationSchema=z.strictObject({gameId:z.string(),aggregate:npbCompetitionAggregateSchema});
export const npbCsDatasetSchema = z.strictObject({ schemaVersion: z.literal(1), league: z.literal("NPB"), season: z.literal(2026), temporalScope: z.literal("saved_current"), competition: z.literal("postseason"), provider: z.literal("Wikipedia"), license: z.literal("CC-BY-SA-4.0"), coverage: z.literal("partial"), granularity: z.literal("collected_game_aggregate"), observedAt: z.iso.datetime(), inputSha256: z.string().regex(/^[a-f0-9]{64}$/), transformation: z.string().min(1), sources: z.array(csSourceSchema).min(1).max(2), players: z.array(npbHistoricalPlayerSchema).max(1000), games: z.array(gameSchema).min(1).max(30), rows: z.array(z.strictObject({ aggregate: npbCompetitionAggregateSchema, gameIds: z.array(z.string()).min(1).max(30) })).max(3000), observations:z.array(csGameObservationSchema).max(3000).optional() }).superRefine((d, ctx) => {
  const sourceIds = new Set(d.sources.map(s => s.pageId)), players = new Set(d.players.map(p => p.playerId)), games = new Map(d.games.map(g => [g.id, g]));
  const keys = d.rows.map(r => `${r.aggregate.playerId}:${r.aggregate.scope.stage}:${r.aggregate.teamId}:${r.aggregate.role}`);
  if (sourceIds.size !== d.sources.length || players.size !== d.players.length || new Set(d.players.map(p=>p.npbId)).size!==d.players.length || new Set(d.players.map(p=>p.wikidataId)).size!==d.players.length || games.size !== d.games.length || new Set(keys).size !== keys.length) ctx.addIssue({ code: "custom", message: "Duplicate CS source/identity/game/row" });
  if (d.players.some(p=>p.identityScope!==undefined||p.revisionAt>(p.sourceObservedAt??d.observedAt)||(p.sourceObservedAt??d.observedAt)>d.observedAt)||d.sources.some(s => s.revisionAt > d.observedAt) || d.games.some(g => g.date > d.observedAt.slice(0, 10) || !g.date.startsWith("2026-") || !sourceIds.has(g.sourcePageId) || g.homeTeamId === g.awayTeamId)) ctx.addIssue({ code: "custom", message: "Invalid observed CS game/source date" });
  for (const r of d.rows) {
    const a = r.aggregate;
    if (!players.has(a.playerId) || a.season !== 2026 || a.scope.temporalScope !== "saved_current" || a.scope.competition !== "postseason" || !["npb_cs_first", "npb_cs_final"].includes(a.scope.stage ?? "") || new Set(r.gameIds).size !== r.gameIds.length || a.metrics.G !== r.gameIds.length || r.gameIds.some(id => { const g = games.get(id); return !g || g.stage !== a.scope.stage || ![g.homeTeamId, g.awayTeamId].includes(a.teamId); })) ctx.addIssue({ code: "custom", message: "Invalid CS participant/scope/sample" });
  }
  if(d.observations){
    const grouped=new Map<string,typeof d.observations>(),seen=new Set<string>();
    for(const observation of d.observations){
      const a=observation.aggregate,g=games.get(observation.gameId),key=`${a.playerId}:${a.scope.stage}:${a.teamId}:${a.role}`,unique=`${key}:${observation.gameId}`;
      if(seen.has(unique)||!players.has(a.playerId)||!g||a.metrics.G!==1||a.season!==2026||a.scope.temporalScope!=="saved_current"||a.scope.competition!=="postseason"||a.scope.stage!==g.stage||![g.homeTeamId,g.awayTeamId].includes(a.teamId))ctx.addIssue({code:"custom",message:"Invalid CS per-game observation"});
      seen.add(unique);grouped.set(key,[...grouped.get(key)??[],observation]);
    }
    if(grouped.size!==d.rows.length)ctx.addIssue({code:"custom",message:"CS observation rows not fully projected"});
    for(const row of d.rows){const a=row.aggregate,key=`${a.playerId}:${a.scope.stage}:${a.teamId}:${a.role}`,group=grouped.get(key);
      if(!group?.length){ctx.addIssue({code:"custom",message:"CS aggregate has no per-game evidence"});continue;}
      const total=sumHistoricalRows(group.map(o=>o.aggregate)).metrics;
      if(JSON.stringify(group.map(o=>o.gameId).sort())!==JSON.stringify(row.gameIds.slice().sort())||Object.keys(a.metrics).some(k=>a.metrics[k]!==total[k]))ctx.addIssue({code:"custom",message:"CS per-game/aggregate mismatch"});
    }
  }
});
export type NpbCsDataset = z.infer<typeof npbCsDatasetSchema>;
