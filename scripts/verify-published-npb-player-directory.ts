import { npbPlayerDirectorySchema } from "../src/domain/npb-player-directory";
import { validateNpbPublication, validateNpbPublishedGameDates } from "../src/application/npb-publication-consistency";
import { verifyNpbPublicationHash, validNpbPublicationPaths } from "./lib/npb-publication";
import { validateNpbRecentFamily } from "../src/application/npb-recent-explorer";

const expected = process.env.EXPECTED_GENERATED_AT;
const hashes = process.env.EXPECTED_PROJECTION_HASHES ? JSON.parse(process.env.EXPECTED_PROJECTION_HASHES) as Record<string, string> : null;
if (process.env.GITHUB_ACTIONS === "true" && !hashes) throw Error("Staged projection hashes required for deployment verification");
if (hashes && !validNpbPublicationPaths(Object.keys(hashes)))
  throw Error("Invalid staged publication paths");
if (!expected) throw new Error("EXPECTED_GENERATED_AT is required");
const url = "https://tomoya41.github.io/baseball-notes/data/npb/players/latest.json";
let lastError: unknown;
for (let attempt = 0; attempt < 12; attempt++) {
  try {
  const response = await fetch(`${url}?verify=${Date.now()}`, { cache: "no-store" });
  if (response.ok) {
    const directoryBody = new Uint8Array(await response.arrayBuffer());
    if (hashes) verifyNpbPublicationHash(hashes, "players/latest.json", directoryBody);
    const payload = npbPlayerDirectorySchema.parse(JSON.parse(Buffer.from(directoryBody).toString("utf8")) as unknown);
    if (payload.generatedAt === expected) {
      const base = "https://tomoya41.github.io/baseball-notes/data/npb/";
      const read = async (path: string, optional = false) => {
        const resource = path === "standings/npb/latest.json" ? `https://tomoya41.github.io/baseball-notes/data/${path}` : `${base}${path}`;
        const r = await fetch(`${resource}?verify=${Date.now()}`, { cache: "no-store" });
        if (optional && r.status === 404) return undefined;
        if (!r.ok) throw Error(`Published projection HTTP ${r.status}: ${path}`);
        const body = new Uint8Array(await r.arrayBuffer());
        if (hashes) verifyNpbPublicationHash(hashes, path, body);
        return JSON.parse(Buffer.from(body).toString("utf8")) as unknown;
      };
      const [catalog, capabilities, season, hot, teamSeason, milestones, gameManifest, gameRecent, records, standings] = await Promise.all([
        read("catalog/latest.json"), read("capabilities.json"), read("season/2026/latest.json"),
        read("hot/latest.json"), read("teams/season/2026/latest.json"), read("milestones/2026/latest.json", true),
        read("games/manifest.json"), read("games/recent.json"), read("records/2026/latest.json"),
        read("standings/npb/latest.json"),
      ]);
      const publication = validateNpbPublication({ directory: payload, catalog, capabilities, season, hot, teamSeason, milestones, gameManifest, gameRecent, records, standings });
      const recentPaths = Object.keys(hashes ?? {}).filter(p => p.startsWith("explorer/recent/"));
      if (recentPaths.length) {
        const recent = validateNpbRecentFamily(await Promise.all(recentPaths.map(p => read(p))), payload, publication.season.season);
        if (recent.some((p, i) => recentPaths[i] !== `explorer/recent/${p.days}.json`)) throw Error("Published Recent file/period mismatch");
      }
      const dates = [...new Set([payload.effectiveDate, ...publication.gameRecent!.games.map(g => g.date)])];
      validateNpbPublishedGameDates(publication, await Promise.all(dates.map(date => read(`games/dates/${date}.json`))));
      // Check all remaining dated payloads against the exact staged artifact with bounded CDN requests.
      if (hashes) {
        const paths = Object.keys(hashes).filter(path => path.startsWith("games/dates/") && !dates.some(date => path === `games/dates/${date}.json`));
        for (let i = 0; i < paths.length; i += 8) await Promise.all(paths.slice(i, i + 8).map(path => read(path)));
      }
      process.stdout.write(`${JSON.stringify({ url, httpStatus: response.status,
        effectiveDate: payload.effectiveDate, players: payload.players.length,
        teams: payload.teams.length })}\n`);
      process.exit(0);
    }
  }
  } catch (error) { lastError = error; }
  // CDN propagation can temporarily expose different generations; never accept that as success.
  await new Promise((resolve) => setTimeout(resolve, 10_000));
}
throw new Error("Published NPB projection family did not become consistent after Pages deploy", { cause: lastError });
