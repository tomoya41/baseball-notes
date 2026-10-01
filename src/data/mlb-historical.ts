import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import type { CompetitionType, PostseasonRound } from "../domain/competition";
import { mlb2025Teams } from "./retrosheet";
import { unzipSync } from "fflate";

export const POSTSEASON_GAME_TYPES = ["wildcard", "divisionseries", "lcs", "worldseries"];
export function retrosheetRound(type: string, homeTeam: string): PostseasonRound {
  if (type === "wildcard") return "wild_card";
  if (type === "divisionseries") return "division_series";
  if (type === "worldseries") return "world_series";
  const group = mlb2025Teams.find(team => team.sourceId === (homeTeam === "OAK" ? "ATH" : homeTeam))?.group;
  if (type === "lcs" && group) return group.startsWith("AL") ? "alcs" : "nlcs";
  throw new Error("Unknown postseason type/team group");
}

export const HISTORICAL_SEASONS = [2020, 2021, 2022, 2023, 2024, 2025] as const;
export type HistoricalSeason = typeof HISTORICAL_SEASONS[number];

export interface HistoricalPlayer {
  id: string;
  name: string;
  bats: string | null;
  throws: string | null;
  positions: string[];
  seasons: number[];
  teamIds: string[];
  chadwickMapped: boolean;
}
export interface HistoricalGame {
  competitionType?: "postseason";
  postseasonRound?: PostseasonRound;
  id: string;
  season: number;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  homeRuns: number;
  awayRuns: number;
  innings: number | null;
  number: number;
  batting: HistoricalBatter[];
  pitching: HistoricalPitcher[];
  validationIssues: string[];
}
export interface HistoricalBatter {
  playerId: string; teamId: string; battingOrder: number | null; appearanceOrder: number | null;
  starter: boolean | null; pa: number | null; ab: number | null; runs: number | null;
  hits: number | null; doubles: number | null; triples: number | null; homeRuns: number | null;
  rbi: number | null; bb: number | null; hbp: number | null; sh: number | null;
  sf: number | null; so: number | null; sb: number | null; cs: number | null;
}
export interface HistoricalPitcher {
  playerId: string; teamId: string; role: "starter" | "reliever" | "unknown";
  appearanceOrder: number | null; outsRecorded: number | null; bf: number | null;
  hits: number | null; homeRuns: number | null; bb: number | null; hbp: number | null;
  so: number | null; runs: number | null; er: number | null;
  pitchCount: null; win: boolean | null; loss: boolean | null; save: boolean | null;
  hold: null;
}
export interface HistoricalImport {
  season: number;
  games: HistoricalGame[];
  players: HistoricalPlayer[];
  unresolvedRetrosheetIds: string[];
  validationIssueCount: number;
}

type CsvRow = Record<string, string>;
const csv = (content: Uint8Array): CsvRow[] => parse(new TextDecoder().decode(content), {
  columns: true, bom: true, skip_empty_lines: true,
});
const count = (value: string | undefined): number | null => {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid source count: ${value}`);
  return parsed;
};
const date = (value: string): string => {
  if (!/^\d{8}$/.test(value)) throw new Error(`Invalid source date: ${value}`);
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
};

// UUID-shaped internal IDs are derived from a versioned namespace, never exposed source keys.
export function historicalId(kind: "game" | "player" | "team" | "pa" | "series", sourceIdentity: string): string {
  const bytes = createHash("sha256").update(`baseball-notes:mlb:${kind}:v1:${sourceIdentity}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `mlb:${kind}:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// OAK and ATH identify the same franchise across the selected releases.
const teamIdentity = (source: string) => source === "OAK" ? "ATH" : source;
export const historicalTeamId = (source: string) => historicalId("team", teamIdentity(source));

export function readHistoricalCsv(zip: Uint8Array, season: number, name: string): CsvRow[] {
  return csv(extractHistoricalCsv(zip, season, name));
}
export function extractHistoricalCsv(zip: Uint8Array, season: number, name: string): Uint8Array {
  const expected = `${season}${name}.csv`;
  const contents = unzipSync(zip, { filter: file => file.name === expected });
  if (!contents[expected]) throw new Error(`Missing official CSV: ${expected}`);
  return contents[expected];
}

export function chadwickBridge(zip: Uint8Array): Map<string, string> {
  const entries = unzipSync(zip, { filter: file => /\/data\/people-[0-9a-f]\.csv$/.test(file.name) });
  if (Object.keys(entries).length !== 16) throw new Error("Incomplete Chadwick Register extract");
  const bridge = new Map<string, string>();
  for (const content of Object.values(entries)) for (const row of csv(content)) {
    const retro = row.key_retro;
    if (!retro) continue;
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(row.key_uuid ?? ""))
      throw new Error(`Invalid Chadwick UUID for ${retro}`);
    if (bridge.has(retro) && bridge.get(retro) !== row.key_uuid)
      throw new Error(`Ambiguous Chadwick mapping: ${retro}`);
    bridge.set(retro, row.key_uuid!);
  }
  return bridge;
}

/** Check a changed identity release before writing any corrected Game facts. */
export function verifyHistoricalIdentityBridge(bridge: Map<string, string>, existing: Map<string, string>): void {
  for (const [key, canonicalId] of existing) {
    if (!key.startsWith("retrosheet:")) continue;
    const uuid = bridge.get(key.slice("retrosheet:".length));
    if (!uuid || historicalId("player", `chadwick:${uuid}`) !== canonicalId)
      throw new Error("Chadwick identity changed or disappeared; explicit identity review required");
  }
}

function mapBatter(row: CsvRow, playerId: string): HistoricalBatter {
  const slot = count(row.b_lp);
  const sequence = count(row.b_seq);
  if (slot !== null && (slot < 1 || slot > 9)) throw new Error("Invalid batting order");
  return {
    playerId, teamId: historicalTeamId(row.team ?? ""), battingOrder: slot,
    appearanceOrder: sequence, starter: sequence === null ? null : sequence === 1,
    pa: count(row.b_pa), ab: count(row.b_ab), runs: count(row.b_r), hits: count(row.b_h),
    doubles: count(row.b_d), triples: count(row.b_t), homeRuns: count(row.b_hr),
    rbi: count(row.b_rbi), bb: count(row.b_w), hbp: count(row.b_hbp),
    sh: count(row.b_sh), sf: count(row.b_sf), so: count(row.b_k),
    sb: count(row.b_sb), cs: count(row.b_cs),
  };
}
function mapPitcher(row: CsvRow, playerId: string, gameinfo: CsvRow): HistoricalPitcher {
  const sequence = count(row.p_seq);
  if (row.p_gs === "1" && sequence !== 1) throw new Error(`Pitcher starter/order conflict: ${row.gid}`);
  if (row.wp === "1" && gameinfo.wp !== row.id || row.lp === "1" && gameinfo.lp !== row.id ||
    row.save === "1" && gameinfo.save !== row.id) throw new Error(`Pitcher decision conflict: ${row.gid}`);
  return {
    playerId, teamId: historicalTeamId(row.team ?? ""),
    role: sequence === 1 ? "starter" : sequence !== null ? "reliever" : "unknown",
    appearanceOrder: sequence, outsRecorded: count(row.p_ipouts), bf: count(row.p_bfp),
    hits: count(row.p_h), homeRuns: count(row.p_hr), bb: count(row.p_w),
    hbp: count(row.p_hbp), so: count(row.p_k), runs: count(row.p_r), er: count(row.p_er),
    pitchCount: null, win: gameinfo.wp !== undefined ? gameinfo.wp === row.id : null,
    loss: gameinfo.lp !== undefined ? gameinfo.lp === row.id : null,
    save: gameinfo.save !== undefined ? gameinfo.save === row.id : null, hold: null,
  };
}

function sum(rows: readonly (number | null)[]): number | null {
  return rows.some(value => value === null) ? null : rows.reduce<number>((total, value) => total + (value ?? 0), 0);
}
export function validateHistoricalGame(game: HistoricalGame, teams: readonly CsvRow[]): string[] {
  const issues: string[] = [];
  if (teams.length !== 2) issues.push("teamstats:missing");
  for (const row of teams) {
    const teamId = historicalTeamId(row.team ?? "");
    if (teamId !== game.homeTeamId && teamId !== game.awayTeamId) issues.push("teamstats:team");
    const batters = game.batting.filter(value => value.teamId === teamId);
    const pitchers = game.pitching.filter(value => value.teamId === teamId);
    const opponentPitchers = game.pitching.filter(value => value.teamId !== teamId);
    const expectedRuns = teamId === game.homeTeamId ? game.homeRuns : game.awayRuns;
    if (sum(batters.map(value => value.runs)) !== expectedRuns) issues.push(`${row.team}:score`);
    if (sum(batters.map(value => value.pa)) !== sum(opponentPitchers.map(value => value.bf)))
      issues.push(`${row.team}:pa_bf`);
    for (const [field, actual] of [
      ["b_pa", sum(batters.map(value => value.pa))],
      ["b_h", sum(batters.map(value => value.hits))],
      ["p_ipouts", sum(pitchers.map(value => value.outsRecorded))],
      ["p_bfp", sum(pitchers.map(value => value.bf))],
    ] as const) if (actual !== count(row[field])) issues.push(`${row.team}:${field}`);
    if (new Set(batters.map(value => value.playerId)).size !== batters.length) issues.push(`${row.team}:duplicate_batter`);
    if (new Set(pitchers.map(value => value.playerId)).size !== pitchers.length) issues.push(`${row.team}:duplicate_pitcher`);
  }
  if (!game.batting.length || !game.pitching.length) issues.push("participants:missing");
  return issues;
}

export function importHistoricalSeason(zip: Uint8Array, season: HistoricalSeason,
  bridge: ReadonlyMap<string, string>, competition: CompetitionType = "regular"): HistoricalImport {
  const info = readHistoricalCsv(zip, season, "gameinfo").filter(row => competition === "regular"
    ? row.gametype === "regular" : POSTSEASON_GAME_TYPES.includes(row.gametype ?? ""));
  const sourceGames = new Map<string, HistoricalGame>();
  const sourceGameInfo = new Map<string, CsvRow>();
  for (const row of info) {
    const gid = row.gid;
    if (!gid || sourceGames.has(gid)) throw new Error(`Duplicate or missing Game ID: ${gid}`);
    if (row.season !== String(season)) throw new Error(`Wrong season in ${gid}`);
    const homeRuns = count(row.hruns), awayRuns = count(row.vruns);
    if (homeRuns === null || awayRuns === null) throw new Error(`Final score unavailable: ${gid}`);
    sourceGames.set(gid, {
      ...(competition === "postseason" ? { competitionType: "postseason" as const, postseasonRound: retrosheetRound(row.gametype!, row.hometeam!) } : {}),
      id: historicalId("game", gid), season, date: date(row.date ?? ""),
      homeTeamId: historicalTeamId(row.hometeam ?? ""),
      awayTeamId: historicalTeamId(row.visteam ?? ""), homeRuns, awayRuns,
      innings: count(row.innings), number: count(row.number) ?? 0,
      batting: [], pitching: [], validationIssues: [],
    });
    sourceGameInfo.set(gid, row);
  }
  const people = new Map<string, HistoricalPlayer>();
  const unresolved = new Set<string>();
  const sourcePeople = new Map<string, CsvRow[]>();
  for (const row of readHistoricalCsv(zip, season, "allplayers")) {
    const id = row.id ?? "";
    sourcePeople.set(id, [...(sourcePeople.get(id) ?? []), row]);
  }
  const player = (retro: string): HistoricalPlayer => {
    const chadwick = bridge.get(retro);
    if (!chadwick) unresolved.add(retro);
    // A missing bridge remains explicit; the Retrosheet key is still an identity key, not a name match.
    const id = historicalId("player", chadwick ? `chadwick:${chadwick}` : `retro:${retro}`);
    let existing = people.get(id);
    if (!existing) {
      const sources = sourcePeople.get(retro);
      if (!sources?.length) throw new Error(`No allplayers identity: ${retro}`);
      const source = sources[0]!;
      const positions = (["p", "c", "1b", "2b", "3b", "ss", "lf", "cf", "rf", "dh"] as const)
        .filter(position => sources.some(item => (count(item[`g_${position}`]) ?? 0) > 0))
        .map(position => position.toUpperCase());
      existing = { id, name: `${source.first} ${source.last}`.trim(),
        bats: source.bat || null, throws: source.throw || null, positions,
        seasons: [season], teamIds: [], chadwickMapped: Boolean(chadwick) };
      people.set(id, existing);
    }
    return existing;
  };
  for (const row of readHistoricalCsv(zip, season, "batting")) {
    const game = sourceGames.get(row.gid ?? "");
    if (!game) continue;
    const person = player(row.id ?? "");
    const fact = mapBatter(row, person.id);
    game.batting.push(fact);
    if (!person.teamIds.includes(fact.teamId)) person.teamIds.push(fact.teamId);
  }
  for (const row of readHistoricalCsv(zip, season, "pitching")) {
    const game = sourceGames.get(row.gid ?? "");
    if (!game) continue;
    const person = player(row.id ?? "");
    const fact = mapPitcher(row, person.id, sourceGameInfo.get(row.gid ?? "")!);
    game.pitching.push(fact);
    if (!person.teamIds.includes(fact.teamId)) person.teamIds.push(fact.teamId);
    if (!person.positions.includes("P")) person.positions.push("P");
  }
  const teamRows = new Map<string, CsvRow[]>();
  for (const row of readHistoricalCsv(zip, season, "teamstats")) {
    const gid = row.gid ?? "";
    if (!sourceGames.has(gid)) continue;
    const rows = teamRows.get(gid) ?? [];
    rows.push(row); teamRows.set(gid, rows);
  }
  for (const [gid, game] of sourceGames) {
    const teams = teamRows.get(gid) ?? [];
    if (competition === "postseason") {
      // gameinfo.innings is scheduled innings. Actual ending comes from the line score.
      const observed = teams.flatMap(row => Array.from({ length: 28 }, (_, i) => i + 1)
        .filter(n => row[`inn${n}`] !== undefined && row[`inn${n}`] !== ""));
      game.innings = observed.length ? Math.max(...observed) : null;
    }
    game.validationIssues = validateHistoricalGame(game, teams);
  }
  return { season, games: [...sourceGames.values()], players: [...people.values()],
    unresolvedRetrosheetIds: [...unresolved].sort(),
    validationIssueCount: [...sourceGames.values()].reduce((n, game) => n + game.validationIssues.length, 0) };
}
