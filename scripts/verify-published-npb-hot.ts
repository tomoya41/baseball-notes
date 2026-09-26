import { npbHotPayloadSchema } from "../src/application/npb-hot-payload";
import { npbLatestStandingsSchema } from "../src/domain/standings";

const expectedDate = process.env.EXPECTED_EFFECTIVE_DATE;
const expectedGeneratedAt = process.env.EXPECTED_GENERATED_AT;
if (!expectedDate || !expectedGeneratedAt) throw new Error("Expected publish identity is required");
const base = "https://tomoya41.github.io/baseball-notes/data";
let lastError = "No response";
for (let attempt = 0; attempt < 12; attempt++) {
  try {
    const suffix = `?hotVerify=${encodeURIComponent(expectedGeneratedAt)}-${attempt}`;
    const [hotResponse, standingsResponse] = await Promise.all([
      fetch(`${base}/npb/hot/latest.json${suffix}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) }),
      fetch(`${base}/standings/npb/latest.json${suffix}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) }),
    ]);
    if (!hotResponse.ok || !standingsResponse.ok)
      throw new Error(`Public HTTP ${hotResponse.status}/${standingsResponse.status}`);
    const hot = npbHotPayloadSchema.parse(await hotResponse.json() as unknown);
    const standings = npbLatestStandingsSchema.parse(await standingsResponse.json() as unknown);
    if (hot.effectiveDate !== expectedDate || hot.generatedAt !== expectedGeneratedAt ||
      standings.effectiveDate !== expectedDate || Object.keys(standings.teams).length !== 12)
      throw new Error("Public payload has not reached the expected version");
    process.stdout.write(`${JSON.stringify({ httpStatus: 200, schemaVersion: hot.schemaVersion,
      effectiveDate: hot.effectiveDate, generatedAt: hot.generatedAt,
      readiness: hot.readiness.status, teams: Object.keys(standings.teams).length,
      entries: [hot.batting.length, hot.starters.length, hot.relievers.length] })}\n`);
    process.exit(0);
  } catch (error) { lastError = String(error); }
  await new Promise((resolve) => setTimeout(resolve, 10_000));
}
throw new Error(`Pages HOT verification failed: ${lastError}`);
