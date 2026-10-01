import { competitionTypeSchema } from "../src/domain/competition";
import { stageHistoricalCompetition } from "../src/data/mlb-publication-staging";
const args = process.argv.slice(2);
function required(key: string) {
  const value = args[args.indexOf(key) + 1];
  if (!args.includes(key) || !value) throw new Error(`Missing ${key}`);
  return value;
}
const competition = competitionTypeSchema.parse(required("--competition"));
await stageHistoricalCompetition(required("--source"), required("--target"), competition);
console.log(JSON.stringify({ replacedCompetition: competition, stalePathsRemoved: true, otherCompetitionPreserved: true }));
