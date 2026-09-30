import { Readable } from "node:stream";
import { parse } from "csv-parse";
import { extractHistoricalCsv, readHistoricalCsv } from "./mlb-historical";

export interface DirectBvpLine {
  batterRetrosheetId: string; pitcherRetrosheetId: string;
  pa: number; ab: number; hits: number; doubles: number; triples: number;
  homeRuns: number; walks: number; hbp: number; strikeouts: number;
}
type Play = Record<string, string>;
const binary = (value: string | undefined, field: string) => {
  if (value === "1") return 1;
  if (value === "0") return 0;
  throw new Error(`Missing or invalid Retrosheet PBP ${field}`);
};
const chunks = function* (bytes: Uint8Array) {
  for (let offset = 0; offset < bytes.length; offset += 64 * 1024)
    yield Buffer.from(bytes.subarray(offset, offset + 64 * 1024));
};

// Explicit batter/pitcher IDs on PA-ending play rows are the only matchup source.
export async function directBvpGamePoc(zip: Uint8Array, season: number, gameId: string) {
  const played = extractHistoricalCsv(zip, season, "plays");
  const batting = readHistoricalCsv(zip, season, "batting")
    .filter(row => row.gid === gameId);
  const lines = new Map<string, DirectBvpLine>();
  const batterPa = new Map<string, number>();
  let paRows = 0;
  let missingRelation = 0;
  let situationRows = 0;
  const stream = Readable.from(chunks(played)).pipe(parse({ columns: true, bom: true, skip_empty_lines: true }));
  for await (const row of stream as AsyncIterable<Play>) {
    if (row.gid !== gameId || row.gametype !== "regular") continue;
    if (row.inning && row.outs_pre !== "" && row.score_v !== "" && row.score_h !== "") situationRows++;
    if (row.pa !== "1") continue;
    paRows++;
    if (!row.batter || !row.pitcher) { missingRelation++; continue; }
    batterPa.set(row.batter, (batterPa.get(row.batter) ?? 0) + 1);
    const key = `${row.pitcher}:${row.batter}`;
    const line = lines.get(key) ?? {
      batterRetrosheetId: row.batter, pitcherRetrosheetId: row.pitcher,
      pa: 0, ab: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0,
      walks: 0, hbp: 0, strikeouts: 0,
    };
    line.pa++;
    line.ab += binary(row.ab, "ab");
    line.hits += binary(row.single, "single") + binary(row.double, "double") +
      binary(row.triple, "triple") + binary(row.hr, "hr");
    line.doubles += binary(row.double, "double");
    line.triples += binary(row.triple, "triple");
    line.homeRuns += binary(row.hr, "hr");
    line.walks += binary(row.walk, "walk");
    line.hbp += binary(row.hbp, "hbp");
    line.strikeouts += binary(row.k, "k");
    lines.set(key, line);
  }
  const mismatches = batting.filter(row => Number(row.b_pa) !== (batterPa.get(row.id ?? "") ?? 0))
    .map(row => ({ player: row.id, battingPa: Number(row.b_pa), pbpPa: batterPa.get(row.id ?? "") ?? 0 }));
  const metricMismatches: { player: string; metric: string; batting: number; pbp: number }[] = [];
  for (const row of batting) for (const [field, key] of [
    ["b_pa", "pa"], ["b_ab", "ab"], ["b_h", "hits"], ["b_d", "doubles"], ["b_t", "triples"],
    ["b_hr", "homeRuns"], ["b_w", "walks"], ["b_hbp", "hbp"], ["b_k", "strikeouts"],
  ] as const) {
    const actual = [...lines.values()].filter(line => line.batterRetrosheetId === row.id)
      .reduce((total, line) => total + line[key], 0);
    if (row[field] === undefined || row[field] === "" || Number(row[field]) !== actual)
      metricMismatches.push({ player: row.id ?? "", metric: key, batting: Number(row[field]), pbp: actual });
  }
  return { gameId, paRows, missingRelation, situationRows, pairs: [...lines.values()],
    battingRows: batting.length, mismatches, metricMismatches };
}
