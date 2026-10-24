// Read only the app's already published, validated score indexes. No provider or DB access.
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gameDateIndexSchema, gameManifestSchema, shiftGameDate } from "../src/domain/npb-game-index";

const base = "https://tomoya41.github.io/baseball-notes/data/npb/games/";
async function read(path: string) {
  const r = await fetch(base + path, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw Error(`Published game index HTTP ${r.status}`);
  const body = await r.text();
  return { value: JSON.parse(body) as unknown, hash: createHash("sha256").update(body).digest("hex") };
}
const manifest = gameManifestSchema.parse((await read("manifest.json")).value);
const dates: string[] = [];
for (let date = manifest.from; date <= manifest.to; date = shiftGameDate(date, 1)) {
  if (dates.length >= 370) throw Error("Game index exceeds one season");
  dates.push(date);
}
const entries: [string, string][] = [], hashes: Record<string, string> = {};
for (let i = 0; i < dates.length; i += 8) {
  const batch = await Promise.all(dates.slice(i, i + 8).map(async date => {
    const result = await read(`dates/${date}.json`), day = gameDateIndexSchema.parse(result.value);
    if (day.date !== date || day.generatedAt !== manifest.generatedAt) throw Error("Publication snapshot mismatch");
    return { date, hash: result.hash, games: day.games };
  }));
  for (const day of batch) {
    hashes[day.date] = day.hash;
    entries.push(...day.games.map(g => [g.gameId, day.date] as [string, string]));
  }
}
if (new Set(entries.map(([id]) => id)).size !== entries.length) throw Error("Duplicate Game identity");
const finalManifest = gameManifestSchema.parse((await read("manifest.json")).value);
if (JSON.stringify(finalManifest) !== JSON.stringify(manifest)) throw Error("Publication changed during capture");
const payload = { schemaVersion: 1, league: "NPB", competition: "regular", effectiveDate: manifest.effectiveDate,
  generatedAt: manifest.generatedAt, dates: Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))) };
await writeFile("src/data/npb-game-date-index.json", JSON.stringify(payload) + "\n");
await mkdir(".data/npb-game-retrieval", { recursive: true });
await writeFile(".data/npb-game-retrieval/index-capture.json", JSON.stringify({ ...manifest, hashes, games: entries.length }, null, 2));
console.log(JSON.stringify({ dates: dates.length, games: entries.length, bytes: Buffer.byteLength(JSON.stringify(payload)), dbQueries: 0 }));
