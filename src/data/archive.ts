import { gzipSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { GameFact } from "../domain/standings";

export interface ArchiveStore {
  putGameFacts(source: string, season: number, games: readonly GameFact[]): Promise<string>;
}

// Local verified slice. Replace this adapter with an explicitly approved object store
// when off-machine archive durability and cost controls are available.
export class FileArchiveStore implements ArchiveStore {
  constructor(private readonly root: string) {}
  async putGameFacts(source: string, season: number, games: readonly GameFact[]): Promise<string> {
    if (!/^[a-z0-9-]+$/.test(source) || !Number.isInteger(season)) throw new Error("Invalid archive identity");
    const path = join(this.root, source, `${season}-game-facts.json.gz`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, gzipSync(JSON.stringify({ schemaVersion: 1, source, season, games })));
    return path;
  }
}
