import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { gameManifestSchema, gameDateIndexSchema, shiftGameDate } from "../../src/domain/npb-game-index";
import { validateNpbPublication, validateNpbPublishedGameDates } from "../../src/application/npb-publication-consistency";
import { npbLatestStandingsSchema } from "../../src/domain/standings";
import { validateNpbRecentFamily } from "../../src/application/npb-recent-explorer";

export async function preserveNpbPublicStandings(root: string, request: typeof fetch = fetch) {
  const response = await request(`https://tomoya41.github.io/baseball-notes/data/standings/npb/latest.json?v=${Date.now()}`,
    { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw Error(`Standings preservation HTTP ${response.status}`);
  const body = await response.text(), payload = npbLatestStandingsSchema.parse(JSON.parse(body));
  const path = join(root, "data/standings/npb/latest.json");
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, body);
  return { effectiveDate: payload.effectiveDate, canonicalWrites: 0 };
}

export async function readNpbPublication(root: string) {
  const read = async (path: string) => JSON.parse(await readFile(join(root, "data/npb", path), "utf8")) as unknown;
  const [directory, catalog, capabilities, season, hot, teamSeason] = await Promise.all([
    read("players/latest.json"), read("catalog/latest.json"), read("capabilities.json"),
    read("season/2026/latest.json"), read("hot/latest.json"), read("teams/season/2026/latest.json"),
  ]);
  const milestones = await read("milestones/2026/latest.json").catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  const [gameManifest, gameRecent, records] = await Promise.all([
    read("games/manifest.json"), read("games/recent.json"), read("records/2026/latest.json"),
  ]);
  const standings = JSON.parse(await readFile(join(root, "data/standings/npb/latest.json"), "utf8")) as unknown;
  const publication = validateNpbPublication({ directory, catalog, capabilities, season, hot, teamSeason, milestones, gameManifest, gameRecent, records, standings });
  const recent = await Promise.all(([7, 14, 30] as const).map(async days => {
    const raw = await read(`explorer/recent/${days}.json`).catch((e: NodeJS.ErrnoException) => { if (e.code !== "ENOENT") throw e; return null; });
    return raw;
  }));
  const recentExplorer = validateNpbRecentFamily(recent, publication.directory, publication.season.season);
  for (const [i, p] of recent.entries()) if (p && recentExplorer[i]?.days !== [7, 14, 30][i]) throw Error("Recent file/period mismatch");
  const dates = [...new Set([publication.directory.effectiveDate, ...publication.gameRecent!.games.map(g => g.date)])];
  validateNpbPublishedGameDates(publication, await Promise.all(dates.map(date => read(`games/dates/${date}.json`))));
  return { ...publication, ...(recentExplorer.length ? { recentExplorer } : {}) };
}

export async function writeNpbProfileProjections(root: string, input: Parameters<typeof validateNpbPublication>[0]) {
  // Validate the whole candidate before overwriting any staged projection.
  const p = validateNpbPublication(input);
  for (const [path, value] of Object.entries({ "players/latest.json": p.directory,
    "catalog/latest.json": p.catalog, "capabilities.json": p.capabilities,
    [`milestones/${p.season.season}/latest.json`]: p.milestones })) {
    if (value === undefined) continue;
    const file = join(root, "data/npb", path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(value));
  }
  // File errors abort the job: only a fully validated Pages artifact may be uploaded.
  await readNpbPublication(root);
}

export async function npbPublicationHashes(root: string) {
  const p = await readNpbPublication(root);
  const paths = ["players/latest.json", "catalog/latest.json", "capabilities.json", "season/2026/latest.json",
    "hot/latest.json", "teams/season/2026/latest.json", "records/2026/latest.json", "games/manifest.json", "games/recent.json", "standings/npb/latest.json"];
  if (p.milestones) paths.push(`milestones/${p.season.season}/latest.json`);
  for (const recent of p.recentExplorer ?? []) paths.push(`explorer/recent/${recent.days}.json`);
  const manifest = gameManifestSchema.parse(p.gameManifest);
  for (let date = manifest.from; date <= manifest.to; date = shiftGameDate(date, 1)) {
    if (paths.length > 410) throw Error("NPB publication date range exceeds one season");
    paths.push(`games/dates/${date}.json`);
  }
  return Object.fromEntries(await Promise.all(paths.map(async path => {
    const body = await readFile(path === "standings/npb/latest.json" ? join(root, "data", path) : join(root, "data/npb", path));
    if (path.startsWith("games/dates/")) {
      const day = gameDateIndexSchema.parse(JSON.parse(body.toString("utf8")));
      if (path !== `games/dates/${day.date}.json` || day.generatedAt !== manifest.generatedAt)
        throw Error(`Staged Game generation mismatch: ${path}`);
    }
    return [path, createHash("sha256").update(body).digest("hex")];
  })));
}

export function verifyNpbPublicationHash(expected: unknown, path: string, body: Uint8Array) {
  if (!expected || typeof expected !== "object") throw Error("Expected staged NPB hashes required");
  const hash = (expected as Record<string, unknown>)[path];
  if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash) ||
    createHash("sha256").update(body).digest("hex") !== hash)
    throw Error(`Published NPB projection differs from staged artifact: ${path}`);
}
export function validNpbPublicationPaths(paths: readonly string[]) {
  return paths.length <= 410 && paths.every(path => /^(players\/latest|catalog\/latest|capabilities|season\/2026\/latest|hot\/latest|teams\/season\/2026\/latest|records\/2026\/latest|games\/manifest|games\/recent|milestones\/2026\/latest|standings\/npb\/latest|games\/dates\/\d{4}-\d{2}-\d{2}|explorer\/recent\/(7|14|30))\.json$/.test(path));
}
