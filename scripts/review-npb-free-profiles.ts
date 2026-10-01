import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { readNpbProfileRegistry } from "../src/infrastructure/providers/wikidata-npb-profile-registry";

const [claimsPath, labelsPath, bridgesPath, outputPath, observedAt] = process.argv.slice(2);
if (!claimsPath || !labelsPath || !bridgesPath || !outputPath || !observedAt)
  throw Error("Usage: review-npb-free-profiles.ts claims.json labels.json exact-bridges.json output.json observedAt");
const bridgesSchema = z.array(z.object({ playerId: z.uuid(), wikidataId: z.string().regex(/^Q\d+$/), npbId: z.string().regex(/^\d{8}$/) }));
const [claims, labels, bridgeText] = await Promise.all([claimsPath, labelsPath, bridgesPath].map(path => readFile(path, "utf8")));
const teams = { Q127635: "npb:team:tigers", Q1197407: "npb:team:giants", Q1194023: "npb:team:baystars",
  Q209961: "npb:team:dragons", Q247577: "npb:team:carp", Q1324392: "npb:team:swallows",
  Q129164: "npb:team:hawks", Q974277: "npb:team:fighters", Q1328038: "npb:team:buffaloes",
  Q1375077: "npb:team:eagles", Q325819: "npb:team:lions", Q484151: "npb:team:marines" };
const result = readNpbProfileRegistry(JSON.parse(claims), JSON.parse(labels), bridgesSchema.parse(JSON.parse(bridgeText)), observedAt, teams);
await writeFile(outputPath, `${JSON.stringify(result.registry, null, 2)}\n`);
await writeFile(`${outputPath}.audit.json`, `${JSON.stringify({ observedAt, identities: bridgesSchema.parse(JSON.parse(bridgeText)).length,
  entries: result.registry.entries.length, humanReviewed: result.registry.entries.filter(e => e.verificationStatus === "human_reviewed").length,
  sourceHashes: Object.fromEntries([["claims", claims], ["labels", labels], ["bridges", bridgeText]].map(([key, body]) => [key, createHash("sha256").update(body!).digest("hex")])),
  rejected: result.rejected }, null, 2)}\n`);
console.log(JSON.stringify({ entries: result.registry.entries.length, rejected: result.rejected.length, canonicalWrites: 0 }));
