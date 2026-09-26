import type { InStatement } from "@libsql/client";
import { join } from "node:path";
import { openDataClient, type DataClient } from "../src/data/database";
import { NpbPlayerDirectoryRepository } from "../src/data/npb-player-directory";
import { writeNpbPlayerDirectoryAtomically } from "../src/data/npb-player-directory-payload";

function option(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}
const url = process.env.TURSO_DATABASE_URL ?? "file:.data/baseball.db";
if (process.argv.includes("--require-remote") && url.startsWith("file:"))
  throw new Error("Remote Player Directory generation requires a configured remote DB");
const source = openDataClient(url, process.env.TURSO_AUTH_TOKEN);
let queryCount = 0;
const client = new Proxy(source, { get(target, property) {
  if (property === "execute") return async (statement: string | InStatement) => {
    const sql = typeof statement === "string" ? statement : statement.sql;
    if (!/^\s*SELECT\b/i.test(sql)) throw new Error("Directory generation attempted non-read SQL");
    queryCount++;
    return target.execute(statement);
  };
  const value: unknown = Reflect.get(target, property);
  return typeof value === "function" ? value.bind(target) : value;
} }) as DataClient;

try {
  const started = performance.now();
  const directory = await new NpbPlayerDirectoryRepository(client).read();
  const readMs = Math.round(performance.now() - started);
  const path = join(option("--payload-root") ?? ".data/publish", "data", "npb", "players", "latest.json");
  const bytes = await writeNpbPlayerDirectoryAtomically(path, directory);
  process.stdout.write(`${JSON.stringify({ effectiveDate: directory.effectiveDate,
    playerCount: directory.players.length, teamCount: directory.teams.length,
    battingPlayers: directory.players.filter((player) => player.battingAvailable).length,
    pitchingPlayers: directory.players.filter((player) => player.pitchingAvailable).length,
    noFactPlayers: directory.players.filter((player) => !player.battingAvailable && !player.pitchingAvailable).length,
    bytes, queryCount, readMs, totalMs: Math.round(performance.now() - started) })}\n`);
} finally { source.close(); }
