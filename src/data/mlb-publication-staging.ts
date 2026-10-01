import { randomUUID } from "node:crypto";
import { cp, lstat, mkdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import type { CompetitionType } from "../domain/competition";

async function exists(path: string) {
  try { const entry = await lstat(path); if (entry.isSymbolicLink()) throw new Error("Symlink publication target"); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}

/** Replace the selected generated scope, including deleted paths; preserve only the other scope. */
export async function stageHistoricalCompetition(sourceRoot: string, targetRoot: string, competition: CompetitionType) {
  const source = resolve(sourceRoot), target = resolve(targetRoot);
  if (basename(target) !== "historical" || basename(dirname(target)) !== "mlb" || basename(dirname(dirname(target))) !== "data")
    throw new Error("Expected an explicit data/mlb/historical publication target");
  if (source === target || !relative(source, target).startsWith("..") || !relative(target, source).startsWith(".."))
    throw new Error("Overlapping publication source/target");
  const selectedSource = competition === "postseason" ? join(source, "postseason") : source;
  const selectedTarget = competition === "postseason" ? join(target, "postseason") : target;
  await mkdir(dirname(selectedTarget), { recursive: true });
  const stage = join(dirname(selectedTarget), `.historical-stage-${randomUUID()}`);
  const previous = join(dirname(selectedTarget), `.historical-previous-${randomUUID()}`);
  let movedPrevious = false;
  try {
    if (!await exists(selectedSource)) throw new Error("Generated publication source missing");
    if (competition === "regular" && await exists(join(source, "postseason"))) throw new Error("Mixed generated competition tree");
    await cp(selectedSource, stage, { recursive: true, errorOnExist: true, force: false });
    if (competition === "regular" && await exists(join(target, "postseason")))
      await cp(join(target, "postseason"), join(stage, "postseason"), { recursive: true });
    if (await exists(selectedTarget)) { await rename(selectedTarget, previous); movedPrevious = true; }
    try { await rename(stage, selectedTarget); }
    catch (error) { if (movedPrevious) await rename(previous, selectedTarget); movedPrevious = false; throw error; }
    if (movedPrevious) await rm(previous, { recursive: true, force: true });
  } finally { await rm(stage, { recursive: true, force: true }); }
}
