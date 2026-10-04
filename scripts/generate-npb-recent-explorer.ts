import { readFile } from "node:fs/promises";
import { openDataClient, type DataClient } from "../src/data/database";
import { npbPlayerDirectorySchema } from "../src/domain/npb-player-directory";
import { generateRecentExplorer } from "./lib/npb-recent-explorer";
const root = process.argv[2] ?? "dist", url = process.env.TURSO_DATABASE_URL, token = process.env.TURSO_AUTH_TOKEN;
if (!url || url.startsWith("file:") || !token) throw Error("Read-only remote connection required");
const directory = npbPlayerDirectorySchema.parse(JSON.parse(await readFile(`${root}/data/npb/players/latest.json`, "utf8")));
const source = openDataClient(url, token); let selects = 0;
const client = new Proxy(source, { get(target, key) {
  if (key === "execute") return async (s: Parameters<DataClient["execute"]>[0]) => {
    if (!/^\s*SELECT\b/i.test(typeof s === "string" ? s : s.sql)) throw Error("Canonical writes prohibited");
    selects++; return target.execute(s);
  };
  const v = Reflect.get(target, key); return typeof v === "function" ? v.bind(target) : v;
} }) as DataClient;
try { console.log(JSON.stringify({ effectiveDate: directory.effectiveDate, reports: await generateRecentExplorer(client, directory, root), selects, writes: 0 })); }
finally { source.close(); }
