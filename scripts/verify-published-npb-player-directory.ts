import { verifyNpbPublicationReadback } from "./lib/npb-publication-readback";

const expectedGeneration = process.env.EXPECTED_GENERATED_AT;
const hashes = process.env.EXPECTED_PROJECTION_HASHES ? JSON.parse(process.env.EXPECTED_PROJECTION_HASHES) as Record<string, string> : null;
if (process.env.GITHUB_ACTIONS === "true" && !hashes) throw Error("Staged projection hashes required for deployment verification");
if (!expectedGeneration) throw Error("EXPECTED_GENERATED_AT is required");
console.log(JSON.stringify(await verifyNpbPublicationReadback({ expectedGeneration, hashes })));
