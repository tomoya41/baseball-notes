import { openDataClient } from "../src/data/database";
import { NpbPlayerMasterV2Importer } from "../src/data/npb-player-master-v2";
import { verifiedPlayerMappings } from "../src/data/npb-verified-player-mappings";
import { WikidataPlayerProfileProvider } from "../src/infrastructure/providers/wikidata-player-profile-provider";

const url = process.env.TURSO_DATABASE_URL ?? "file:.data/baseball.db";
const apply = process.argv.includes("--apply");
if (apply && !process.argv.includes("--confirmed-mapping"))
  throw new Error("Explicit --confirmed-mapping is required for Player Master writes");
const profiles = await new WikidataPlayerProfileProvider().read(verifiedPlayerMappings.map((item) => item.wikidataId));
const client = openDataClient(url, process.env.TURSO_AUTH_TOKEN);
try {
  const factCounts = async () => Promise.all(["player_game_batting", "player_game_pitching", "npb_games"]
    .map(async (table) => Number((await client.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0]?.n ?? 0)));
  const beforeFacts = await factCounts();
  const importer = new NpbPlayerMasterV2Importer(client);
  await importer.import(profiles, true);
  const result = await importer.import(profiles, !apply);
  const afterFacts = await factCounts();
  if (beforeFacts.some((count, index) => count !== afterFacts[index]))
    throw new Error("Player Master import changed Game Fact counts");
  const mappingCheck = await client.execute(`SELECT COUNT(*) AS total,COUNT(DISTINCT source_entity_id) AS unique_ids
    FROM source_entity_mappings WHERE source_key='wikidata' AND entity_kind='player'`);
  process.stdout.write(`${JSON.stringify({ dryRun: result.dryRun, existingPlayers: result.existingPlayers,
    newPlayers: result.newPlayers, reviewedExistingPlayers: result.updatedPlayers,
    mappedWikidataIds: profiles.length, wikidataMappings: Number(mappingCheck.rows[0]?.total ?? 0),
    duplicateSourceIds: Number(mappingCheck.rows[0]?.total ?? 0) - Number(mappingCheck.rows[0]?.unique_ids ?? 0),
    factCountsUnchanged: true, battingFactCount: afterFacts[0], pitchingFactCount: afterFacts[1],
    gameCount: afterFacts[2] })}\n`);
} finally { client.close(); }
