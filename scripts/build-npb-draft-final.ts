import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { finalDraftForecastSchema, assertFinalDraftBase, assertFirstFinalPublication } from "../src/domain/npb-draft-final";
import { draftEventSchema } from "../src/domain/npb-draft-event";

const hash = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
const f = finalDraftForecastSchema.parse(JSON.parse(await readFile("src/data/npb-draft-2026-final-forecast.json", "utf8")));
// First publication is explicitly time-limited; ordinary later builds of a frozen, already published edition remain valid.
if (process.argv.includes("--first-publication")) assertFirstFinalPublication();
const input = process.argv.find(a => a.startsWith("--base="))?.slice(7);
if (!input) throw Error("Provide the pinned v3 snapshot with --base=");
const baseBytes = await readFile(input);
if (hash(baseBytes) !== f.baseBodySha256) throw Error("Wrong predecessor snapshot");
assertFinalDraftBase(f, draftEventSchema.parse(JSON.parse(baseBytes.toString())));
const body = Buffer.from(JSON.stringify(f) + "\n"), compressed = gzipSync(body, { level: 9 });
const pin = { tag: "npb-draft-final-20261022-v4", assetUrl: "https://github.com/tomoya41/baseball-notes/releases/download/npb-draft-final-20261022-v4/final-2026.json.gz", sha256: hash(compressed), bodySha256: hash(body), bytes: body.length, frozenAt: f.frozenAt };
await mkdir(".data/draft-final/release", { recursive: true });
await writeFile(".data/draft-final/release/final-2026.json.gz", compressed);
await writeFile(".data/draft-final/release/final-2026.json", body);
const target = "src/data/npb-draft-final-release.json";
const previous = await readFile(target, "utf8").catch(() => null);
if (previous && JSON.parse(previous).bodySha256 !== pin.bodySha256) throw Error("Frozen final edition cannot be overwritten; create a reviewed successor");
await writeFile(target, JSON.stringify(pin, null, 2) + "\n");
console.log(JSON.stringify({ ...pin, candidates: f.candidates.length, predictions: f.predictions.length, held: 0, gzipBytes: compressed.length, canonicalWrites: 0 }));
