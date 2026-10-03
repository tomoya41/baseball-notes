import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { gunzipSync } from "node:zlib";
import { validStaticPayload } from "../../src/domain/mlb-historical-public";
import { postseasonHubSchema } from "../../src/domain/competition";
import { buildHistoricalTeamHub } from "../../src/data/mlb-team-product";
import type { HistoricalGame } from "../../src/data/mlb-historical";

type Player = { id: string; name: string; seasons: number[] };
type Game = { id: string; season: number; date: string; homeTeamId: string; awayTeamId: string; homeRuns: number; awayRuns: number; number: number; batting: { playerId: string }[]; pitching: { playerId: string }[] };
type DatedFact = { playerId: string; gameId: string; season: number; date: string };
const seasons = [2020, 2021, 2022, 2023, 2024, 2025];

export async function auditHistoricalPostseason(root: string, regular: string) {
  const target = join(root, "postseason"), files: string[] = [];
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await walk(join(directory, entry.name)); else files.push(join(directory, entry.name));
    }
  }
  await walk(target);
  const payloads = new Map<string, unknown>();
  let bytes = 0, largestBytes = 0;
  for (const file of files) {
    if (!file.endsWith(".json.gz")) throw new Error("Unexpected public postseason file");
    const data = await readFile(file), path = relative(target, file).replaceAll("\\", "/").slice(0, -3);
    bytes += data.length; largestBytes = Math.max(largestBytes, data.length);
    const payload: unknown = JSON.parse(gunzipSync(data).toString());
    if (!validStaticPayload(`postseason/${path}`, payload)) throw new Error(`Invalid public contract: ${path}`);
    payloads.set(path, payload);
  }
  const expected = new Set<string>();
  function requirePayload<T>(path: string): T {
    expected.add(path);
    if (!payloads.has(path)) throw new Error(`Missing advertised postseason payload: ${path}`);
    // The public runtime schema was checked above before any cross-file access.
    return payloads.get(path) as T;
  }
  const manifest = requirePayload<{ seasons: { season: number; firstDate: string; lastDate: string; games: number; playerCount: number; coverage: "complete" | "partial" | "unavailable" }[]; teams: { id: string }[]; features: { directBvp: string; situationalAnalysis?: string } }>("manifest.json");
  if (manifest.seasons.length !== seasons.length || seasons.some(year => manifest.seasons.filter(s => s.season === year).length !== 1)) throw new Error("Incomplete/duplicate manifest seasons");
  const postPlayers = requirePayload<{ players: Player[] }>("players/index.json").players;
  const postIds = new Set(postPlayers.map(p => p.id));
  if (postIds.size !== postPlayers.length || postPlayers.some(p => new Set(p.seasons).size !== p.seasons.length)) throw new Error("Duplicate postseason master identity/season");
  const advanced = requirePayload<{ directBvp: string; situations: string }>("advanced/capabilities.json");
  if ((manifest.features.directBvp === "available") !== (advanced.directBvp === "ready") || (manifest.features.situationalAnalysis === "available") !== (advanced.situations === "ready")) throw new Error("Advanced manifest capability mismatch");
  const hubs = seasons.map(year => postseasonHubSchema.parse(requirePayload(`hub/${year}.json`)));
  const games = new Map<string, Game>();
  const scheduleGames = new Map<string, Game[]>();
  let batting = 0, pitching = 0;
  for (const hub of hubs) {
    const gameRefs = hub.series.flatMap(s => s.games), seasonGames: Game[] = [];
    for (const ref of gameRefs) {
      const game = requirePayload<{ game: Game }>(`games/${ref.gameId.replaceAll(":", "_")}.json`).game;
      if (games.has(game.id) || game.id !== ref.gameId || game.season !== hub.season || game.date !== ref.date ||
        game.homeTeamId !== ref.homeTeamId || game.awayTeamId !== ref.awayTeamId || game.homeRuns !== ref.homeRuns || game.awayRuns !== ref.awayRuns) throw new Error("Hub/detail Game mismatch");
      if ([...game.batting, ...game.pitching].some(p => !postIds.has(p.playerId))) throw new Error("Player not linked to postseason canonical master");
      games.set(game.id, game); seasonGames.push(game);
      const path = `schedule/${game.season}/${game.date}.json`;
      scheduleGames.set(path, [...(scheduleGames.get(path) ?? []), game]);
    }
    const seasonBatting = seasonGames.reduce((n, g) => n + g.batting.length, 0), seasonPitching = seasonGames.reduce((n, g) => n + g.pitching.length, 0);
    if (hub.games !== seasonGames.length || hub.battingFacts !== seasonBatting || hub.pitchingFacts !== seasonPitching) throw new Error("Hub/detail counts mismatch");
    batting += seasonBatting; pitching += seasonPitching;
    const info = manifest.seasons.find(s => s.season === hub.season)!;
    const dates = seasonGames.map(g => g.date).sort(), seasonIds = new Set(postPlayers.filter(p => p.seasons.includes(hub.season)).map(p => p.id));
    if (info.games !== hub.games || info.coverage !== hub.coverage || info.firstDate !== dates[0] || info.lastDate !== dates.at(-1) || info.playerCount !== seasonIds.size) throw new Error("Manifest/Hub season mismatch");
    const stats = requirePayload<{ gameCount: number; firstDate: string; lastDate: string; players: { playerId: string }[] }>(`seasons/${hub.season}.json`);
    if (stats.gameCount !== hub.games || stats.firstDate !== info.firstDate || stats.lastDate !== info.lastDate || stats.players.length !== seasonIds.size || new Set(stats.players.map(p => p.playerId)).size !== seasonIds.size || stats.players.some(p => !seasonIds.has(p.playerId))) throw new Error("Season aggregate master mismatch");
    const records = requirePayload<{ records: { rows: { playerId: string }[] }[] }>(`records/${hub.season}.json`);
    if (records.records.some(r => r.rows.some(p => !seasonIds.has(p.playerId)))) throw new Error("Records season identity mismatch");
    if ((hub.analysis.status === "available") !== (advanced.directBvp === "ready" && advanced.situations === "ready")) throw new Error("Hub/advanced capability mismatch");
  }
  for (const [path, expectedGames] of scheduleGames) {
    const actual = requirePayload<{ games: (Game & { complete: boolean })[] }>(path).games;
    if (actual.length !== expectedGames.length || new Set(actual.map(g => g.id)).size !== actual.length || actual.some(g => {
      const expected = expectedGames.find(e => e.id === g.id);
      return !expected || !g.complete || g.homeTeamId !== expected.homeTeamId || g.awayTeamId !== expected.awayTeamId || g.homeRuns !== expected.homeRuns || g.awayRuns !== expected.awayRuns || g.number !== expected.number;
    })) throw new Error(`Schedule/detail mismatch: ${path}`);
  }
  let profileBatting = 0, profilePitching = 0;
  for (const player of postPlayers) {
    const slug = player.id.replaceAll(":", "_");
    const profile = requirePayload<{ player: Player; seasonTotals: Record<string, unknown>; batting: DatedFact[]; pitching: DatedFact[] }>(`players/${slug}.json`);
    if (profile.player.id !== player.id || JSON.stringify([...profile.player.seasons].sort()) !== JSON.stringify([...player.seasons].sort()) || Object.keys(profile.seasonTotals).length !== player.seasons.length || player.seasons.some(s => !(s in profile.seasonTotals))) throw new Error("Profile/directory season mismatch");
    for (const role of ["batting", "pitching"] as const) {
      const facts = profile[role], seen = new Set<string>();
      for (const fact of facts) {
        const game = games.get(fact.gameId);
        if (fact.playerId !== player.id || !game || game.season !== fact.season || game.date !== fact.date || !player.seasons.includes(fact.season) || seen.has(fact.gameId) || !game[role].some(p => p.playerId === player.id)) throw new Error("Profile/Game Fact mismatch");
        seen.add(fact.gameId);
      }
      if (role === "batting") profileBatting += facts.length; else profilePitching += facts.length;
    }
    for (const scope of ["range", ...player.seasons.map(String)]) {
      const data = requirePayload<{ playerId: string; scope: string; directBvp: string; situations: string; batting: { opponents: { playerId: string }[] }; pitching: { opponents: { playerId: string }[] } }>(`advanced/${scope}/${slug}.json`);
      if (data.playerId !== player.id || data.scope !== scope || data.directBvp !== advanced.directBvp || data.situations !== advanced.situations || [...data.batting.opponents, ...data.pitching.opponents].some(p => !postIds.has(p.playerId))) throw new Error("Advanced scope/identity/capability mismatch");
    }
  }
  if (profileBatting !== batting || profilePitching !== pitching) throw new Error("Profile/detail Fact count mismatch");
  // Legacy archives omit derived products. If present, require the entire advertised
  // family and verify it against the same canonical Game projections, not just a schema.
  if ([...payloads.keys()].some(path => path.startsWith("teams/") || path.startsWith("chronology/"))) {
    const canonicalGames = [...games.values()] as HistoricalGame[];
    const names = new Map(postPlayers.map(p => [p.id, p.name]));
    for (const info of manifest.seasons) {
      const chronological = requirePayload<{ games: { gameId: string; date: string; number: number }[] }>(`chronology/${info.season}.json`).games;
      const actualGames = canonicalGames.filter(g => g.season === info.season);
      if (chronological.length !== actualGames.length || chronological.some(r => { const g = games.get(r.gameId); return !g || g.season !== info.season || r.date !== g.date || r.number !== g.number; })) throw new Error("Derived chronology/detail mismatch");
      for (const team of manifest.teams) {
        const path = `teams/${info.season}/${team.id.replaceAll(":", "_")}.json`;
        const actual = requirePayload(path);
        const derived = buildHistoricalTeamHub(canonicalGames, names, { teamId: team.id, season: info.season, competitionType: "postseason", coverage: info.coverage, effectiveDate: info.lastDate });
        if (JSON.stringify(actual) !== JSON.stringify(derived)) throw new Error(`Derived Team/detail mismatch: ${path}`);
      }
    }
  }
  if (expected.size !== payloads.size || [...payloads.keys()].some(path => !expected.has(path))) throw new Error("Unadvertised/stale postseason payload");
  const expectedRegular = JSON.parse(gunzipSync(await readFile(join(regular, "players/index.json.gz"))).toString()).players as { id: string }[];
  const regularIds = new Set(expectedRegular.map(p => p.id)), sha256 = createHash("sha256");
  for (const file of files.sort()) sha256.update(relative(target, file)).update(await readFile(file));
  const report = { result: "PASS", files: files.length, games: games.size, batting, pitching, bytes, largestBytes, sha256: sha256.digest("hex"),
    sharedRegularPlayerIds: postPlayers.filter(p => regularIds.has(p.id)).length,
    postseasonOnlyPlayerIds: postPlayers.filter(p => !regularIds.has(p.id)).map(p => p.id),
    seasons: hubs.map(h => ({ season: h.season, games: h.games, series: h.series.length, coverage: h.coverage, analysis: h.analysis.status })) };
  return { report, hubs };
}
