import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { openDataClient, migrateData, type DataClient } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { buildNpbStandingsPayload, writeNpbPayloadAtomically } from "../src/data/npb-payload";
import { verifyNpbDatabase } from "../src/data/npb-verification";
import { parseNf3Standings, parseNf3TeamGames } from "../src/data/npb-nf3";
import { StaticStandingsRepository } from "../src/infrastructure/providers/static-standings-repository";
import type { NpbLatestStandings } from "../src/domain/standings";

const at = "2026-09-24T00:00:00.000Z";
const date = "2026-09-23";
const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/nf3/${name}.html`, import.meta.url)), "utf8");
const clients: DataClient[] = [];
afterEach(() => { for (const client of clients.splice(0)) client.close(); });

describe("NPB remote delivery contract", () => {
  it("publishes only complete standings and games and keeps the prior file on invalid output", async () => {
    const client = openDataClient("file::memory:");
    clients.push(client);
    await migrateData(client);
    const repository = new NpbRepository(client);
    await repository.syncTeamMappings(at);
    await repository.saveStandings(parseNf3Standings(fixture("standings"), date, at), false);
    await expect(buildNpbStandingsPayload(repository, at)).rejects.toThrow(/must be complete/);
    await repository.saveGames(parseNf3TeamGames(fixture("games"), "T", 2026, "https://nf3.sakura.ne.jp/", at), date, false);
    const payload = await buildNpbStandingsPayload(repository, at);
    expect(payload).toMatchObject({ throughDate: date, effectiveDate: date, generatedAt: at, sourceUpdatedAt: null });

    const directory = await mkdtemp(join(tmpdir(), "npb-payload-"));
    try {
      const path = join(directory, "data", "standings", "npb", "latest.json");
      await writeNpbPayloadAtomically(path, payload);
      const previous = await readFile(path, "utf8");
      await expect(writeNpbPayloadAtomically(path, { ...payload, standings: [] } as NpbLatestStandings)).rejects.toThrow();
      expect(await readFile(path, "utf8")).toBe(previous);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("reads remote JSON, caches the last valid snapshot, and survives a failed endpoint", async () => {
    const standings = parseNf3Standings(fixture("standings"), date, at);
    const payload: NpbLatestStandings = {
      schemaVersion: 1, league: "NPB", throughDate: date, effectiveDate: date,
      generatedAt: at, collectedAt: at, sourceUpdatedAt: null, sourceKey: "nf3", attribution: "nf3",
      teams: Object.fromEntries(standings.map((row) => [row.teamId, { name: row.teamId, short: row.teamId }])),
      standings,
    };
    const values = new Map<string, string>();
    const cache = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    let requested = "";
    const remote = new StaticStandingsRepository("./", async (input) => {
      requested = String(input);
      return new Response(JSON.stringify(payload), { status: 200 });
    }, "https://example.github.io/baseball/", cache);
    expect((await remote.findLatestNpb())?.standings).toHaveLength(12);
    expect(requested).toBe("https://example.github.io/baseball/data/standings/npb/latest.json");
    const offline = new StaticStandingsRepository("./", async () => { throw new Error("network unavailable"); },
      "https://example.github.io/baseball/", cache);
    expect((await offline.findLatestNpb())?.throughDate).toBe(date);
    await expect(new StaticStandingsRepository("./", async () => { throw new Error("network unavailable"); },
      "https://example.github.io/other/", cache).findLatestNpb()).rejects.toThrow(/network unavailable/);
  });

  it("refuses to report an incomplete remote import as verified", async () => {
    const client = openDataClient("file::memory:");
    clients.push(client);
    await migrateData(client);
    await expect(verifyNpbDatabase(client, date)).rejects.toThrow(/Incomplete/);
  });
});
