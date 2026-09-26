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
  const importer = new NpbPlayerMasterV2Importer(client);
  await importer.import(profiles, true);
  const result = await importer.import(profiles, !apply);
  process.stdout.write(`${JSON.stringify({ dryRun: result.dryRun, existingPlayers: result.existingPlayers,
    newPlayers: result.newPlayers, reviewedExistingPlayers: result.updatedPlayers,
    mappedWikidataIds: profiles.length })}\n`);
} finally { client.close(); }
