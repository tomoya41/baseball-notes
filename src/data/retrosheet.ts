import { parse } from "csv-parse/sync";
import { unzipSync } from "fflate";
import { z } from "zod";
import { gameFactSchema, type GameFact } from "../domain/standings";

export const RETROSHEET_ARCHIVE_URL = "https://www.retrosheet.org/downloads/2025/2025csvs.zip";

// Retrosheet IDs stay in this adapter. Domain IDs are stable team identities.
const teams = {
  ANA: ["los-angeles-angels", "AL West"], ARI: ["arizona-diamondbacks", "NL West"],
  ATH: ["athletics", "AL West"], ATL: ["atlanta-braves", "NL East"],
  BAL: ["baltimore-orioles", "AL East"], BOS: ["boston-red-sox", "AL East"],
  CHA: ["chicago-white-sox", "AL Central"], CHN: ["chicago-cubs", "NL Central"],
  CIN: ["cincinnati-reds", "NL Central"], CLE: ["cleveland-guardians", "AL Central"],
  COL: ["colorado-rockies", "NL West"], DET: ["detroit-tigers", "AL Central"],
  HOU: ["houston-astros", "AL West"], KCA: ["kansas-city-royals", "AL Central"],
  LAN: ["los-angeles-dodgers", "NL West"], MIA: ["miami-marlins", "NL East"],
  MIL: ["milwaukee-brewers", "NL Central"], MIN: ["minnesota-twins", "AL Central"],
  NYA: ["new-york-yankees", "AL East"], NYN: ["new-york-mets", "NL East"],
  PHI: ["philadelphia-phillies", "NL East"], PIT: ["pittsburgh-pirates", "NL Central"],
  SDN: ["san-diego-padres", "NL West"], SEA: ["seattle-mariners", "AL West"],
  SFN: ["san-francisco-giants", "NL West"], SLN: ["st-louis-cardinals", "NL Central"],
  TBA: ["tampa-bay-rays", "AL East"], TEX: ["texas-rangers", "AL West"],
  TOR: ["toronto-blue-jays", "AL East"], WAS: ["washington-nationals", "NL East"],
} as const;
export const mlb2025Teams = Object.entries(teams).map(([sourceId, [id, group]]) => ({
  sourceId, id: `mlb:team:${id}`, group,
}));
const wireSchema = z.object({
  gid: z.string().min(1), visteam: z.string(), hometeam: z.string(),
  date: z.string().regex(/^\d{8}$/), suspend: z.string(), gametype: z.string(),
  vruns: z.coerce.number().int().nonnegative(), hruns: z.coerce.number().int().nonnegative(),
  season: z.coerce.number().int(),
});
function dateOnly(value: string): string {
  const formatted = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  if (!z.iso.date().safeParse(formatted).success) throw new Error(`Invalid date: ${value}`);
  return formatted;
}

export function extractGameInfo(zip: Uint8Array, season = 2025): string {
  const expected = `${season}gameinfo.csv`;
  const files = unzipSync(zip, { filter: (file) => file.name === expected });
  const csv = files[expected];
  if (!csv) throw new Error(`Archive has no ${expected}`);
  return new TextDecoder().decode(csv);
}

export function normalizeRetrosheetGames(csv: string, season: number, collectedAt: string): GameFact[] {
  if (season !== 2025) throw new Error("Only the verified 2025 team mapping is supported");
  const records: unknown[] = parse(csv, { columns: true, skip_empty_lines: true, bom: true });
  const games: GameFact[] = [];
  const seen = new Set<string>();
  for (const input of records) {
    const record = wireSchema.parse(input);
    if (record.gametype !== "regular") continue;
    if (record.season !== season) throw new Error("Unexpected season");
    const home = mlb2025Teams.find((team) => team.sourceId === record.hometeam);
    const away = mlb2025Teams.find((team) => team.sourceId === record.visteam);
    if (!home || !away) throw new Error(`Unknown Retrosheet team in ${record.gid}`);
    if (seen.has(record.gid)) throw new Error(`Duplicate game: ${record.gid}`);
    seen.add(record.gid);
    games.push(gameFactSchema.parse({
      id: `mlb:game:retrosheet:${record.gid}`, league: "MLB", season,
      playedOn: dateOnly(record.date),
      completedOn: dateOnly(record.suspend || record.date),
      homeTeamId: home.id, awayTeamId: away.id,
      homeRuns: record.hruns, awayRuns: record.vruns,
      sourceKey: "retrosheet-csv", sourceRecordId: record.gid,
      sourceUrl: RETROSHEET_ARCHIVE_URL, collectedAt,
    }));
  }
  // A truncated release must never replace an already-good season.
  if (games.length < 2400 || games.length > 2500) throw new Error(`Implausible 2025 regular-season count: ${games.length}`);
  if (new Set(games.flatMap((game) => [game.homeTeamId, game.awayTeamId])).size !== 30)
    throw new Error("Implausible 2025 team coverage");
  return games;
}
