import { readFile } from "node:fs/promises";
import { npbHotPayloadSchema } from "../application/npb-hot-payload";
import { npbLatestStandingsSchema } from "../domain/standings";
import { writeNpbHotPayloadAtomically } from "./npb-hot-payload";

// Pages deploys replace the whole site. Carry forward only an already validated HOT payload.
// A missing or damaged HOT endpoint must never stop the independent Daily Collector publish.
export async function preservePublishedNpbHot(standingsPath: string, hotPath: string,
  url: string, request: typeof fetch = fetch): Promise<"preserved" | "skipped"> {
  try {
    const standings = npbLatestStandingsSchema.parse(JSON.parse(await readFile(standingsPath, "utf8")) as unknown);
    const response = await request(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return "skipped";
    const hot = npbHotPayloadSchema.parse(await response.json() as unknown);
    if (hot.effectiveDate > standings.effectiveDate) return "skipped";
    await writeNpbHotPayloadAtomically(hotPath, hot);
    return "preserved";
  } catch { return "skipped"; }
}
