import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readNpbProfileSupplements } from "../src/infrastructure/providers/wikidata-npb-profile-supplement";
import { reviewedProfileBridges } from "../src/data/npb-reviewed-profile-bridges";
// Explicit local review step. No automatic source acquisition or DB writes.
const [claimsPath, labelsPath, observedAt, output] = process.argv.slice(2);
if (!claimsPath || !labelsPath || !observedAt || !output) throw Error("Usage: claims.json labels.json observedAt output.json");
const claims = await readFile(claimsPath, "utf8"), labels = await readFile(labelsPath, "utf8");
const value = readNpbProfileSupplements(JSON.parse(claims), JSON.parse(labels), reviewedProfileBridges, observedAt);
await writeFile(output, JSON.stringify(value, null, 2) + "\n");
console.log(JSON.stringify({ players: value.players.length, canonicalWrites: 0,
  claimsSha256: createHash("sha256").update(claims).digest("hex"), labelsSha256: createHash("sha256").update(labels).digest("hex") }));
