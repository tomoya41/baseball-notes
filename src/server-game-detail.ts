import { openDataClient } from "./data/database";
import { NpbGameDetailRepository } from "./data/npb-game-detail-repository";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept", "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" };

export function OPTIONS(): Response { return new Response(null, { status: 204, headers }); }

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url, "https://game-detail.local").searchParams;
  const gameId = params.get("gameId");
  if (!gameId || !/^npb:game:[0-9a-f]{20}$/.test(gameId) || [...params.keys()].some((key) => key !== "gameId"))
    return new Response(JSON.stringify({ error: "invalid_query" }), { status: 400, headers });
  const url = process.env.TURSO_DATABASE_URL, token = process.env.TURSO_AUTH_TOKEN;
  if (!url || !token) return new Response(JSON.stringify({ error: "service_unavailable" }), { status: 503, headers });
  const client = openDataClient(url, token);
  try {
    const started = performance.now();
    const result = await new NpbGameDetailRepository(client).find(gameId);
    if (!result) return new Response(JSON.stringify({ error: "game_not_found" }), { status: 404, headers });
    const readMs = performance.now() - started - result.projectionMs;
    const body = JSON.stringify(result.payload);
    return new Response(body, { status: 200, headers: { ...headers,
      "Server-Timing": `db;dur=${readMs.toFixed(1)}, project;dur=${result.projectionMs.toFixed(1)}` } });
  } catch {
    return new Response(JSON.stringify({ error: "game_detail_unavailable" }), { status: 503, headers });
  } finally { client.close(); }
}
