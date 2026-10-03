import { readFile, readdir, mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import { buildHistoricalTeamHub } from "../src/data/mlb-team-product";
import type { HistoricalGame } from "../src/data/mlb-historical";
export async function generateHistoricalTeamHubs(root: string) {
  const started = performance.now(); let files = 0, bytes = 0;
  for (const scope of ["regular", "postseason"] as const) {
    const base = scope === "regular" ? root : join(root, "postseason"), prefix = scope === "regular" ? "" : "postseason/";
    try { await access(join(base, "manifest.json.gz")); } catch { continue; }
    const read = async <T>(path: string): Promise<T> => { const data: unknown = JSON.parse(gunzipSync(await readFile(join(base, `${path}.gz`))).toString()); if (!validStaticPayload(`${prefix}${path}`, data)) throw Error(`Invalid existing historical projection ${path}`); return data as T; };
    const manifest = await read<{ seasons: { season: number; coverage: "complete" | "partial" | "unavailable"; lastDate: string }[]; teams: { id: string }[] }>("manifest.json");
    const players = await read<{ players: { id: string; name: string }[] }>("players/index.json");
    const names = new Map(players.players.map(p => [p.id, p.name]));
    const games: HistoricalGame[] = [];
    for (const name of (await readdir(join(base, "games"))).sort()) { if (name.endsWith(".json.gz")) { const data = await read<{ game: HistoricalGame }>(`games/${name.slice(0, -3)}`); games.push(data.game); } }
    // Fail closed when the preserved archive does not match its own season coverage.
    for (const s of manifest.seasons) {
      const gameCount = games.filter(g => g.season === s.season).length;
      const source = await read<{ gameCount: number }>(`seasons/${s.season}.json`);
      if (gameCount !== source.gameCount) throw Error(`Historical Team game count mismatch ${scope}/${s.season}`);
      await mkdir(join(base, "chronology"), { recursive: true });
      const chronology = gzipSync(JSON.stringify({ schemaVersion: 1, league: "MLB", season: s.season, competitionType: scope, games: games.filter(g => g.season === s.season).map(g => ({ gameId: g.id, date: g.date, number: g.number })) }));
      await writeFile(join(base, "chronology", `${s.season}.json.gz`), chronology); files++; bytes += chronology.length;
      const dir = join(base, "teams", String(s.season)); await mkdir(dir, { recursive: true });
      for (const team of manifest.teams) {
        const hub = buildHistoricalTeamHub(games, names, { teamId: team.id, season: s.season, competitionType: scope, coverage: s.coverage, effectiveDate: s.lastDate });
        const payload = gzipSync(JSON.stringify(hub), { mtime: 0 } as Parameters<typeof gzipSync>[1]);
        await writeFile(join(dir, `${team.id.replaceAll(":", "_")}.json.gz`), payload); files++; bytes += payload.length;
      }
    }
  }
  console.log(JSON.stringify({ teamHubFiles: files, compressedBytes: bytes, elapsedMs: Math.round(performance.now() - started), canonicalWrites: 0, sourceRequests: 0 }));
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("generate-historical-team-hubs.ts")) await generateHistoricalTeamHubs(process.argv[2] ?? "dist/data/mlb/historical");
