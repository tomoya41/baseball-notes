import { npbPlayerDirectorySchema } from "../src/domain/npb-player-directory";

const expected = process.env.EXPECTED_GENERATED_AT;
if (!expected) throw new Error("EXPECTED_GENERATED_AT is required");
const url = "https://tomoya41.github.io/baseball-notes/data/npb/players/latest.json";
for (let attempt = 0; attempt < 12; attempt++) {
  const response = await fetch(`${url}?verify=${Date.now()}`, { cache: "no-store" });
  if (response.ok) {
    const payload = npbPlayerDirectorySchema.parse(await response.json() as unknown);
    if (payload.generatedAt === expected) {
      process.stdout.write(`${JSON.stringify({ url, httpStatus: response.status,
        effectiveDate: payload.effectiveDate, players: payload.players.length,
        teams: payload.teams.length })}\n`);
      process.exit(0);
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 10_000));
}
throw new Error("Published Player Directory did not update after Pages deploy");
