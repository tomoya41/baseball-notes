import { createHash, randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { load } from "cheerio";
import type { DataClient } from "./database";
import { parseNf3Standings, parseNf3TeamGames, parseNf3BattingLogs, parseNf3PitchingLogs, normalizeNpbName, npbTeams, type NpbGame } from "./npb-nf3";
import { NpbRepository } from "./npb-repository";
import { retentionDays, cleanupExpired } from "./retention";
import { syncSourceRegistry } from "./standings-repository";
import { sourceRegistry } from "./source-registry";
import type { PlayerGameBatting, PlayerGamePitching } from "../domain/game-facts";
import type { NpbLogRow } from "./npb-nf3";

const ROOT = "https://nf3.sakura.ne.jp/";
const HEADERS = { "User-Agent": "BaseballDataAppCollector/0.1 (daily NPB public-data check)" };
export const curatedNpbPlayers = [
  { sourceId: "2026:T:f:1", name: "森下翔太", teamCode: "T", number: "1", kind: "batting" },
  { sourceId: "2026:T:f:5", name: "近本光司", teamCode: "T", number: "5", kind: "batting" },
  { sourceId: "2026:T:p:29", name: "髙橋遥人", teamCode: "T", number: "29", kind: "pitching" },
  { sourceId: "2026:T:p:13", name: "岩崎優", teamCode: "T", number: "13", kind: "pitching" },
] as const;

export function jstToday(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface NpbCollectorOptions {
  targetDate: string;
  lookbackDays?: number;
  dryRun?: boolean;
  rawRoot?: string;
  request?: (url: string) => Promise<string>;
  delayMs?: number;
  archivedCapture?: boolean;
  persistRawManifest?: boolean;
}
export interface NpbCollectorResult {
  targetDate: string; status: "succeeded" | "partial" | "dry-run";
  standings: number; games: number; batting: number; pitching: number;
  fetchedPages: number; errors: string[];
}

export async function runNpbCollector(client: DataClient, options: NpbCollectorOptions): Promise<NpbCollectorResult> {
  const { targetDate, dryRun = false, rawRoot = ".data/raw", delayMs = 750, persistRawManifest = true } = options;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || Number(targetDate.slice(0,4)) !== 2026)
    throw new Error("nf3 current-season collector supports verified 2026 pages only");
  if (process.env.NPB_NF3_ENABLED === "false" ||
    sourceRegistry.find((source) => source.key === "nf3")?.status !== "enabled-limited-public")
    throw new Error("nf3 provider is disabled in Source Registry");
  if (targetDate > addDays(jstToday(), -1)) throw new Error("Target date must be a completed JST day");
  if (targetDate !== addDays(jstToday(),-1) && !options.archivedCapture)
    throw new Error("Live standings have no as-of date; only yesterday can be collected without a dated archive");
  const lookbackDays = options.lookbackDays ?? 3;
  if (!Number.isInteger(lookbackDays) || lookbackDays < 0 || lookbackDays > 7) throw new Error("Invalid lookback");
  const startDate = addDays(targetDate,-lookbackDays);
  const endDate = addDays(targetDate,1);
  const months = [...new Set([startDate,targetDate,endDate].map((date) => Number(date.slice(5,7))))];
  if ([startDate,endDate].some((date) => !date.startsWith("2026-"))) throw new Error("Cross-season NPB import needs explicit year-specific source URLs");
  const collectedAt = new Date().toISOString();
  const runId = randomUUID();
  const repository = new NpbRepository(client);
  const errors: string[] = [];
  let fetchedPages = 0;
  let lastRequest = 0;
  const request = options.request ?? (async (url: string): Promise<string> => {
    const wait = delayMs - (Date.now() - lastRequest);
    if (wait > 0) await pause(wait);
    lastRequest = Date.now();
    let last: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > 500_000) throw new Error("Oversized nf3 response");
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch (error) {
        last = error;
        if (attempt === 0) await pause(1000);
      }
    }
    throw new Error(`Network failure for ${url}: ${String(last)}`);
  });
  async function get(path: string): Promise<string> {
    const url = new URL(path, ROOT).toString();
    const html = await request(url);
    fetchedPages++;
    if (!dryRun) {
      const relativeKey = `nf3/${targetDate}/${createHash("sha256").update(path).digest("hex")}.html.gz`;
      const fullPath = join(rawRoot, relativeKey);
      try {
        await mkdir(join(rawRoot,"nf3",targetDate), { recursive: true });
        await writeFile(fullPath, gzipSync(html));
        if (persistRawManifest) {
          const expires = new Date(Date.now() + retentionDays.rawResponse * 86_400_000).toISOString();
          await client.execute({ sql: `INSERT INTO raw_response_manifest VALUES (?,'nf3','raw-response',?,?)
            ON CONFLICT(object_key) DO UPDATE SET stored_at=excluded.stored_at,expires_at=excluded.expires_at`,
            args: [relativeKey,collectedAt,expires] });
        }
      } catch (error) { throw new Error(`Archive failure: ${String(error)}`, { cause: error }); }
    }
    return html;
  }
  if (!dryRun) {
    await syncSourceRegistry(client);
    await repository.syncTeamMappings(collectedAt);
    await client.execute({ sql: "INSERT INTO ingestion_runs (run_id,source_key,target_date,started_at,status) VALUES (?,'nf3',?,?,'running')", args: [runId,targetDate,collectedAt] });
  }
  let standingsCount = 0, gameCount = 0, battingCount = 0, pitchingCount = 0;
  let insertedCount = 0, updatedCount = 0, skippedCount = 0;
  let standingsRows: ReturnType<typeof parseNf3Standings> | null = null;
  try {
    // Standings source has no historical as-of URL. Daily execution before games begin is required.
    const standingsHtml = await get("Stats/Standing.htm");
    standingsRows = parseNf3Standings(standingsHtml,targetDate,collectedAt);
  } catch (error) {
    errors.push(`standings: ${String(error)}`);
    if (!dryRun) await repository.markStage(targetDate,"standings",String(error));
  }

  const candidates: NpbGame[] = [];
  let gamePages = 0;
  for (const team of npbTeams) for (const month of months) {
    const path = `php/stat_disp/stat_disp.php?y=0&leg=${team.group === "Central" ? 0 : 1}&mon=${month}&tm=${team.code}&vst=all`;
    try {
      const html = await get(path);
      const games = parseNf3TeamGames(html,team.code,2026,new URL(path,ROOT).toString(),collectedAt);
      candidates.push(...games.filter((game) => game.date >= startDate && game.date <= endDate));
      gamePages++;
    } catch (error) { errors.push(`games/${team.code}: ${String(error)}`); }
  }
  const gameMap = new Map<string,NpbGame>();
  for (const game of candidates) {
    const previous = gameMap.get(game.id);
    if (previous && (previous.status !== game.status || previous.homeScore !== game.homeScore || previous.awayScore !== game.awayScore)) {
      errors.push(`games/conflict: ${game.sourceRecordId}`);
      gameMap.delete(game.id);
      continue;
    }
    gameMap.set(game.id,game);
  }
  const games = [...gameMap.values()];
  // A postponed or still-scheduled row is not a final Game and must not block
  // the completed Games or the independently sourced standings snapshot.
  if (standingsRows) {
    try {
      if (!dryRun) {
        const changes = await repository.saveStandings(standingsRows,false);
        insertedCount += changes.inserted; updatedCount += changes.updated;
      }
      standingsCount = standingsRows.length;
    } catch (error) { errors.push(`standings/database: ${String(error)}`); }
  }
  if (gamePages > 0 && !errors.some((error) => error.startsWith("games/conflict"))) {
    try {
      if (!dryRun) {
        const changes = await repository.saveGames(games,targetDate,false,gamePages === npbTeams.length * months.length);
        insertedCount += changes.inserted; updatedCount += changes.updated; skippedCount += changes.skipped;
      }
      gameCount = games.length;
    } catch (error) { errors.push(`games/database: ${String(error)}`); }
  }
  if (!dryRun && (gamePages === 0 || errors.some((error) => error.startsWith("games/conflict"))))
    await repository.markStage(targetDate,"games","No reliable complete game batch");

  const batting: NpbLogRow<PlayerGameBatting>[] = [];
  const pitching: NpbLogRow<PlayerGamePitching>[] = [];
  let battingPages = 0, pitchingPages = 0;
  for (const player of curatedNpbPlayers) for (const month of months) {
    const kind = player.kind === "batting" ? "fpnum" : "pcnum";
    const path = `php/stat_disp/stat_disp.php?y=0&leg=0&${kind}=${player.number}&tm=${player.teamCode}&mon=${month}&vst=all`;
    try {
      const html = await get(path);
      const team = npbTeams.find((item) => item.code === player.teamCode)!;
      const url = new URL(path,ROOT).toString();
      const $ = load(html);
      const heading = $("span[style*='font-size:24px']").filter((_, element) => $(element).text().includes(`#${player.number}`)).first().text();
      if (!normalizeNpbName(heading).includes(normalizeNpbName(player.name)) || !heading.includes(`#${player.number}`))
        throw new Error(`Player identity mismatch: ${player.sourceId}`);
      const playerId = await repository.resolveCuratedPlayer(player.sourceId,player.name,url,team.id,collectedAt,dryRun);
      if (player.kind === "batting") { batting.push(...parseNf3BattingLogs(html,2026,player.teamCode,playerId,url,collectedAt).filter((row) => row.date >= startDate && row.date <= targetDate)); battingPages++; }
      else { pitching.push(...parseNf3PitchingLogs(html,2026,player.teamCode,playerId,url,collectedAt).filter((row) => row.date >= startDate && row.date <= targetDate)); pitchingPages++; }
    } catch (error) { errors.push(`${player.kind}/${player.sourceId}: ${String(error)}`); }
  }
  if (dryRun) {
    // Resolve against just-parsed games, without changing the database.
    for (const row of [...batting,...pitching]) {
      const matches = games.filter((game) => game.date === row.date &&
        ((game.homeTeamId === row.fact.teamId && game.awayTeamId === row.opponentTeamId) ||
         (game.awayTeamId === row.fact.teamId && game.homeTeamId === row.opponentTeamId)));
      if (matches.length !== 1) errors.push(`unresolved game: ${row.date} ${row.fact.playerId}`);
    }
    battingCount = batting.length; pitchingCount = pitching.length;
  } else {
    try {
      if (battingPages === 0) throw new Error("No batting player pages validated");
      const changes = await repository.saveBatting(batting,targetDate,false,true,"limited");
      battingCount = batting.length; insertedCount += changes.inserted; updatedCount += changes.updated;
    }
    catch (error) { errors.push(`batting/database: ${String(error)}`); await repository.markStage(targetDate,"batting",String(error)); }
    try {
      if (pitchingPages === 0) throw new Error("No pitching player pages validated");
      const changes = await repository.savePitching(pitching,targetDate,false,true,"limited");
      pitchingCount = pitching.length; insertedCount += changes.inserted; updatedCount += changes.updated;
    }
    catch (error) { errors.push(`pitching/database: ${String(error)}`); await repository.markStage(targetDate,"pitching",String(error)); }
  }
  const status = dryRun ? "dry-run" : "partial"; // A curated subset is never a complete league player log.
  if (!dryRun) {
    await client.execute({ sql: `UPDATE ingestion_runs SET finished_at=?,status=?,fetched_count=?,inserted_count=?,updated_count=?,skipped_count=?,error_count=?,error_summary=? WHERE run_id=?`,
      args: [new Date().toISOString(),status,fetchedPages,insertedCount,updatedCount,skippedCount,errors.length,errors.join(" | ").slice(0,500) || null,runId] });
    await cleanupExpired(client,rawRoot);
  }
  return { targetDate,status,standings:standingsCount,games:gameCount,batting:battingCount,pitching:pitchingCount,fetchedPages,errors };
}
