import { mkdir, writeFile } from "node:fs/promises";
import type { DataClient } from "../../src/data/database";
import { NpbRepository } from "../../src/data/npb-repository";
import { NpbPeriodCoverageRepository } from "../../src/data/npb-period-coverage-repository";
import type { NpbPlayerDirectory } from "../../src/domain/npb-player-directory";
import { PlayerPeriodBatchService } from "../../src/application/player-period-batch";
import { buildNpbRecentExplorer } from "../../src/application/npb-recent-explorer";
export async function generateRecentExplorer(client: DataClient, directory: NpbPlayerDirectory, root: string) {
  const service = new PlayerPeriodBatchService(new NpbRepository(client), new NpbPeriodCoverageRepository(client));
  const reports = [];
  await mkdir(`${root}/data/npb/explorer/recent`, { recursive: true });
  for (const days of [7, 14, 30] as const) {
    const batch = await service.aggregate({ period: `${days}d`, asOfDate: directory.effectiveDate });
    const p = buildNpbRecentExplorer(batch, directory), json = JSON.stringify(p);
    await writeFile(`${root}/data/npb/explorer/recent/${days}.json`, json);
    reports.push({ days, bytes: Buffer.byteLength(json), players: p.players.length, coverage: p.coverage, timings: batch.timings });
  }
  return reports;
}
