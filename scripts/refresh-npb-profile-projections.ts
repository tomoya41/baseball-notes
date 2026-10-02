import { readFile } from "node:fs/promises";
import { npbPlayerDirectorySchema } from "../src/domain/npb-player-directory";
import { buildNpbCapabilities } from "../src/application/npb-product-payload";
import { projectNpbFreeProfiles } from "../src/application/npb-profile-projection";
import { buildNpbSeasonMilestones } from "../src/application/npb-season-milestones";
import { readNpbPublication, writeNpbProfileProjections } from "./lib/npb-publication";

const [directoryFile, root] = process.argv.slice(2);
if (!directoryFile || !root) throw Error("Usage: refresh-npb-profile-projections.ts staged-directory.json site-root");
// Preserve/validate the released family first. No re-evaluation of Facts/Coverage/HOT/Ranking.
const baseline = await readNpbPublication(root);
const projection = projectNpbFreeProfiles(npbPlayerDirectorySchema.parse(JSON.parse(await readFile(directoryFile, "utf8"))), baseline.catalog);
const catalog = projection.catalog;
const capabilities = buildNpbCapabilities(catalog, baseline.season, baseline.hot.readiness);
const milestones = buildNpbSeasonMilestones(baseline.season, catalog);
await writeNpbProfileProjections(root, { ...baseline, directory: projection.directory, catalog, capabilities, milestones });
console.log(JSON.stringify({ effectiveDate: catalog.effectiveDate, players: catalog.players.length,
  projections: ["Directory", "Catalog", "Capabilities", "Milestones"], profileConflicts: projection.conflicts,
  canonicalWrites: 0, additionalQueries: 0, gates: "preserved" }));
