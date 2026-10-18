import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, sep, join } from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { z } from "zod";
import { admittedEventIdentities } from "../src/infrastructure/providers/npb-event-identities";
import { parseWikipediaPlayerEvents } from "../src/infrastructure/providers/wikipedia-npb-player-events";
import { fetchNpbEventSource } from "../src/infrastructure/providers/wikipedia-npb-event-source";
import { npbPlayerEventsSchema, compareEventSnapshots } from "../src/domain/npb-player-events";
import pin from "../src/data/npb-player-events-release.json";

const args = process.argv.slice(2), value = (key: string) => args.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const output = value("output");
if (!output || !resolve(output).startsWith(resolve(".data") + sep)) throw Error("A private .data output directory is required");
const archiveFile = value("archive"), directoryFile = value("directory"), previousFile = value("previous");
if (!!archiveFile === args.includes("--fetch")) throw Error("Choose exactly one pinned archive or one bounded official API fetch");
if (previousFile && args.includes("--previous-published")) throw Error("Choose one previous snapshot");
const archiveSchema = z.object({ observedAt: z.iso.datetime(), response: z.object({ query: z.object({ pages: z.array(z.unknown()).length(1) }) }) });
let ownRequests = 0;
const archive = archiveSchema.parse(archiveFile ? JSON.parse(await readFile(archiveFile, "utf8")) : await fetchNpbEventSource(fetch, () => new Date(), value("revision") === undefined ? undefined : Number(value("revision"))));
const directory = directoryFile ? JSON.parse(await readFile(directoryFile, "utf8")) : await (async () => {
  ownRequests++; const r = await fetch("https://tomoya41.github.io/baseball-notes/data/npb/players/latest.json", { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw Error(`Published Directory HTTP ${r.status}`); const text = await r.text(); if (text.length > 500000) throw Error("Directory budget exceeded"); return JSON.parse(text);
})();
const admitted = await admittedEventIdentities(directory), parsed = parseWikipediaPlayerEvents(archive.response.query.pages[0], archive.observedAt, admitted.identities, admitted.inputSha256);
if (!parsed.dataset.events.length) throw Error("Empty candidate requires inspection; do not replace a published dataset");
let previous = previousFile ? npbPlayerEventsSchema.parse(JSON.parse(await readFile(previousFile, "utf8"))) : null;
if (args.includes("--previous-published")) {
  ownRequests++; const r = await fetch(`https://tomoya41.github.io/baseball-notes/data/npb/events/${pin.sha256}/2026.json`, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw Error(`Published event snapshot HTTP ${r.status}`);
  const body = Buffer.from(await r.arrayBuffer());
  if (body.length !== pin.bytes || createHash("sha256").update(body).digest("hex") !== pin.bodySha256) throw Error("Published event snapshot mismatch");
  previous = npbPlayerEventsSchema.parse(JSON.parse(body.toString()));
}
if (previous && (Date.parse(archive.observedAt) < Date.parse(previous.observedAt) || parsed.dataset.source.revision < previous.source.revision)) throw Error("Source revision/acquisition regressed; keep the published snapshot");
const diff = previous ? compareEventSnapshots(previous, parsed.dataset) : { added: parsed.dataset.events.map(e => e.id), removed: [], changed: [], playersChanged: [], identityInputChanged: true, sourceChanged: true };
const body = Buffer.from(JSON.stringify(parsed.dataset)), compressed = gzipSync(body, { level: 9 });
if (body.length > 250000 || compressed.length > 100000) throw Error("Event projection budget exceeded");
// Exact schema readback and deterministic replay, with no canonical repository dependency.
if (JSON.stringify(npbPlayerEventsSchema.parse(JSON.parse(body.toString()))) !== body.toString() || JSON.stringify(parseWikipediaPlayerEvents(archive.response.query.pages[0], archive.observedAt, admitted.identities, admitted.inputSha256).dataset) !== body.toString()) throw Error("Event projection replay mismatch");
await mkdir(output, { recursive: true });
await writeFile(join(output, "dataset.json"), body); await writeFile(join(output, "npb-player-events.json.gz"), compressed);
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const report = { status: "CANDIDATE_ONLY", observedAt: parsed.dataset.observedAt, sourceRevision: parsed.dataset.source.revision, coverage: "partial", events: parsed.dataset.events.length, players: parsed.dataset.players.length,
  identityPool: admitted.identities.length, ambiguousArticles: admitted.ambiguousArticles, issues: parsed.issues.length,
  issueReasons: parsed.issues.reduce<Record<string, number>>((counts, i) => ({ ...counts, [i.reason]: (counts[i.reason] ?? 0) + 1 }), {}),
  diff, requiresRemovalOrCorrectionReview: !!(diff.removed.length || diff.changed.length || diff.playersChanged.length || diff.identityInputChanged && previous), sourceRequests: archiveFile ? 0 : 1, ownRequests, canonicalWrites: 0,
  bytes: body.length, gzipBytes: compressed.length, sha256: sha(compressed), bodySha256: sha(body), identityInputSha256: admitted.inputSha256, deterministicReplay: true, apiSummaryCalls: 0, additionalCostYen: 0 };
await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
// Hash-only quarantine diagnostics: no article body or speculative identity dump in CI artifacts.
await writeFile(join(output, "quarantine.json"), JSON.stringify(parsed.issues, null, 2));
console.log(JSON.stringify(report));
