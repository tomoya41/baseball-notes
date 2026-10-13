import { openDataClient } from "../src/data/database";
import { auditNpbIntegrity, hashNpbIntegrity } from "../src/data/npb-integrity-audit";
import { npbRegularSeasons } from "../src/data/npb-season-metadata";
const url = process.env.TURSO_DATABASE_URL, token = process.env.TURSO_AUTH_TOKEN;
if (!url || url.startsWith("file:") || !token) throw Error("Remote read-only connection required");
const client = openDataClient(url, token), start = performance.now();
try {
  const season = npbRegularSeasons.at(-1)!;
  const before = await hashNpbIntegrity(client);
  const asOfDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
  const report = await auditNpbIntegrity(client, { from: season.startDate, to: season.endDate, timeZone: "Asia/Tokyo" }, asOfDate);
  const after = await hashNpbIntegrity(client);
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  console.log(JSON.stringify({ observedAt: new Date().toISOString(), metadata: season, ...report,
    before, after, unchanged, databaseWrites: 0, sourceRequests: 0, elapsedMs: performance.now() - start }, null, 2));
  if (!unchanged) throw Error("Database changed during audit; obtain a stable observation before reporting invariants");
  if (report.inputErrors.length || report.evidenceFindings.length) throw Error("Corrupt or unavailable saved evidence requires review; diagnostic report preserved");
} finally { client.close(); }
