/** Official, bounded developer-key probe. Never persists raw responses or uses images. */
import { mkdir, writeFile } from "node:fs/promises";
const base = "https://www.thesportsdb.com/api/v1/json/123/";
const endpoints = ["lookupleague.php?id=4591", "eventsday.php?d=2026-09-25&l=4591",
  "eventsday.php?d=2026-10-10&l=4591", "eventsseason.php?id=4591&s=2026"];
const results = [];
let sampleEvent: string | null = null;
for (const endpoint of endpoints) {
  const response = await fetch(base + endpoint, { signal: AbortSignal.timeout(20000) });
  const raw = await response.text();
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw) as Record<string, unknown>; } catch { /* Non-JSON is a failed probe. */ }
  const rows = Object.values(body).filter(Array.isArray).flat() as Record<string, unknown>[];
  if (endpoint.startsWith("eventsday.php?d=2026-09-25")) sampleEvent = typeof rows[0]?.idEvent === "string" ? rows[0].idEvent : null;
  results.push({ endpoint, http: response.status, bytes: Buffer.byteLength(raw), rows: rows.length,
    fields: [...new Set(rows.flatMap(row => Object.keys(row).filter(key => row[key] !== null && row[key] !== "")))].sort(),
    // Identifiers only: no raw provider dataset is archived or published.
    eventIds: rows.flatMap(row => typeof row.idEvent === "string" ? [row.idEvent] : []) });
}
if (sampleEvent) for (const method of ["lookupevent", "lookupeventstats", "lookuplineup", "lookuptimeline"]) {
  const endpoint = `${method}.php?id=${encodeURIComponent(sampleEvent)}`;
  const response = await fetch(base + endpoint, { signal: AbortSignal.timeout(20000) });
  const raw = await response.text();
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw) as Record<string, unknown>; } catch { /* Failed JSON probe. */ }
  const rows = Object.values(body).filter(Array.isArray).flat() as Record<string, unknown>[];
  results.push({ endpoint, http: response.status, bytes: Buffer.byteLength(raw), rows: rows.length,
    fields: [...new Set(rows.flatMap(row => Object.keys(row).filter(key => row[key] !== null && row[key] !== "")))].sort(), eventIds: [] });
}
const report = { observedAt: new Date().toISOString(), purpose: "technical developer PoC, not Production permission",
  requests: results.length, results, otherProviders: "BLOCKED_CREDENTIALS; no registration performed" };
await mkdir(".data/integrated-history", { recursive: true });
await writeFile(".data/integrated-history/npb-api-probe.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
