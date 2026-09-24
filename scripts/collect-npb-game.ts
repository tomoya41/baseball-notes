import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { migrateData, openDataClient } from "../src/data/database";
import { controlledGameTargets, runNpbGameProof, type ControlledGameTarget } from "../src/data/npb-game-collector";
import { NpbRepository } from "../src/data/npb-repository";

const args = new Set(process.argv.slice(2));
const targetArg = [...args].find((arg) => arg.startsWith("--target="));
const targetKey = targetArg?.slice("--target=".length) ?? "baseline";
if (!(targetKey in controlledGameTargets)) throw new Error(`Unknown controlled target: ${targetKey}`);
const target = controlledGameTargets[targetKey as ControlledGameTarget];
const date = target.date;
const gameId = target.id;
const verifyOnly = args.has("--verify-only");
const dryRun = args.has("--dry-run");
const offlineRaw = args.has("--offline-raw");
if (!verifyOnly && !offlineRaw && !args.has("--fetch")) throw new Error("Pass --fetch or --offline-raw");
if (offlineRaw && args.has("--fetch")) throw new Error("Select one source mode");
const url = process.env.TURSO_DATABASE_URL ?? "file:.data/baseball.db";
if (args.has("--require-remote") && (url.startsWith("file:") || !process.env.TURSO_AUTH_TOKEN))
  throw new Error("A remote Turso URL and token are required");
if (url.startsWith("file:")) await mkdir(".data", { recursive: true });
const client = openDataClient(url, process.env.TURSO_AUTH_TOKEN);
try {
  await migrateData(client);
  const repository = new NpbRepository(client);
  if (verifyOnly) {
    const report = await repository.findGameCompleteness(gameId);
    const batting = await repository.findBattingByGame(gameId);
    const pitching = await repository.findPitchingByGame(gameId);
    const teamTotals = [target.home, target.away].map((teamId) => {
      const hitters = batting.filter((fact) => fact.teamId === teamId);
      const pitchers = pitching.filter((fact) => fact.teamId === teamId);
      const sum = (values: readonly (number | null | undefined)[]) => values.reduce<number>((total, value) => total + (value ?? 0),0);
      return { teamId, batters: hitters.length, pitchers: pitchers.length,
        batting: { pa: sum(hitters.map((fact) => fact.pa)), ab: sum(hitters.map((fact) => fact.ab)),
          hits: sum(hitters.map((fact) => fact.hits)), doubles: sum(hitters.map((fact) => fact.doubles)),
          triples: sum(hitters.map((fact) => fact.triples)), homeRuns: sum(hitters.map((fact) => fact.homeRuns)),
          runs: sum(hitters.map((fact) => fact.runs)) },
        pitching: { outs: sum(pitchers.map((fact) => fact.inningsPitchedOuts)),
          battersFaced: sum(pitchers.map((fact) => fact.battersFaced)),
          hits: sum(pitchers.map((fact) => fact.hits)), runs: sum(pitchers.map((fact) => fact.runs)),
          earnedRuns: sum(pitchers.map((fact) => fact.earnedRuns)),
          pitches: sum(pitchers.map((fact) => fact.pitches)) } };
    });
    const result = { report, teamTotals, battingFacts: batting.length, pitchingFacts: pitching.length,
      distinctBatters: new Set(batting.map((fact) => fact.playerId)).size,
      distinctPitchers: new Set(pitching.map((fact) => fact.playerId)).size };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (report?.gameStatus !== "complete" || batting.length !== report.expectedBatters ||
      pitching.length !== report.expectedPitchers || result.distinctBatters !== batting.length ||
      result.distinctPitchers !== pitching.length) process.exitCode = 1;
  } else {
    const request = offlineRaw ? async (sourceUrl: string): Promise<string> => {
      const source = new URL(sourceUrl);
      const key = `${source.pathname.slice(1)}${source.search}`;
      const digest = createHash("sha256").update(key).digest("hex");
      return gunzipSync(await readFile(join(".data", "raw", "nf3", date, `${digest}.html.gz`))).toString("utf8");
    } : undefined;
    const result = await runNpbGameProof(client, { targetDate: date, gameId, dryRun, request,
      persistRawManifest: url.startsWith("file:") });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.report.gameStatus !== "complete") process.exitCode = 1;
  }
} finally { client.close(); }
