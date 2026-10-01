import { npbPlayerDirectorySchema } from "../src/domain/npb-player-directory";
import { validateNpbPublication } from "../src/application/npb-publication-consistency";

const expected = process.env.EXPECTED_GENERATED_AT;
if (!expected) throw new Error("EXPECTED_GENERATED_AT is required");
const url = "https://tomoya41.github.io/baseball-notes/data/npb/players/latest.json";
let lastError: unknown;
for (let attempt = 0; attempt < 12; attempt++) {
  try {
  const response = await fetch(`${url}?verify=${Date.now()}`, { cache: "no-store" });
  if (response.ok) {
    const payload = npbPlayerDirectorySchema.parse(await response.json() as unknown);
    if (payload.generatedAt === expected) {
      const base = "https://tomoya41.github.io/baseball-notes/data/npb/";
      const read = async (path: string, optional = false) => {
        const r = await fetch(`${base}${path}?verify=${Date.now()}`, { cache: "no-store" });
        if (optional && r.status === 404) return undefined;
        if (!r.ok) throw Error(`Published projection HTTP ${r.status}: ${path}`);
        return r.json() as Promise<unknown>;
      };
      const [catalog, capabilities, season, hot, teamSeason, milestones] = await Promise.all([
        read("catalog/latest.json"), read("capabilities.json"), read("season/2026/latest.json"),
        read("hot/latest.json"), read("teams/season/2026/latest.json"), read("milestones/2026/latest.json", true),
      ]);
      validateNpbPublication({ directory: payload, catalog, capabilities, season, hot, teamSeason, milestones });
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
