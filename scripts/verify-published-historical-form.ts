import { gunzipSync } from "node:zlib";
import { formIndexSchema, formMonthSchema } from "../src/domain/historical-form";

/** Bounded public readback; full Game-Fact reconciliation runs before publication. */
const base = "https://tomoya41.github.io/baseball-notes/data/mlb/historical/";
let requests = 0, bytes = 0;
async function read(path: string): Promise<unknown> {
  const response = await fetch(`${base}${path}.gz?v=${Date.now()}`, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Error(`Public form HTTP ${response.status}: ${path}`);
  const raw = Buffer.from(await response.arrayBuffer()); requests++; bytes += raw.length;
  return JSON.parse(gunzipSync(raw).toString());
}
for (const competition of ["regular", "postseason"] as const) {
  const prefix = competition === "regular" ? "" : "postseason/";
  const manifest = await read(`${prefix}manifest.json`) as { seasons: { season: number; games: number; firstDate: string; lastDate: string; coverage: string }[] };
  for (const descriptor of manifest.seasons) {
    const index = formIndexSchema.parse(await read(`${prefix}exploration/form/${descriptor.season}/index.json`));
    if (index.season !== descriptor.season || index.competitionType !== competition || index.coverage !== descriptor.coverage || index.gameCount !== descriptor.games || index.firstDate !== descriptor.firstDate || index.lastDate !== descriptor.lastDate) throw Error("Public form/manifest generation mismatch");
    for (const descriptor of [index.months[0], index.months.at(-1)].filter((m, i, a) => m && a.indexOf(m) === i)) {
      const month = formMonthSchema.parse(await read(`${prefix}exploration/form/${index.season}/${descriptor!.month}.json`));
      if (month.sourceFingerprint !== index.sourceFingerprint || month.competitionType !== competition || month.season !== index.season || month.month !== descriptor!.month || month.batting.length + month.starters.length + month.relievers.length + month.unknown.length !== descriptor!.rows || month.players.some(id => !index.roles.some(role => role.playerId === id))) throw Error("Public form shard mismatch");
    }
  }
}
console.log(JSON.stringify({ result: "PASS", requests, bytes, canonicalWrites: 0 }));
