import { verifyHistoricalManifestReadback } from "./lib/mlb-public-readback";
if (!process.env.MLB_MANIFEST_HASHES) throw Error("Staged Historical manifest hashes required");
const hashes = JSON.parse(process.env.MLB_MANIFEST_HASHES) as Record<string, string>;
console.log(JSON.stringify(await verifyHistoricalManifestReadback(hashes, process.env.MLB_PUBLISH_MODE!)));
