import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { capabilitiesForVerifiedPostseason } from "../../src/domain/postseason-capabilities";
import { auditHistoricalPostseason } from "./mlb-postseason-audit";

export async function finalizePostseasonCapabilities(root: string) {
  const historical = join(root, "data/mlb/historical"), subtree = join(historical, "postseason");
  let present = false;
  try { present = (await stat(subtree)).isDirectory(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  // A partial/corrupt existing subtree aborts publication rather than declaring availability.
  const audit = present ? await auditHistoricalPostseason(historical, historical) : null;
  const capabilities = capabilitiesForVerifiedPostseason(audit?.hubs ?? []);
  await mkdir(join(root, "data/postseason"), { recursive: true });
  await writeFile(join(root, "data/postseason/capabilities.json"), JSON.stringify(capabilities));
  return capabilities;
}
