import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { npbPlayerDirectorySchema } from "../src/domain/npb-player-directory";
import { preserveNpbPublicStandings } from "./lib/npb-publication";

const [root] = process.argv.slice(2);
if (!root) throw Error("Pass staging root");
const response = await fetch(`https://tomoya41.github.io/baseball-notes/data/npb/players/latest.json?v=${Date.now()}`,
  { cache: "no-store", signal: AbortSignal.timeout(15_000) });
if (!response.ok) throw Error(`Directory snapshot HTTP ${response.status}`);
const directory = npbPlayerDirectorySchema.parse(await response.json());
const standings = await preserveNpbPublicStandings(root);
if (standings.effectiveDate !== directory.effectiveDate) throw Error("Profile-only publication requires coherent saved generation");
const file = join(root, "data/npb/players/latest.json");
await mkdir(join(root, "data/npb/players"), { recursive: true });
await writeFile(file, JSON.stringify({ ...directory, generatedAt: new Date().toISOString() }));
console.log(JSON.stringify({ effectiveDate: directory.effectiveDate, players: directory.players.length, canonicalWrites: 0, queries: 0 }));
