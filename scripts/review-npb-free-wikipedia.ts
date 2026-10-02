import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { readWikipediaNpbProfile } from "../src/infrastructure/providers/wikipedia-npb-profile";
import identities from "../src/data/npb-free-profile-identities.json";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error("Usage: review-npb-free-wikipedia.ts official-api-archive.json output.json");
const text = await readFile(input, "utf8");
const raw = z.object({ observedAt: z.iso.datetime(), pages: z.record(z.string(), z.unknown()),
  titles: z.array(z.object({ playerId: z.uuid(), wikidataId: z.string(), npbId: z.string(), title: z.string() })) }).parse(JSON.parse(text));
const entries: ReturnType<typeof readWikipediaNpbProfile>["entries"] = [];
for (const bridge of raw.titles) {
  if (!identities.some(i => i.playerId === bridge.playerId && i.npbId === bridge.npbId && i.wikidataId === bridge.wikidataId))
    throw Error("Unverified Wikipedia canonical identity bridge");
  entries.push(...readWikipediaNpbProfile(raw.pages[bridge.title], bridge, raw.observedAt).entries);
}
await writeFile(output, `${JSON.stringify({ schemaVersion: 1, observedAt: raw.observedAt, entries }, null, 2)}\n`);
console.log(JSON.stringify({ profiles: raw.titles.length, entries: entries.length, inputSha256: createHash("sha256").update(text).digest("hex"), canonicalWrites: 0 }));
