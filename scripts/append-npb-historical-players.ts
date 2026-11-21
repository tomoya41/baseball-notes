import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { npbHistoricalDatasetSchema, type NpbHistoricalDataset } from "../src/domain/npb-historical";
import current from "../src/data/npb-historical-release.json";
import legacy from "../src/data/npb-historical-legacy-release.json";
import retained from "../src/data/npb-historical-retained-releases.json";
import { assertHistoricalBridge } from "../src/infrastructure/providers/npb-historical-admission";

const sha256 = (input: string | Uint8Array) => createHash("sha256").update(input).digest("hex");

export function appendHistoricalPlayers({
  base, baseHash, addition, additionHash,
}: { base: NpbHistoricalDataset; baseHash: string; addition: NpbHistoricalDataset; additionHash: string }) {
  const existing = new Set(base.players.map(player => player.playerId));
  const addedWithRows = new Set(addition.rows.map(row => row.playerId));
  if (addedWithRows.size === 0 || addition.players.some(player => !addedWithRows.has(player.playerId) || existing.has(player.playerId))) {
    throw Error("Append requires distinct, previously uncollected players with their own verified rows");
  }
  for (const player of addition.players) assertHistoricalBridge(player, player);

  const inputs = {
    baseRelease: baseHash, baseArchive: base.inputSha256, appendedRelease: additionHash, appendedArchive: addition.inputSha256,
  };
  const dataset = npbHistoricalDatasetSchema.parse({
    ...base,
    observedAt: Date.parse(base.observedAt) >= Date.parse(addition.observedAt) ? base.observedAt : addition.observedAt,
    inputSha256: sha256(JSON.stringify(inputs)),
    transformation: base.transformation + "; appended independently reviewed player-season rows",
    players: [...base.players, ...addition.players],
    rows: [...base.rows, ...addition.rows],
  });
  return { inputs, dataset };
}

async function main() {
  const [basePath, additionPath, output] = process.argv.slice(2);
  if (!basePath || !additionPath || !output || !resolve(output).startsWith(resolve(".data") + sep)) {
    throw Error("Usage: append-npb-historical-players.ts base.json.gz reviewed-addition.json.gz .data/output-directory");
  }
  const baseBytes = await readFile(basePath);
  const baseHash = sha256(baseBytes);
  const basePin = [current, legacy, ...retained].find(pin => pin.sha256 === baseHash);
  if (!basePin) throw Error("Base Historical archive is not pinned");
  const parse = (bytes: Uint8Array) => npbHistoricalDatasetSchema.parse(
    JSON.parse(gunzipSync(bytes, { maxOutputLength: 10_000_000 }).toString("utf8")),
  );
  const base = parse(baseBytes);
  if (base.inputSha256 !== basePin.inputSha256) throw Error("Base Historical input does not match the pin");
  const additionBytes = await readFile(additionPath);
  const { dataset, inputs } = appendHistoricalPlayers({ base, baseHash, addition: parse(additionBytes), additionHash: sha256(additionBytes) });
  const archive = gzipSync(JSON.stringify(dataset), { level: 9 });
  const report = {
    sha256: sha256(archive), inputSha256: dataset.inputSha256, players: dataset.players.length, rows: dataset.rows.length,
    addedPlayers: dataset.players.length - base.players.length, addedRows: dataset.rows.length - base.rows.length,
    bytes: archive.length, canonicalWrites: 0, sourceRequests: 0,
  };
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "npb-historical-wikipedia.json.gz"), archive, { flag: "wx" });
  await writeFile(join(output, "inputs.json"), JSON.stringify(inputs), { flag: "wx" });
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify(report));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
