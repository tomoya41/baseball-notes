import { setTimeout } from "node:timers/promises";
import { npbPlayerDirectorySchema } from "../../src/domain/npb-player-directory";
import { validateNpbPublication, validateNpbPublishedGameDates } from "../../src/application/npb-publication-consistency";
import { validateNpbRecentFamily } from "../../src/application/npb-recent-explorer";
import { npbPublicationGamePaths, requiredNpbProjectionPaths, validNpbPublicationPaths, verifyNpbPublicationHash } from "./npb-publication";

const publicData = "https://tomoya41.github.io/baseball-notes/data/";
const directoryPath = "players/latest.json";
const milestonesPath = "milestones/2026/latest.json";
const recentPaths = ["explorer/recent/7.json", "explorer/recent/14.json", "explorer/recent/30.json"];
const batchSize = 8;

class PublicationPropagating extends Error {}

export async function verifyNpbPublicationReadback({
  expectedGeneration, hashes, request = fetch, wait = setTimeout,
}: {
  expectedGeneration: string;
  hashes: Record<string, string> | null;
  request?: typeof fetch;
  wait?: (ms: number) => Promise<unknown>;
}) {
  const paths = Object.keys(hashes ?? {});
  const stagedRecent = recentPaths.filter(path => hashes && Object.hasOwn(hashes, path));
  if (hashes && (!validNpbPublicationPaths(paths) || !Object.values(hashes).every(hash => /^[a-f0-9]{64}$/.test(hash))
    || requiredNpbProjectionPaths.some(path => !Object.hasOwn(hashes, path))
    || (stagedRecent.length !== 0 && stagedRecent.length !== recentPaths.length))) {
    throw Error("Invalid staged NPB projection hashes");
  }

  const url = (path: string) => `${publicData}${path === "standings/npb/latest.json" ? path : `npb/${path}`}`;
  async function read(path: string) {
    const fetchFile = () => request(`${url(path)}?verify=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    let response = await fetchFile();
    // A single temporary server error should not restart the whole date scan.
    if ([502, 503, 504].includes(response.status) && !response.headers.has("retry-after")) {
      await response.body?.cancel();
      await wait(2_000);
      response = await fetchFile();
    }
    if (response.status === 404 && !response.headers.has("retry-after")) {
      if (path === milestonesPath && (!hashes || !Object.hasOwn(hashes, path))) return undefined;
      throw new PublicationPropagating(`Published projection HTTP 404: ${path}`);
    }
    if (!response.ok) throw Error(`Published projection HTTP ${response.status}: ${path}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (hashes) {
      if (!Object.hasOwn(hashes, path)) throw Error(`Published NPB projection is absent from the staged list: ${path}`);
      try { verifyNpbPublicationHash(hashes, path, bytes); }
      catch (cause) { throw new PublicationPropagating(`Published NPB projection differs from staged artifact: ${path}`, { cause }); }
    }
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  }

  async function readBatch(pathsToRead: string[]) {
    const values: unknown[] = [];
    for (let i = 0; i < pathsToRead.length; i += batchSize) {
      // Drain every request in the batch before retrying a propagating generation.
      const batch = await Promise.allSettled(pathsToRead.slice(i, i + batchSize).map(read));
      const errors = batch.filter(result => result.status === "rejected");
      const failure = errors.find(result => !(result.reason instanceof PublicationPropagating)) ?? errors[0];
      if (failure) throw failure.reason;
      for (const result of batch) if (result.status === "fulfilled") values.push(result.value);
    }
    return values;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const directory = npbPlayerDirectorySchema.parse(await read(directoryPath));
      if (directory.generatedAt !== expectedGeneration) throw new PublicationPropagating("Published NPB Directory generation differs from the staged generation");
      const [catalog, capabilities, season, hot, teamSeason, milestones, gameManifest, gameRecent, records, standings] = await readBatch([
        "catalog/latest.json", "capabilities.json", "season/2026/latest.json", "hot/latest.json", "teams/season/2026/latest.json",
        milestonesPath, "games/manifest.json", "games/recent.json", "records/2026/latest.json", "standings/npb/latest.json",
      ]);
      const publication = validateNpbPublication({ directory, catalog, capabilities, season, hot, teamSeason, milestones, gameManifest, gameRecent, records, standings });
      if (stagedRecent.length) {
        const recent = validateNpbRecentFamily(await readBatch(stagedRecent), directory, publication.season.season);
        if (recent.some((p, i) => stagedRecent[i] !== `explorer/recent/${p.days}.json`)) throw Error("Published Recent file/period mismatch");
      }
      if (!publication.gameManifest || !publication.gameRecent) throw Error("Game surface required");
      const datedPaths = npbPublicationGamePaths(publication.gameManifest);
      if (hashes && (datedPaths.some(path => !Object.hasOwn(hashes, path))
        || paths.filter(path => path.startsWith("games/dates/")).length !== datedPaths.length)) {
        throw Error("Staged NPB game dates do not match the published manifest range");
      }
      const dates = [...new Set([directory.effectiveDate, ...publication.gameRecent.games.map(game => game.date)])];
      const samplePaths = dates.map(date => `games/dates/${date}.json`);
      validateNpbPublishedGameDates(publication, await readBatch(samplePaths));
      if (hashes) await readBatch(datedPaths.filter(path => !samplePaths.includes(path)));
      return { url: url(directoryPath), httpStatus: 200, effectiveDate: directory.effectiveDate, generatedAt: directory.generatedAt,
        players: directory.players.length, teams: directory.teams.length, verifiedFiles: hashes ? paths.length : null };
    } catch (error) {
      if (!(error instanceof PublicationPropagating)) throw error;
      lastError = error;
      if (attempt < 11) await wait(10_000);
    }
  }
  throw Error("Published NPB projection family did not become consistent after Pages deploy", { cause: lastError });
}
