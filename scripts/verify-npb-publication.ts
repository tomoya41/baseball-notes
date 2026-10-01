import { appendFile } from "node:fs/promises";
import { readNpbPublication, npbPublicationHashes } from "./lib/npb-publication";
const root = process.argv[2] ?? "dist", payload = await readNpbPublication(root);
const hashes = await npbPublicationHashes(root);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `projection_hashes=${JSON.stringify(hashes)}\n`);
console.log(JSON.stringify({ publication: "consistent", effectiveDate: payload.directory.effectiveDate,
  players: payload.directory.players.length, milestones: payload.milestones !== undefined }));
