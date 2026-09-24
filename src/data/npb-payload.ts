import { npbLatestStandingsSchema, type NpbLatestStandings } from "../domain/standings";
import { NpbRepository } from "./npb-repository";

export async function buildNpbStandingsPayload(repository: NpbRepository, generatedAt = new Date().toISOString()): Promise<NpbLatestStandings> {
  const standings = await repository.findLatestStandings();
  const first = standings[0];
  if (!first || standings.length !== 12) throw new Error("No complete NPB standings snapshot to publish");
  const throughDate = first.date;
  const stages = await repository.findStageStatuses(throughDate);
  if (stages.standings !== "complete" || stages.games !== "complete")
    throw new Error("NPB standings and games stages must be complete before publication");
  const teams = await repository.findTeams();
  return npbLatestStandingsSchema.parse({
    schemaVersion: 1, league: "NPB", throughDate, effectiveDate: throughDate,
    generatedAt, collectedAt: first.collectedAt, sourceUpdatedAt: null,
    sourceKey: "nf3", attribution: "出典：ヌルデータ置き場f3（公開情報の独自集計。NPB公式データではありません）",
    teams: Object.fromEntries(teams.map((team) => [team.id, { name: team.names.japaneseFull, short: team.names.japaneseShort }])),
    standings,
  });
}

export async function writeNpbPayloadAtomically(path: string, value: NpbLatestStandings): Promise<void> {
  const payload = npbLatestStandingsSchema.parse(value);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(payload));
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}
import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
