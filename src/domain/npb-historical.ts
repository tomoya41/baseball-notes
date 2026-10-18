import { z } from "zod";

export const historicalBattingKeys = ["G", "PA", "AB", "R", "H", "2B", "3B", "HR", "TB", "RBI", "SB", "CS", "SH", "SF", "BB", "IBB", "HBP", "SO", "GDP", "AVG", "OBP", "SLG", "OPS"] as const;
export const historicalPitchingKeys = ["G", "GS", "CG", "SHO", "noWalkGames", "W", "L", "SV", "HLD", "WPCT", "BF", "outsRecorded", "H", "HR", "BB", "IBB", "HBP", "SO", "WP", "BK", "R", "ER", "ERA", "WHIP"] as const;
const count = z.number().int().nonnegative().nullable();
const rate = z.number().finite().nonnegative().nullable();
const stats = (keys: readonly string[], rates: string[]) => z.strictObject(Object.fromEntries(keys.map(k => [k, rates.includes(k) ? rate : count])));
export const historicalBattingSchema = stats(historicalBattingKeys, ["AVG", "OBP", "SLG", "OPS"]);
export const historicalPitchingSchema = stats(historicalPitchingKeys, ["WPCT", "ERA", "WHIP"]);
export const npbHistoricalRowSchema = z.strictObject({
  playerId: z.uuid(), season: z.number().int().min(1936).max(2025), teamId: z.enum(["npb:team:giants","npb:team:tigers","npb:team:dragons","npb:team:carp","npb:team:swallows","npb:team:baystars","npb:team:hawks","npb:team:fighters","npb:team:lions","npb:team:marines","npb:team:eagles","npb:team:buffaloes"]),
  role: z.enum(["batting", "pitching"]), metrics: z.record(z.string(), rate),
}).superRefine((row, ctx) => {
  const result = (row.role === "batting" ? historicalBattingSchema : historicalPitchingSchema).safeParse(row.metrics);
  if (!result.success) { ctx.addIssue({ code: "custom", message: "Unexpected metric definition" }); return; }
  const m = row.metrics;
  const exceeds = (a: string, b: string) => m[a] != null && m[b] != null && m[a]! > m[b]!;
  if (["H", "HR", "2B", "3B"].some(k => exceeds(k, k === "H" ? "AB" : "H")) && row.role === "batting") ctx.addIssue({ code: "custom", message: "Invalid hit counts" });
  if (row.role === "batting") {
    if (m.H != null && m["2B"] != null && m["3B"] != null && m.HR != null && (m["2B"] + m["3B"] + m.HR > m.H || (m.TB != null && m.TB !== m.H + m["2B"] + 2 * m["3B"] + 3 * m.HR))) ctx.addIssue({ code: "custom", message: "Invalid total bases" });
    const parts = ["AB", "BB", "HBP", "SH", "SF"].map(k => m[k]);
    if (m.PA != null && parts.every(v => v != null) && parts.reduce<number>((s,v) => s + v!, 0) > m.PA) ctx.addIssue({ code: "custom", message: "PA components exceed PA" });
  } else if (exceeds("ER", "R") || exceeds("GS", "G") || exceeds("IBB", "BB") || exceeds("noWalkGames", "CG") || exceeds("SHO", "CG")) ctx.addIssue({ code: "custom", message: "Invalid pitching counts" });
  for (const [key, actual] of Object.entries(historicalRates(row.role, m))) {
    if (m[key] != null && actual !== null && Math.abs(m[key]! - actual) > (["ERA", "WHIP"].includes(key) ? 0.011 : 0.0016)) ctx.addIssue({ code: "custom", message: `Rate discrepancy: ${key}` });
    if (m[key] != null && actual === null) ctx.addIssue({ code: "custom", message: `Rate without denominator: ${key}` });
  }
});
export type NpbHistoricalRow = z.infer<typeof npbHistoricalRowSchema>;
export const npbHistoricalPlayerSchema = z.strictObject({ playerId: z.uuid(), name: z.string().min(1), wikidataId: z.string().regex(/^Q\d+$/), npbId: z.string().regex(/^\d+$/),
  article: z.string().min(1), revision: z.number().int().positive(), revisionAt: z.iso.datetime(), contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  identityScope: z.literal("historical_only").optional(), sourceObservedAt: z.iso.datetime().optional(), birthDate: z.iso.date().optional() });
export const npbHistoricalDatasetSchema = z.strictObject({
  schemaVersion: z.literal(1), league: z.literal("NPB"), temporalScope: z.literal("historical"), competition: z.literal("regular"),
  granularity: z.literal("season_aggregate"), license: z.literal("CC-BY-SA-4.0"), observedAt: z.iso.datetime(),
  inputSha256: z.string().regex(/^[a-f0-9]{64}$/), transformation: z.string().min(1),
  coverage: z.literal("partial"), players: z.array(npbHistoricalPlayerSchema).max(10000), rows: z.array(npbHistoricalRowSchema).max(50000),
}).superRefine((value, ctx) => {
  const ids = new Set(value.players.map(p => p.playerId)), external = new Set(value.players.map(p => p.npbId));
  if (ids.size !== value.players.length || external.size !== value.players.length) ctx.addIssue({ code: "custom", message: "Ambiguous historical identity" });
  if(value.players.some(p=>p.birthDate!==undefined&&p.identityScope!=="historical_only"))ctx.addIssue({code:"custom",message:"Historical DOB requires an admitted historical-only identity"});
  if(value.players.some(p=>p.revisionAt>(p.sourceObservedAt??value.observedAt)||(p.sourceObservedAt??value.observedAt)>value.observedAt)) ctx.addIssue({code:"custom",message:"Source revision postdates acquisition"});
  const keys = new Set<string>();
  for (const row of value.rows) {
    const key = `${row.playerId}:${row.season}:${row.teamId}:${row.role}`;
    if (!ids.has(row.playerId) || keys.has(key)) ctx.addIssue({ code: "custom", message: "Unknown identity or duplicate aggregate" });
    keys.add(key);
  }
});
export type NpbHistoricalDataset = z.infer<typeof npbHistoricalDatasetSchema>;
export const npbHistoricalManifestSchema = z.strictObject({
  schemaVersion:z.literal(1), league:z.literal("NPB"), competition:z.literal("regular"), temporalScope:z.literal("historical"),
  coverage:z.literal("partial"), license:z.literal("CC-BY-SA-4.0"), inputSha256:z.string().regex(/^[a-f0-9]{64}$/), observedAt:z.iso.datetime(),
  seasons:z.array(z.strictObject({season:z.number().int().min(1936).max(2025),rows:z.number().int().positive(),players:z.number().int().positive(),sha256:z.string().regex(/^[a-f0-9]{64}$/),bytes:z.number().int().positive().max(500000)})).max(100),
  players:z.array(z.strictObject({playerId:z.uuid(),name:z.string().min(1),identityScope:z.literal("historical_only").optional(),birthDate:z.iso.date().optional(),seasons:z.array(z.number().int().min(1936).max(2025)).min(1).max(100)})).max(10000),
}).superRefine((m,c)=>{
  const seasons=new Set(m.seasons.map(s=>s.season));
  if(seasons.size!==m.seasons.length || new Set(m.players.map(p=>p.playerId)).size!==m.players.length || m.players.some(p=>p.seasons.some(y=>!seasons.has(y)))) c.addIssue({code:"custom",message:"Invalid historical index"});
  if(m.players.some(p=>p.birthDate!==undefined&&p.identityScope!=="historical_only"))c.addIssue({code:"custom",message:"Historical index DOB requires historical-only identity"});
});
export type NpbHistoricalManifest=z.infer<typeof npbHistoricalManifestSchema>;

/** Ratios are recomputed from their components; BB includes IBB, HBP stays separate. */
export function historicalRates(role: "batting" | "pitching", m: Record<string, number | null>): Record<string,number|null> {
  const divide = (numerator: string[], denominator: string[], factor = 1): number | null => {
    if ([...numerator, ...denominator].some(k => m[k] == null)) return null;
    const n = numerator.reduce((sum, k) => sum + m[k]!, 0), d = denominator.reduce((sum,k) => sum + m[k]!,0);
    return d > 0 ? factor * n / d : null;
  };
  if (role === "pitching") return { ERA: divide(["ER"], ["outsRecorded"], 27), WHIP: divide(["H", "BB"], ["outsRecorded"], 3), WPCT: divide(["W"], ["W", "L"]) };
  const AVG = divide(["H"], ["AB"]), OBP = divide(["H", "BB", "HBP"], ["AB", "BB", "HBP", "SF"]), SLG = divide(["TB"], ["AB"]);
  return { AVG, OBP, SLG, OPS: OBP === null || SLG === null ? null : OBP + SLG };
}

/** Collected seasons only; never a full-career total. Each component is null if any row is unknown. */
export function sumHistoricalRows(rows: readonly NpbHistoricalRow[]) {
  if (!rows.length || rows.some(r => r.playerId !== rows[0]!.playerId || r.role !== rows[0]!.role)) throw Error("Select one canonical player and role");
  const keys = rows[0]!.role === "batting" ? historicalBattingKeys : historicalPitchingKeys;
  const computed = new Set(["AVG", "OBP", "SLG", "OPS", "ERA", "WHIP", "WPCT"]);
  const metrics: Record<string, number | null> = Object.fromEntries(keys.filter(k => !computed.has(k)).map(k => [k, rows.some(r => r.metrics[k] == null) ? null : rows.reduce((s,r) => s + r.metrics[k]!,0)]));
  return { seasons: [...new Set(rows.map(r => r.season))].sort((a,b)=>a-b), metrics: { ...metrics, ...historicalRates(rows[0]!.role, metrics) } };
}
