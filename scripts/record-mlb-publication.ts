import { appendFile } from "node:fs/promises";
import { stagedHistoricalManifestHashes } from "./lib/mlb-public-readback";
const hashes = await stagedHistoricalManifestHashes(process.argv[2]!, process.env.MLB_PUBLISH_MODE!);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `manifest_hashes=${JSON.stringify(hashes)}\n`);
console.log(JSON.stringify({ historicalManifests: Object.keys(hashes), canonicalWrites: 0 }));
