import { readFile } from "node:fs/promises";
import { npbHotPayloadSchema } from "../src/application/npb-hot-payload";
import { npbLatestStandingsSchema } from "../src/domain/standings";

const root = process.argv.find((arg) => arg.startsWith("--root="))?.slice(7) ?? ".data/publish";
const standings = npbLatestStandingsSchema.parse(JSON.parse(await readFile(
  `${root}/data/standings/npb/latest.json`, "utf8")) as unknown);
const hot = npbHotPayloadSchema.parse(JSON.parse(await readFile(
  `${root}/data/npb/hot/latest.json`, "utf8")) as unknown);
if (standings.effectiveDate !== hot.effectiveDate)
  throw new Error("HOT and standings payload effective dates differ");
process.stdout.write(`${JSON.stringify({ effectiveDate: hot.effectiveDate, generatedAt: hot.generatedAt,
  readiness: hot.readiness.status, standingsTeams: Object.keys(standings.teams).length,
  entries: [hot.batting.length, hot.starters.length, hot.relievers.length] })}\n`);
