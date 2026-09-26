import { load } from "cheerio";
import { openDataClient, type DataClient } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { parseNf3GameBattingRow } from "../src/data/npb-game-source";
import { parseNf3BattingLogs, normalizeNpbName } from "../src/data/npb-nf3";
import { validateNpbGameFacts } from "../src/data/npb-game-collector";

const targets = [
  ["2026-09-20","npb:game:6c0c93565b43009561f1"],
  ["2026-09-21","npb:game:09c2347200a3da82d093"],
  ["2026-09-22","npb:game:553f13a223de1e77a691"],
  ["2026-09-23","npb:game:d0470dcc80db98fddbe4"],
  ["2026-09-25","npb:game:32c76ee9e92f7408892c"],
] as const;
const players = [
  { id:"92a02594-a4f7-498c-bb83-8a41855b4645",name:"森下翔太",number:"1" },
  { id:"24a531df-c242-459c-86cb-047237076ae1",name:"近本光司",number:"5" },
] as const;
const fields = ["pa","ab","runs","hits","doubles","triples","homeRuns","rbi","walks","hbp",
  "sacrificeHits","sacrificeFlies","strikeouts","stolenBases","caughtStealing"] as const;
const mode = process.argv.find((arg) => arg.startsWith("--mode="))?.slice(7) ?? "dry-run";
if (mode !== "dry-run" && mode !== "repair") throw new Error("Invalid repair mode");
const url = process.env.TURSO_DATABASE_URL, token = process.env.TURSO_AUTH_TOKEN;
if (!url || url.startsWith("file:") || !token) throw new Error("Remote Turso connection required");
const client = openDataClient(url,token);
const counts = async () => (await client.execute(`SELECT (SELECT count(*) FROM npb_games) games,
  (SELECT count(*) FROM player_game_batting) batting,(SELECT count(*) FROM player_game_pitching) pitching,
  (SELECT count(*) FROM source_entity_mappings) mappings`)).rows[0];
const cache = new Map<string,string>();
async function source(sourceUrl:string, name:string, number:string) {
  const endpoint = new URL(sourceUrl);
  if (endpoint.origin !== "https://nf3.sakura.ne.jp" || endpoint.searchParams.get("tm") !== "T" ||
    endpoint.searchParams.get("fpnum") !== number) throw new Error("Unexpected source identity URL");
  let html = cache.get(sourceUrl);
  if (!html) {
    if (cache.size) await new Promise((resolve) => setTimeout(resolve,750));
    const response = await fetch(sourceUrl,{ signal:AbortSignal.timeout(15000),
      headers:{ "User-Agent":"BaseballDataAppCollector/0.1 (targeted Fact integrity repair)" } });
    if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
    html = await response.text();
    if (Buffer.byteLength(html) > 500000) throw new Error("Oversized Source response");
    cache.set(sourceUrl,html);
  }
  const $ = load(html);
  const heading = $("span[style*='font-size:24px']").filter((_,element) => $(element).text().includes(`#${number}`)).first().text();
  if (!normalizeNpbName(heading).includes(normalizeNpbName(name))) throw new Error("Source name mismatch");
  return html;
}
try {
  const beforeCounts = await counts();
  const repository = new NpbRepository(client);
  const plans = [];
  for (const [date,gameId] of targets) {
    const game = (await repository.findGamesByDate(date)).find((row) => row.id === gameId);
    if (!game || (game.homeTeamId !== "npb:team:tigers" && game.awayTeamId !== "npb:team:tigers"))
      throw new Error("Canonical Game mismatch");
    const saved = await repository.findBattingByGame(gameId);
    for (const player of players) {
      const old = saved.find((fact) => fact.playerId === player.id && fact.teamId === "npb:team:tigers");
      if (!old?.sourceUrl) throw new Error("Missing canonical target Fact provenance");
      const mapping = await client.execute({sql:`SELECT internal_entity_id FROM source_entity_mappings
        WHERE source_key='nf3' AND entity_kind='player' AND source_entity_id=?`,args:[`2026:T:uniform:${player.number}`]});
      if (mapping.rows.length !== 1 || mapping.rows[0]!.internal_entity_id !== player.id)
        throw new Error("Canonical mapping mismatch");
      const html = await source(old.sourceUrl,player.name,player.number);
      const parsed = parseNf3GameBattingRow(html,date,"T",player.id,old.sourceRecordId,old.sourceUrl,new Date().toISOString());
      if (parsed.unsupportedPaEvents.length || parsed.row.fact.pa === null ||
        parsed.row.opponentTeamId !== old.opponentTeamId) throw new Error("Source does not safely establish target PA");
      for (const key of fields) if (old[key] != null && old[key] !== parsed.row.fact[key])
        throw new Error(`Known field differs from Source: ${date} ${player.id} ${key}`);
      const fact = { ...parsed.row.fact,gameId,battingOrder:old.battingOrder,starter:old.starter };
      const limited = parseNf3BattingLogs(html,2026,"T",player.id,old.sourceUrl,new Date().toISOString())
        .find((row) => row.date === date);
      if (!limited) throw new Error("Missing limited Source row");
      plans.push({ date,game,old,row:{...parsed.row,fact},limited,
        changed:fields.some((key) => old[key] !== fact[key]) });
    }
  }
  if (mode === "repair") {
    const transaction = await client.transaction("write");
    try {
      const writer = new NpbRepository(transaction as unknown as DataClient);
      for (const plan of plans) {
        if (plan.changed) await writer.saveBatting([plan.row],plan.date,false,false,"full");
        const full = await writer.findBattingByGame(plan.game.id);
        // Replay authoritative repair only when values differ: a second repair is a no-op.
        const actual = full.find((fact) => fact.playerId === plan.old.playerId)!;
        if (fields.some((key) => actual[key] !== plan.row.fact[key])) throw new Error("Repair readback differs");
        await writer.saveBatting([plan.limited],plan.date,false,false,"limited");
        const reread = (await writer.findBattingByGame(plan.game.id)).find((fact) => fact.playerId === plan.old.playerId)!;
        if (JSON.stringify(actual) !== JSON.stringify(reread)) throw new Error("Limited replay degraded repaired Fact");
      }
      for (const [date,gameId] of targets) {
        const evidence = await writer.findGameCompleteness(gameId);
        if (evidence?.gameStatus !== "complete") continue;
        const game = plans.find((plan) => plan.date === date)!.game;
        const validation = validateNpbGameFacts(game,evidence.expectedBatters,await writer.findBattingByGame(gameId),
          evidence.expectedPitchers,await writer.findPitchingByGame(gameId),evidence.mappedBatters,evidence.mappedPitchers);
        if (validation.gameStatus !== "complete") throw new Error(`Existing complete Game validation failed: ${date} ${validation.issues.join(",")}`);
      }
      await transaction.commit();
    } catch(error) { await transaction.rollback(); throw error; }
    finally { transaction.close(); }
  }
  const afterCounts = await counts();
  if (JSON.stringify(beforeCounts) !== JSON.stringify(afterCounts)) throw new Error("Row counts changed");
  console.log(JSON.stringify({mode,beforeCounts,afterCounts,sourceRequests:cache.size,
    changedFacts:mode === "repair" ? plans.filter((plan) => plan.changed).length : 0,
    limitedReplayDegradations:mode === "repair" ? 0 : null,targets:plans.map(({date,game,old,row,changed}) => ({date,gameId:game.id,
      playerId:old.playerId,beforePa:old.pa,pa:row.fact.pa,ab:row.fact.ab,bb:row.fact.walks,hbp:row.fact.hbp,
      sh:row.fact.sacrificeHits,sf:row.fact.sacrificeFlies,changed}))},null,2));
} finally { client.close(); }
