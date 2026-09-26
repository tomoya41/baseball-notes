import { npbPlayerDirectorySchema } from "../domain/npb-player-directory";
import { writeNpbPlayerDirectoryAtomically } from "./npb-player-directory-payload";

// Whole-site Pages deployments carry forward a validated directory until the next manual refresh.
export async function preservePublishedNpbPlayerDirectory(path: string, url: string,
  request: typeof fetch = fetch): Promise<"preserved" | "skipped"> {
  try {
    const response = await request(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return "skipped";
    const directory = npbPlayerDirectorySchema.parse(await response.json() as unknown);
    await writeNpbPlayerDirectoryAtomically(path, directory);
    return "preserved";
  } catch { return "skipped"; }
}
