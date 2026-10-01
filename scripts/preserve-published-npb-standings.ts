import { preserveNpbPublicStandings } from "./lib/npb-publication";
console.log(JSON.stringify(await preserveNpbPublicStandings(process.argv[2] ?? "dist")));
