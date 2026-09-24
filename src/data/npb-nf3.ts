import { createHash } from "node:crypto";
import { load } from "cheerio";
import { standingSchema, type Standing } from "../domain/standings";
import { playerGameBattingSchema, playerGamePitchingSchema, type PlayerGameBatting, type PlayerGamePitching } from "../domain/game-facts";

export const npbTeams = [
  { code: "T", id: "npb:team:tigers", name: "阪神タイガース", short: "阪神", group: "Central" },
  { code: "G", id: "npb:team:giants", name: "読売ジャイアンツ", short: "巨人", group: "Central" },
  { code: "DB", id: "npb:team:baystars", name: "横浜DeNAベイスターズ", short: "DeNA", group: "Central" },
  { code: "D", id: "npb:team:dragons", name: "中日ドラゴンズ", short: "中日", group: "Central" },
  { code: "C", id: "npb:team:carp", name: "広島東洋カープ", short: "広島", group: "Central" },
  { code: "S", id: "npb:team:swallows", name: "東京ヤクルトスワローズ", short: "ヤクルト", group: "Central" },
  { code: "H", id: "npb:team:hawks", name: "福岡ソフトバンクホークス", short: "ソフトバンク", group: "Pacific" },
  { code: "F", id: "npb:team:fighters", name: "北海道日本ハムファイターズ", short: "日本ハム", group: "Pacific" },
  { code: "B", id: "npb:team:buffaloes", name: "オリックス・バファローズ", short: "オリックス", group: "Pacific" },
  { code: "E", id: "npb:team:eagles", name: "東北楽天ゴールデンイーグルス", short: "楽天", group: "Pacific" },
  { code: "L", id: "npb:team:lions", name: "埼玉西武ライオンズ", short: "西武", group: "Pacific" },
  { code: "M", id: "npb:team:marines", name: "千葉ロッテマリーンズ", short: "ロッテ", group: "Pacific" },
] as const;
export type NpbTeam = (typeof npbTeams)[number];

export function normalizeNpbName(value: string): string {
  return value.normalize("NFKC").replace(/[\s\u3000・･]/g, "").toLowerCase();
}

const teamAliases: Record<string, string> = {
  "deNA": "DB", "DeNA": "DB", "ＤｅＮＡ": "DB", "横浜": "DB", "ソフトバンク": "H",
  "日本ハム": "F", "オリックス": "B", "ヤクルト": "S", "ロッテ": "M", "阪神": "T",
  "巨人": "G", "中日": "D", "広島": "C", "楽天": "E", "西武": "L",
};
export function resolveNpbTeam(value: string): NpbTeam {
  const normalized = normalizeNpbName(value);
  const code = Object.entries(teamAliases).find(([name]) => normalizeNpbName(name) === normalized)?.[1];
  const team = npbTeams.find((item) => item.code === code || normalizeNpbName(item.name) === normalized || normalizeNpbName(item.short) === normalized);
  if (!team) throw new Error(`Unresolved NPB team: ${value}`);
  return team;
}

function integer(value: string, field: string): number {
  if (!/^\d+$/.test(value.trim())) throw new Error(`Invalid ${field}: ${value}`);
  return Number(value.trim());
}
function sourceDate(value: string, season: number): string {
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(value.trim());
  if (!match) throw new Error(`Invalid source date: ${value}`);
  const date = `${season}-${match[1]?.padStart(2, "0")}-${match[2]?.padStart(2, "0")}`;
  if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new Error(`Invalid date: ${date}`);
  return date;
}
function texts(html: string, selector: string): string[][] {
  const $ = load(html);
  return $(selector).toArray().map((row) => $(row).children("td,th").toArray().map((cell) => $(cell).text().trim()));
}

export function parseNf3Standings(html: string, date: string, collectedAt: string): Standing[] {
  const $ = load(html);
  const result: Standing[] = [];
  for (const group of ["Central", "Pacific"] as const) {
    const table = $("table.Base_P").filter((_, element) => $(element).find("caption").text().includes(`順位表 -${group}-`)).first();
    if (!table.length || !table.find("tr.Index2").first().text().includes("勝差") || !table.find("tr.Index2").first().text().includes("状況")) throw new Error(`nf3 standings schema changed: ${group}`);
    const rows = table.find("tr[onmouseover]");
    if (rows.length !== 6) throw new Error(`Invalid ${group} team count: ${rows.length}`);
    rows.each((rank, row) => {
      const cells = $(row).children("td,th").toArray().map((cell) => $(cell).text().trim());
      const team = resolveNpbTeam(cells[0] ?? "");
      if (team.group !== group || cells.length !== 22) throw new Error(`Invalid standings row: ${team.code}`);
      const behind = cells[6] === "-" ? 0 : Number(cells[6]);
      if (!Number.isFinite(behind) || behind < 0) throw new Error("Invalid games behind");
      const streakText = cells[20] ?? "";
      const streakMatch = /^(\d+)連(勝|敗)$/.exec(streakText);
      const streak = streakText === "-" ? 0 : streakMatch ? Number(streakMatch[1]) * (streakMatch[2] === "勝" ? 1 : -1) : NaN;
      if (!Number.isInteger(streak)) throw new Error(`Invalid streak: ${streakText}`);
      const wins = integer(cells[2] ?? "", "wins");
      const losses = integer(cells[3] ?? "", "losses");
      const pct = Number(cells[5]);
      if (!Number.isFinite(pct) || Math.abs(pct - (wins + losses ? wins / (wins + losses) : 0)) > 0.0015)
        throw new Error(`Invalid winning percentage: ${team.code}`);
      result.push(standingSchema.parse({ date, season: Number(date.slice(0, 4)), league: "NPB", competitionGroup: group,
        teamId: team.id, rank: rank + 1, gamesPlayed: integer(cells[1] ?? "", "games"), wins,
        losses, ties: integer(cells[4] ?? "", "ties"), pct,
        gamesBehindLeader: behind, streak, sourceKey: "nf3", collectedAt, calculatedAt: collectedAt }));
    });
  }
  if (result.length !== 12 || new Set(result.map((row) => row.teamId)).size !== 12) throw new Error("Duplicate or missing NPB teams");
  for (const group of ["Central", "Pacific"]) {
    const rows = result.filter((row) => row.competitionGroup === group);
    if (rows[0]?.gamesBehindLeader !== 0 || rows.some((row) => row.gamesBehindLeader < 0)) throw new Error("Invalid games-behind leader");
  }
  return result;
}

export interface NpbGame {
  id: string; season: number; date: string; homeTeamId: string; awayTeamId: string; gameNumber: number;
  venue: string | null; scheduledTime: string | null;
  status: "scheduled" | "final" | "postponed" | "canceled" | "suspended" | "unknown";
  homeScore: number | null; awayScore: number | null;
  sourceKey: "nf3"; sourceRecordId: string; sourceUrl: string; collectedAt: string;
}

export function parseNf3TeamGames(html: string, teamCode: string, season: number, sourceUrl: string, collectedAt: string): NpbGame[] {
  const $ = load(html);
  const team = npbTeams.find((item) => item.code === teamCode);
  if (!team) throw new Error(`Unknown team code: ${teamCode}`);
  const table = $("table.Base").filter((_, element) => $(element).find("caption").text().includes("試合日程・先発")).first();
  if (!table.length || !table.find("tr.Index2").first().text().includes("スコア")) throw new Error("nf3 games schema changed");
  const seen = new Map<string, number>();
  const games: NpbGame[] = [];
  for (const cells of texts($.html(table), "tr[onmouseover]")) {
    if (cells.length < 19) throw new Error("nf3 game column count changed");
    const date = sourceDate(cells[0] ?? "", season);
    const opponent = resolveNpbTeam(cells[2] ?? "");
    const hv = cells[4];
    if (hv !== "Ｈ" && hv !== "Ｖ" && hv !== "H" && hv !== "V") throw new Error(`Unknown H/V: ${hv}`);
    const home = hv === "Ｈ" || hv === "H" ? team : opponent;
    const away = home === team ? opponent : team;
    const identity = `${date}:${home.code}:${away.code}`;
    const number = (seen.get(identity) ?? 0) + 1;
    seen.set(identity, number);
    const score = /^(\d+)-(\d+)$/.exec(cells[18] ?? "");
    const status = score ? "final" : cells.join(" ").includes("中止") ? "postponed" : "scheduled";
    const ownScore = score ? Number(score[1]) : null;
    const opponentScore = score ? Number(score[2]) : null;
    const sourceRecordId = `${identity}:${number}`;
    const canonicalKey = [date, home.id, away.id, number].join(":");
    const gameId = `npb:game:${createHash("sha256").update(canonicalKey).digest("hex").slice(0, 20)}`;
    games.push({ id: gameId, season, date, homeTeamId: home.id, awayTeamId: away.id,
      gameNumber: number, venue: cells[3] || null, scheduledTime: /^\d{1,2}:\d{2}$/.test(cells[5] ?? "") ? cells[5]! : null,
      status, homeScore: home === team ? ownScore : opponentScore, awayScore: away === team ? ownScore : opponentScore,
      sourceKey: "nf3", sourceRecordId, sourceUrl, collectedAt });
  }
  if (games.length < 1) throw new Error("nf3 games page has no games");
  return games;
}

export function parseInningsOuts(value: string): number {
  const match = /^(\d+)(?:\.([012]))?$/.exec(value.trim());
  if (!match) throw new Error(`Invalid baseball innings: ${value}`);
  return Number(match[1]) * 3 + Number(match[2] ?? 0);
}

export interface NpbLogRow<T> { date: string; opponentTeamId: string; scheduledTime: string | null; fact: T }

export function parseNf3BattingLogs(html: string, season: number, teamCode: string, playerId: string, sourceUrl: string, collectedAt: string): NpbLogRow<PlayerGameBatting>[] {
  const $ = load(html);
  const table = $("table.Base").filter((_, element) => $(element).find("caption").text().includes("全打席成績")).first();
  if (!table.length || !table.find("tr.Index").first().text().includes("打数")) throw new Error("nf3 batting schema changed");
  const team = npbTeams.find((item) => item.code === teamCode);
  if (!team) throw new Error("Unknown batting team");
  return texts($.html(table), "tr[onmouseover]").map((cells) => {
    if (cells.length < 26) throw new Error("nf3 batting column count changed");
    const date = sourceDate(cells[0] ?? "", season);
    const opponent = resolveNpbTeam(cells[3] ?? "");
    const detail = cells[25] ?? "";
    const walks = (detail.match(/四球/g) ?? []).length;
    const hbp = (detail.match(/死球/g) ?? []).length;
    const combined = integer(cells[16] ?? "", "walks+hbp");
    const separated = walks + hbp === combined;
    const battingOrder = /^(\d)番$/.exec(cells[5] ?? "");
    const fact = playerGameBattingSchema.parse({ gameId: "unresolved", playerId, teamId: team.id,
      opponentTeamId: opponent.id, battingOrder: battingOrder ? Number(battingOrder[1]) : null,
      pa: null, ab: integer(cells[10] ?? "", "AB"), hits: integer(cells[12] ?? "", "H"),
      doubles: null, triples: null, homeRuns: integer(cells[13] ?? "", "HR"),
      rbi: integer(cells[14] ?? "", "RBI"), walks: separated ? walks : null, strikeouts: integer(cells[15] ?? "", "SO"), hbp: separated ? hbp : null,
      stolenBases: integer(cells[17] ?? "", "SB"), caughtStealing: integer(cells[18] ?? "", "CS"),
      runs: integer(cells[11] ?? "", "R"), starter: battingOrder !== null, sourceUrl,
      sourceKey: "nf3", sourceRecordId: `${date}:${teamCode}:${playerId}`, collectedAt });
    return { date, opponentTeamId: opponent.id, scheduledTime: cells[2] || null, fact };
  });
}

export function parseNf3PitchingLogs(html: string, season: number, teamCode: string, playerId: string, sourceUrl: string, collectedAt: string): NpbLogRow<PlayerGamePitching>[] {
  const $ = load(html);
  const table = $("table.Base").filter((_, element) => $(element).find("caption").text().includes("全投球成績")).first();
  if (!table.length || !table.find("tr.Index").first().text().includes("投球")) throw new Error("nf3 pitching schema changed");
  const team = npbTeams.find((item) => item.code === teamCode);
  if (!team) throw new Error("Unknown pitching team");
  return texts($.html(table), "tr[onmouseover]").map((cells) => {
    if (cells.length < 28) throw new Error("nf3 pitching column count changed");
    const date = sourceDate(cells[0] ?? "", season);
    const opponent = resolveNpbTeam(cells[3] ?? "");
    const role = cells[5] === "先発" ? "starter" : cells[5] === "救援" ? "reliever" : null;
    if (!role) throw new Error(`Unknown nf3 pitcher role marker: ${cells[5]}`);
    const marker = cells[8] ?? "";
    const decision = marker === "○" ? "win" : marker === "●" ? "loss" : ["Ｓ","S"].includes(marker) ? "save" :
      ["Ｈ","H"].includes(marker) ? "hold" : ["","-"].includes(marker) ? "none" : null;
    if (!decision) throw new Error(`Unknown nf3 pitcher result marker: ${marker}`);
    const fact = playerGamePitchingSchema.parse({ id: `npb:pitching:${date}:${teamCode}:${playerId}`,
      gameId: "unresolved", playerId, teamId: team.id, opponentTeamId: opponent.id,
      role, appearanceOrder: null, inningsPitchedOuts: parseInningsOuts(cells[9] ?? ""),
      battersFaced: integer(cells[10] ?? "", "BF"), pitches: integer(cells[11] ?? "", "pitches"),
      hits: integer(cells[12] ?? "", "H"), homeRuns: integer(cells[13] ?? "", "HR"),
      walks: null, strikeouts: integer(cells[14] ?? "", "SO"), runs: integer(cells[16] ?? "", "runs"),
      earnedRuns: integer(cells[17] ?? "", "ER"), catcherId: null, starter: role === "starter",
      decision,
      sourceUrl,
      sourceKey: "nf3", sourceRecordId: `${date}:${teamCode}:${playerId}`, collectedAt });
    return { date, opponentTeamId: opponent.id, scheduledTime: cells[2] || null, fact };
  });
}
