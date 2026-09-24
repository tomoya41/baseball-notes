import { load } from "cheerio";
import { playerGameBattingSchema, playerGamePitchingSchema, type PlayerGameBatting, type PlayerGamePitching } from "../domain/game-facts";
import { normalizeNpbName, parseNf3BattingLogs, parseNf3PitchingLogs, type NpbLogRow } from "./npb-nf3";

export interface Nf3Participant { number: string; name: string; profileUrl: string }
export interface Nf3Starter extends Nf3Participant { battingOrder: number }
export interface Nf3BattingParticipant extends Nf3Participant { battingOrder: number; started: boolean }

const ROOT = "https://nf3.sakura.ne.jp/";
const dayLabel = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
function profile(link: string | undefined, teamCode: string): string {
  if (!link || !new RegExp(`^\\./(?:Central|Pacific)/${teamCode}/[fp]/\\d+_stat\\.htm$`).test(link))
    throw new Error(`Unexpected nf3 player profile: ${link}`);
  return new URL(link.slice(2), ROOT).toString();
}

export function parseNf3StartingLineup(html: string, date: string, teamCode: string): Nf3Starter[] {
  const $ = load(html);
  const table = $("table.Base").filter((_, element) => $(element).find("caption").text().includes("スターティングメンバー一覧")).first();
  if (!table.length || !table.find("tr.Index").first().text().includes("９番")) throw new Error("nf3 lineup schema changed");
  const rows = table.find("tr[onmouseover]").toArray().filter((row) => $(row).children("td").first().text().trim() === dayLabel(date));
  if (rows.length !== 1) throw new Error(`Missing/ambiguous nf3 lineup: ${teamCode} ${date}`);
  const cells = $(rows[0]).children("td");
  if (cells.length < 16) throw new Error("nf3 lineup column count changed");
  const starters = Array.from({ length: 9 }, (_, index) => {
    const cell = cells.eq(index + 5);
    const href = cell.find("a").attr("href");
    const number = /\/([0-9]+)_stat\.htm$/.exec(href ?? "")?.[1];
    if (!number) throw new Error(`Missing lineup player ID: ${teamCode} ${index + 1}`);
    return { number, name: cell.text().trim(), profileUrl: profile(href, teamCode), battingOrder: index + 1 };
  });
  if (new Set(starters.map((item) => item.number)).size !== 9) throw new Error("Duplicate nf3 lineup number");
  return starters;
}

export function parseNf3BattingRoster(html: string, teamCode: string): Nf3Participant[] {
  const $ = load(html);
  const table = $("table.Base").filter((_, element) => $(element).find("caption").text().includes("打撃成績一覧")).first();
  if (!table.length || !table.find("tr").first().text().includes("打席")) throw new Error("nf3 batting roster schema changed");
  const participants = table.find("tr[onmouseover]").toArray().map((row) => {
    const cells = $(row).children("td");
    const number = cells.eq(0).text().trim();
    const name = cells.eq(1).text().trim();
    const href = cells.eq(1).find("a").attr("href");
    if (!/^\d+$/.test(number) || !name) throw new Error("Invalid nf3 batting roster identity");
    return { number, name, profileUrl: profile(href, teamCode) };
  });
  if (participants.length < 9 || new Set(participants.map((item) => item.number)).size !== participants.length)
    throw new Error("Incomplete/duplicate nf3 batting roster");
  return participants;
}

export function parseNf3PitchUsage(html: string, date: string, teamCode: string): Nf3Participant[] {
  const $ = load(html);
  const table = $("table").filter((_, element) => $(element).find("caption").text().includes("直近2週間の投球数リスト")).first();
  if (!table.length) throw new Error("nf3 pitch usage schema changed");
  const header = table.find("tr").first().children("td,th").toArray().map((cell) => $(cell).text().trim());
  const dateIndex = header.indexOf(dayLabel(date));
  if (dateIndex < 4 || header.lastIndexOf(dayLabel(date)) !== dateIndex) throw new Error(`nf3 pitch usage date missing: ${date}`);
  const pitchers = table.find("tr[onmouseover]").toArray().flatMap((row) => {
    const cells = $(row).children("td,th");
    if (cells.length !== header.length) throw new Error("nf3 pitch usage column count changed");
    const usage = cells.eq(dateIndex).text().trim();
    if (!usage) return [];
    if (!/^\d+/.test(usage)) throw new Error(`Invalid nf3 pitch usage: ${usage}`);
    const href = cells.eq(1).find("a").attr("href");
    const number = cells.eq(0).text().trim();
    const name = cells.eq(1).text().trim();
    if (!/^\d+$/.test(number) || !name) throw new Error("Invalid nf3 pitcher identity");
    return [{ number, name, profileUrl: profile(href, teamCode) }];
  });
  if (pitchers.length < 1 || new Set(pitchers.map((item) => item.number)).size !== pitchers.length)
    throw new Error("Incomplete/duplicate nf3 pitch usage");
  return pitchers;
}

function gameCells(html: string, date: string, caption: string): string[] {
  const $ = load(html);
  const table = $("table.Base").filter((_, element) => $(element).find("caption").text().includes(caption)).first();
  if (!table.length) throw new Error(`nf3 ${caption} schema changed`);
  const rows = table.find("tr[onmouseover]").toArray().filter((row) => $(row).children("td").first().text().trim() === dayLabel(date));
  if (rows.length !== 1) throw new Error(`Missing/ambiguous nf3 ${caption} row: ${date}`);
  return $(rows[0]).children("td").toArray().map((cell) => $(cell).text().trim());
}

export interface Nf3GameBattingRow { row: NpbLogRow<PlayerGameBatting>; substitutions: string[]; detail: string[] }
export function parseNf3GameBattingRow(html: string, date: string, teamCode: string, playerId: string,
  sourceId: string, sourceUrl: string, at: string): Nf3GameBattingRow {
  const rows = parseNf3BattingLogs(html,2026,teamCode,playerId,sourceUrl,at).filter((row) => row.date === date);
  if (rows.length !== 1) throw new Error(`Missing/ambiguous batting log: ${sourceId} ${date}`);
  const cells = gameCells(html,date,"全打席成績");
  if (cells.length < 26) throw new Error("nf3 batting game column count changed");
  const detail = (cells[25] ?? "").split(/\s+/).filter(Boolean);
  const ab = rows[0]!.fact.ab!;
  const walks = rows[0]!.fact.walks;
  const hbp = rows[0]!.fact.hbp;
  const sacrificeHits = detail.filter((token) => /犠打|犠バント/.test(token)).length;
  const sacrificeFlies = detail.filter((token) => /犠飛/.test(token)).length;
  const expectedPa = walks === null || hbp === null ? null : ab + walks + hbp + sacrificeHits + sacrificeFlies;
  const pa = expectedPa !== null && detail.length === expectedPa ? expectedPa : null;
  const hitsInDetail = detail.filter((token) => /安|２|３|本\(/.test(token)).length;
  const extraBaseVerified = hitsInDetail === rows[0]!.fact.hits;
  const doubles = extraBaseVerified ? detail.filter((token) => /２/.test(token)).length : null;
  const triples = extraBaseVerified ? detail.filter((token) => /３/.test(token)).length : null;
  const fact = playerGameBattingSchema.parse({ ...rows[0]!.fact, sourceRecordId: `${date}:${sourceId}`,
    pa, doubles, triples, sacrificeHits, sacrificeFlies });
  const substitutions = [cells[7],cells[9]].filter((value): value is string => !!value && value !== "-");
  return { row: { ...rows[0]!, fact }, substitutions, detail };
}

export function parseNf3GamePitchingRow(html: string, date: string, teamCode: string, playerId: string,
  sourceId: string, sourceUrl: string, at: string): NpbLogRow<PlayerGamePitching> {
  const rows = parseNf3PitchingLogs(html,2026,teamCode,playerId,sourceUrl,at).filter((row) => row.date === date);
  if (rows.length !== 1) throw new Error(`Missing/ambiguous pitching log: ${sourceId} ${date}`);
  const cells = gameCells(html,date,"全投球成績");
  if (cells.length < 28 || !/^\d+$/.test(cells[15] ?? "")) throw new Error("nf3 pitching walks+HBP column changed");
  return { ...rows[0]!, fact: playerGamePitchingSchema.parse({ ...rows[0]!.fact,
    sourceRecordId: `${date}:${sourceId}`, walks: null, hitBatters: null, walksAndHitBatters: Number(cells[15]) }) };
}

export function findRosterPlayer(roster: readonly Nf3Participant[], name: string): Nf3Participant {
  const matches = roster.filter((player) => normalizeNpbName(player.name) === normalizeNpbName(name));
  if (matches.length !== 1) throw new Error(`Unresolved/ambiguous nf3 player: ${name}`);
  return matches[0]!;
}
