import { readNpbPublication } from "./lib/npb-publication";
const payload = await readNpbPublication(process.argv[2] ?? "dist");
console.log(JSON.stringify({ publication: "consistent", effectiveDate: payload.directory.effectiveDate,
  players: payload.directory.players.length, milestones: payload.milestones !== undefined }));
