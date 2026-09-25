import { z } from "zod";
import { openDataClient } from "./data/database";
import { NpbRepository } from "./data/npb-repository";
import { NpbPeriodCoverageRepository } from "./data/npb-period-coverage-repository";
import { PlayerPeriodService } from "./application/player-period";
import { getPlayerRecent } from "./application/player-recent";
import { playerRecentResponseSchema } from "./domain/player-recent";

const querySchema = z.object({ playerId: z.string().uuid(), period: z.enum(["7d", "14d", "30d"]) });
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept", "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300" };

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers });
}

export async function GET(request: Request): Promise<Response> {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url, "https://recent.local").searchParams));
  if (!parsed.success) return new Response(JSON.stringify({ error: "invalid_query" }), { status: 400, headers });
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url || !token) return new Response(JSON.stringify({ error: "service_unavailable" }), { status: 503, headers });
  const client = openDataClient(url, token);
  try {
    const repository = new NpbRepository(client);
    const standings = await repository.findLatestStandings();
    const asOfDate = standings[0]?.date;
    if (!asOfDate) return new Response(JSON.stringify({ error: "no_standings" }), { status: 503, headers });
    const periods = new PlayerPeriodService(repository, undefined, new NpbPeriodCoverageRepository(client));
    const value = await getPlayerRecent(repository, periods, parsed.data.playerId, parsed.data.period, asOfDate);
    if (!value) return new Response(JSON.stringify({ error: "player_not_found" }), { status: 404, headers });
    return new Response(JSON.stringify(playerRecentResponseSchema.parse(value)), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: "recent_unavailable" }), { status: 503, headers });
  } finally {
    client.close();
  }
}
