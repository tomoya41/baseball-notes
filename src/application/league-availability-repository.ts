import type { League } from "../domain/models";
import type { LeagueAvailability } from "../domain/league-availability";

export interface LeagueAvailabilityRepository {
  find(league: League): Promise<LeagueAvailability>;
}
