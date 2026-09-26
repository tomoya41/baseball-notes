import { z } from "zod";
import { openDataClient } from "./data/database";
import { NpbPlayerGameLogRepository } from "./data/npb-player-game-log-repository";

const querySchema = z.strictObject({ playerId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().nonnegative().default(0) });
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept", "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" };

export function OPTIONS(): Response { return new Response(null, { status: 204, headers }); }

export async function GET(request: Request): Promise<Response> {
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url, "https://game-log.local").searchParams));
  if (!query.success) return new Response(JSON.stringify({ error: "invalid_query" }), { status: 400, headers });
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url || !token) return new Response(JSON.stringify({ error: "service_unavailable" }), { status: 503, headers });
  const client = openDataClient(url, token);
  try {
    const readStartedAt = performance.now();
    const result = await new NpbPlayerGameLogRepository(client).find(query.data.playerId, query.data.limit, query.data.offset);
    if (!result) return new Response(JSON.stringify({ error: "player_not_found" }), { status: 404, headers });
    const readMs = performance.now() - readStartedAt;
    const body = JSON.stringify(result);
    const serializationMs = performance.now() - readStartedAt - readMs;
    return new Response(body, { status: 200, headers: { ...headers,
      "Server-Timing": `db;dur=${readMs.toFixed(1)}, serialize;dur=${serializationMs.toFixed(1)}` } });
  } catch {
    return new Response(JSON.stringify({ error: "game_log_unavailable" }), { status: 503, headers });
  } finally { client.close(); }
}
