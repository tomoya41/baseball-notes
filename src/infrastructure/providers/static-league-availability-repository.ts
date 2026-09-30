import { publicDataFetch, rememberPublicResponse } from "../public-response-cache";
import { leagueSchema } from "../../domain/models";
import type { League } from "../../domain/models";
import { leagueAvailabilitySchema } from "../../domain/league-availability";
import type { LeagueAvailability } from "../../domain/league-availability";
import type { LeagueAvailabilityRepository } from "../../application/league-availability-repository";

export class StaticLeagueAvailabilityRepository implements LeagueAvailabilityRepository {
  private readonly pending = new Map<League, Promise<LeagueAvailability>>();
  constructor(private readonly baseUrl: string, private readonly request: typeof fetch = publicDataFetch) {}

  find(league: League): Promise<LeagueAvailability> {
    leagueSchema.parse(league);
    const cached = this.pending.get(league);
    if (cached) return cached;
    const read = this.read(league).catch(error => { this.pending.delete(league); throw error; });
    this.pending.set(league, read);
    return read;
  }
  private async read(league: League): Promise<LeagueAvailability> {
    const response = await this.request(`${this.baseUrl.replace(/\/?$/, "/")}data/${league.toLowerCase()}/manifest.json`,
      { cache: "no-cache" });
    if (!response.ok) throw new Error(`League availability HTTP ${response.status}`);
    const value = leagueAvailabilitySchema.parse(await response.json() as unknown);
    if (value.league !== league) throw new Error("League availability mismatch");
    await rememberPublicResponse(response);
    return value;
  }
}
