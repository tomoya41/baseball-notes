import { Readable } from "node:stream";
import { parse } from "csv-parse";
import { extractHistoricalCsv, historicalId, historicalTeamId, POSTSEASON_GAME_TYPES, isRegularRetrosheetGame } from "./mlb-historical";
import type { HistoricalGame } from "./mlb-historical";
import { addPaCounts, emptyPaCounts, type HistoricalPlateAppearance, type PaCounts } from "../domain/mlb-plate-appearance";

export type RetrosheetPlay = Record<string, string>;
const integer = (value: string | undefined, max = Number.MAX_SAFE_INTEGER): number | null =>
  value !== undefined && /^\d+$/.test(value) && Number(value) <= max ? Number(value) : null;
const bit = (row: RetrosheetPlay, field: string) => {
  const value = integer(row[field], 1);
  if (value === null) throw new Error(`Invalid PA flag ${field}`);
  return value;
};
const baseState = (row: RetrosheetPlay, suffix: "pre" | "post") =>
  [1, 2, 3].every(base => row[`br${base}_${suffix}`] !== undefined)
    ? [1, 2, 3].reduce((mask, base) => mask | (row[`br${base}_${suffix}`] ? 1 << (base - 1) : 0), 0) : null;
const chunks = function* (bytes: Uint8Array) {
  for (let offset = 0; offset < bytes.length; offset += 65536) yield Buffer.from(bytes.subarray(offset, offset + 65536));
};
export async function* historicalPlays(zip: Uint8Array, season: number, competition: "regular" | "postseason" = "regular"): AsyncGenerator<RetrosheetPlay> {
  const stream = Readable.from(chunks(extractHistoricalCsv(zip, season, "plays")))
    .pipe(parse({ columns: true, bom: true, skip_empty_lines: true }));
  for await (const row of stream as AsyncIterable<RetrosheetPlay>) if (competition === "regular"
    ? isRegularRetrosheetGame(row.gametype) : POSTSEASON_GAME_TYPES.includes(row.gametype ?? "")) yield row;
}
/** Keeps runner-only plays inside their PA. Substitution makes start context unknown,
 * rather than assigning the previous batter's/pitcher's situation to a replacement. */
export class RetrosheetPaParser {
  private pending: RetrosheetPlay | null = null;
  private changed = false;
  private previous: RetrosheetPlay | null = null;
  private sequence = 0;
  private contextInvalid = false;
  private runs = new Map<string, number>();
  private outs = new Map<string, number>();
  readonly issues: string[] = [];
  readonly stateDetails: { code: string; sequence: string; previousSequence: string | null }[] = [];
  constructor(private readonly game: HistoricalGame, private readonly identities: ReadonlyMap<string, string>) {}
  consume(row: RetrosheetPlay): HistoricalPlateAppearance | null {
    // NP denotes no play (often a substitution before the automatic extra-inning
    // runner is placed). It must not become a PA-start/base-state observation.
    if (row.event === "NP") {
      if (bit(row, "pa") !== 0 || integer(row.runs) !== 0 || integer(row.outs_pre, 3) !== integer(row.outs_post, 3))
        throw new Error("Invalid no-play record");
      if (this.pending && (this.pending.batter !== row.batter || this.pending.pitcher !== row.pitcher)) this.changed = true;
      return null;
    }
    const inning = integer(row.inning);
    if (!inning || !["0", "1"].includes(row.top_bot ?? "")) throw new Error("Invalid inning/half");
    const sameHalf = this.previous !== null && this.previous.inning === row.inning && this.previous.top_bot === row.top_bot;
    const issue = (code: string) => {
      this.issues.push(code); this.stateDetails.push({ code, sequence: row.pn ?? "", previousSequence: this.previous?.pn ?? null });
      this.contextInvalid = true;
    };
    if (sameHalf && this.previous) {
      if (integer(row.outs_pre, 3) !== integer(this.previous.outs_post, 3)) issue("outs_continuity");
      // Runner IDs may change on a pinch run. Occupancy must remain consistent.
      if (baseState(row, "pre") !== baseState(this.previous, "post")) issue("base_continuity");
    }
    if (this.previous) {
      const runs = integer(this.previous.runs);
      if (runs !== null) for (const side of ["v", "h"] as const) {
        const before = integer(this.previous[`score_${side}`]);
        const after = integer(row[`score_${side}`]);
        const expected = before === null ? null : before + (this.previous.vis_home === (side === "v" ? "0" : "1") ? runs : 0);
        if (after !== expected) issue("score_continuity");
      }
    }
    if (!sameHalf) { this.pending = null; this.changed = false; this.contextInvalid = false; }
    if (!this.pending) this.pending = row;
    else if (this.pending.batter !== row.batter || this.pending.pitcher !== row.pitcher) this.changed = true;
    this.previous = row;
    const runs = integer(row.runs), pre = integer(row.outs_pre, 3), post = integer(row.outs_post, 3);
    if (runs === null || pre === null || post === null || post < pre) throw new Error("Invalid play runs/outs");
    const bt = historicalTeamId(row.batteam!), pt = historicalTeamId(row.pitteam!);
    this.runs.set(bt, (this.runs.get(bt) ?? 0) + runs);
    this.outs.set(pt, (this.outs.get(pt) ?? 0) + post - pre);
    if (bit(row, "pa") === 0) return null;
    if (pre === 3) throw new Error("PA after third out");
    const start = this.pending;
    const batterId = this.identities.get(row.batter ?? "");
    const pitcherId = this.identities.get(row.pitcher ?? "");
    if (!batterId || !pitcherId) throw new Error("Unresolved PA identity");
    const battingTeamId = historicalTeamId(row.batteam!);
    const fieldingTeamId = historicalTeamId(row.pitteam!);
    if (!this.game.batting.some(fact => fact.playerId === batterId && fact.teamId === battingTeamId) ||
      !this.game.pitching.some(fact => fact.playerId === pitcherId && fact.teamId === fieldingTeamId) || battingTeamId === fieldingTeamId)
      throw new Error("PA participant/team mismatch");
    const categories = ["single", "double", "triple", "hr", "sh", "sf", "hbp", "walk", "k", "xi", "roe", "fc", "othout", "noout"];
    const results = categories.filter(key => bit(row, key));
    if (results.length !== 1) throw new Error("Ambiguous PA result");
    const isAtBat = bit(row, "ab"), walks = bit(row, "walk"), intentionalWalks = bit(row, "iw");
    if (intentionalWalks > walks) throw new Error("IBB without BB");
    const order = integer(row.lp, 9);
    const boxOrder = this.game.batting.find(fact => fact.playerId === batterId && fact.teamId === battingTeamId)?.battingOrder;
    if (order && boxOrder !== null && order !== boxOrder) this.issues.push("lineup_slot");
    const rowId = historicalId("pa", `${this.game.id}:${++this.sequence}`);
    const v = integer(start.score_v), h = integer(start.score_h);
    const changed = this.changed, unknownContext = changed || this.contextInvalid;
    this.pending = null; this.changed = false; this.contextInvalid = false;
    return { id: rowId, league: "MLB", gameId: this.game.id, season: this.game.season, sequence: this.sequence,
      inning, half: row.top_bot === "0" ? "top" : "bottom", battingTeamId, fieldingTeamId, batterId, pitcherId,
      outsBefore: unknownContext ? null : integer(start.outs_pre, 2), baseStateBefore: unknownContext ? null : baseState(start, "pre"),
      battingOrder: order && order > 0 ? order : null,
      battingScoreBefore: unknownContext ? null : start.vis_home === "0" ? v : h,
      fieldingScoreBefore: unknownContext ? null : start.vis_home === "0" ? h : v,
      result: results[0]!, isAtBat, hits: bit(row, "single") + bit(row, "double") + bit(row, "triple") + bit(row, "hr"),
      doubles: bit(row, "double"), triples: bit(row, "triple"), homeRuns: bit(row, "hr"), walks, intentionalWalks,
      hbp: bit(row, "hbp"), strikeouts: bit(row, "k"), sacrificeHits: bit(row, "sh"), sacrificeFlies: bit(row, "sf"),
      substitutionDuringPa: changed };
  }
  finish(): string[] {
    const issues: string[] = [];
    for (const [teamId, score] of [[this.game.homeTeamId, this.game.homeRuns], [this.game.awayTeamId, this.game.awayRuns]] as const) {
      if ((this.runs.get(teamId) ?? 0) !== score) issues.push("final_score");
      const rows = this.game.pitching.filter(row => row.teamId === teamId);
      if (rows.every(row => row.outsRecorded !== null) && (this.outs.get(teamId) ?? 0) !== rows.reduce((sum, row) => sum + row.outsRecorded!, 0)) issues.push("defensive_outs");
    }
    return issues;
  }
}

export interface PaMismatch { gameId: string; role: "batting" | "pitching"; playerId: string;
  metric: string; expected: number; actual: number; reason: string }
export function validatePaGame(game: HistoricalGame, rows: readonly HistoricalPlateAppearance[]): PaMismatch[] {
  const batting = new Map<string, PaCounts>(), pitching = new Map<string, PaCounts>();
  for (const row of rows) for (const [map, id] of [[batting, `${row.battingTeamId}:${row.batterId}`], [pitching, `${row.fieldingTeamId}:${row.pitcherId}`]] as const) {
    const total = map.get(id) ?? emptyPaCounts(); addPaCounts(total, row); map.set(id, total);
  }
  const result: PaMismatch[] = [];
  for (const role of ["batting", "pitching"] as const) {
    const fields: [string, keyof PaCounts][] = role === "batting" ?
      [["pa", "PA"], ["ab", "isAtBat"], ["hits", "hits"], ["doubles", "doubles"], ["triples", "triples"],
        ["homeRuns", "homeRuns"], ["bb", "walks"], ["hbp", "hbp"], ["so", "strikeouts"], ["sh", "sacrificeHits"], ["sf", "sacrificeFlies"]] :
      [["bf", "PA"], ["hits", "hits"], ["homeRuns", "homeRuns"], ["bb", "walks"], ["hbp", "hbp"], ["so", "strikeouts"]];
    for (const fact of game[role]) for (const [field, metric] of fields) {
      const expected = (fact as unknown as Record<string, number | null>)[field];
      if (expected === null || expected === undefined) continue;
      const actual = (role === "batting" ? batting : pitching).get(`${fact.teamId}:${fact.playerId}`)?.[metric] ?? 0;
      if (expected !== actual) result.push({ gameId: game.id, role, playerId: fact.playerId, metric, expected, actual,
        reason: rows.some(row => row.substitutionDuringPa && (role === "batting" ? row.batterId === fact.playerId : row.pitcherId === fact.playerId))
          ? "substitution_attribution_requires_review" : "unknown" });
    }
  }
  return result;
}
