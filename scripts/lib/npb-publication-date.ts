import { z } from "zod";

// Current projections use the latest stored master and schedule. They cannot
// reconstruct a historical snapshot merely by changing its effectiveDate.
export function npbLatestPublicationDate(latest: unknown, requested?: string | null): string {
  const date = z.iso.date().parse(latest);
  if (requested !== undefined && requested !== null && z.iso.date().parse(requested) !== date)
    throw new Error(`NPB publication requires the latest stored standings date (${date}); historical replay is unsupported`);
  return date;
}
