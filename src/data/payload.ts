import { standingsPayloadSchema, type StandingsPayload, type StandingsRepository } from "../domain/standings";
import { RETROSHEET_ATTRIBUTION } from "./source-registry";

export async function standingsPayload(repository: StandingsRepository, date: string): Promise<StandingsPayload> {
  const standings = await repository.findByDate("MLB", date);
  if (standings.length !== 30) throw new Error("Snapshot unavailable or incomplete");
  return standingsPayloadSchema.parse({
    schemaVersion: 1, league: "MLB", season: Number(date.slice(0, 4)),
    throughDate: date, calculatedAt: standings[0]?.calculatedAt,
    sourceKey: "retrosheet-csv", attribution: RETROSHEET_ATTRIBUTION,
    status: "historical", standings,
  });
}
