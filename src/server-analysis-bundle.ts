import { z } from "zod";
import { openDataClient } from "./data/database";
import { NpbRepository } from "./data/npb-repository";
import { NpbPeriodCoverageRepository } from "./data/npb-period-coverage-repository";
import { PlayerAnalysisBundleService } from "./application/player-analysis-bundle";

const querySchema = z.strictObject({ playerId: z.string().uuid() });
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept", "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300" };

export function OPTIONS(): Response { return new Response(null, { status: 204, headers }); }

export async function GET(request: Request): Promise<Response> {
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url, "https://analysis-bundle.local").searchParams));
  if (!query.success) return new Response(JSON.stringify({ error: "invalid_query" }), { status: 400, headers });
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url || !token) return new Response(JSON.stringify({ error: "service_unavailable" }), { status: 503, headers });
  const client = openDataClient(url, token);
  const started = performance.now();
  try {
    const repository = new NpbRepository(client);
    const standings = await repository.findLatestStandings();
    const asOfDate = standings[0]?.date;
    if (!asOfDate) return new Response(JSON.stringify({ error: "no_standings" }), { status: 503, headers });
    const result = await new PlayerAnalysisBundleService(repository, new NpbPeriodCoverageRepository(client))
      .find(query.data.playerId, asOfDate);
    if (!result) return new Response(JSON.stringify({ error: "player_not_found" }), { status: 404, headers });
    const serializationStarted = performance.now();
    const body = JSON.stringify(result.payload);
    const serializationMs = performance.now()-serializationStarted;
    return new Response(body, { status: 200, headers: { ...headers,
      "Server-Timing": `db;dur=${result.dbReadMs.toFixed(1)}, aggregate;dur=${result.aggregationMs.toFixed(1)}, ` +
        `context;dur=${result.contextBuildMs.toFixed(2)}, partition;dur=${result.partitionMs.toFixed(2)}, ` +
        `serialize;dur=${serializationMs.toFixed(2)}, total;dur=${(performance.now()-started).toFixed(1)}, ` +
        `role-partition;dur=${result.rolePartitionMs.toFixed(1)}, role-aggregate;dur=${result.roleAggregationMs.toFixed(1)}` } });
  } catch {
    return new Response(JSON.stringify({ error: "analysis_unavailable" }), { status: 503, headers });
  } finally { client.close(); }
}
