import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { validateNpbPublication } from "../../src/application/npb-publication-consistency";

export async function readNpbPublication(root: string) {
  const read = async (path: string) => JSON.parse(await readFile(join(root, "data/npb", path), "utf8")) as unknown;
  const [directory, catalog, capabilities, season, hot, teamSeason] = await Promise.all([
    read("players/latest.json"), read("catalog/latest.json"), read("capabilities.json"),
    read("season/2026/latest.json"), read("hot/latest.json"), read("teams/season/2026/latest.json"),
  ]);
  const milestones = await read("milestones/2026/latest.json").catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  return validateNpbPublication({ directory, catalog, capabilities, season, hot, teamSeason, milestones });
}

export async function writeNpbProfileProjections(root: string, input: Parameters<typeof validateNpbPublication>[0]) {
  // Validate the whole candidate before overwriting any staged projection.
  const p = validateNpbPublication(input);
  for (const [path, value] of Object.entries({ "players/latest.json": p.directory,
    "catalog/latest.json": p.catalog, "capabilities.json": p.capabilities,
    [`milestones/${p.season.season}/latest.json`]: p.milestones })) {
    if (value === undefined) continue;
    const file = join(root, "data/npb", path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(value));
  }
  // File errors abort the job: only a fully validated Pages artifact may be uploaded.
  await readNpbPublication(root);
}
