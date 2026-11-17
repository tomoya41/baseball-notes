import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gameDateIndexSchema, type GameManifest } from "../../src/domain/npb-game-index";
import { fetchNpbPublicGameSurface } from "./fetch-npb-public-game-surface";
import { npbPublicationGamePaths } from "./npb-publication";

const batchSize = 4;

export async function preserveNpbPublicGameDates(root: string, manifest: GameManifest,
  read: (path: string) => Promise<Response> = fetchNpbPublicGameSurface) {
  const paths = npbPublicationGamePaths(manifest);
  await mkdir(join(root, "games/dates"), { recursive: true });
  for (let start = 0; start < paths.length; start += batchSize) {
    // Drain this batch on failure and leave later dates unread.
    const batch = await Promise.allSettled(paths.slice(start, start + batchSize).map(async path => {
      const response = await read(path);
      if (!response.ok) throw Error(`Surface preservation HTTP ${response.status}: ${path}`);
      const body = Buffer.from(await response.arrayBuffer());
      const day = gameDateIndexSchema.parse(JSON.parse(body.toString("utf8")));
      if (path !== `games/dates/${day.date}.json` || day.generatedAt !== manifest.generatedAt)
        throw Error(`Published Game date or generation differs: ${path}`);
      return { path: join(root, path), body };
    }));
    const files = batch.map(result => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    });
    await Promise.all(files.map(({ path, body }) => writeFile(path, body)));
  }
  return paths.length;
}
