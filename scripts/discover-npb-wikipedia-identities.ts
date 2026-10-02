import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { npbPlayerDirectorySchema } from "../src/domain/npb-player-directory";
import { verifyWikipediaNpbIdentity } from "../src/infrastructure/providers/wikipedia-npb-identity";
import { linkChadwickNpb } from "../src/infrastructure/providers/chadwick-npb-identity";

const [folder = ".data/npb-free2"] = process.argv.slice(2);
const read = async (name: string) => JSON.parse(await readFile(`${folder}/${name}`, "utf8")) as unknown;
const directory = npbPlayerDirectorySchema.parse(await read("players-before.json"));
const bridges = z.array(z.object({ playerId: z.uuid(), wikidataId: z.string(), npbId: z.string() }).passthrough()).parse(await read("exact-bridges.json"));
const remaining = directory.players.filter(p => !bridges.some(b => b.playerId === p.playerId));
const titles = remaining.flatMap(p => [p.displayName, `${p.displayName} (野球)`, `${p.displayName} (野球選手)`]);
const pages = new Map<string, unknown>(), redirects = new Map<string, string>(); let requests = 0;
for (let i = 0; i < titles.length; i += 20) {
  const url = new URL("https://ja.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({ action: "query", format: "json", formatversion: "2", redirects: "1", prop: "revisions|pageprops", rvprop: "ids|timestamp|content", rvslots: "main", ppprop: "wikibase_item", titles: titles.slice(i, i + 20).join("|") }).toString();
  const file = `${folder}/identity-pages-${createHash("sha256").update(url.href).digest("hex")}.json`;
  let body: string;
  try { body = await readFile(file, "utf8"); } catch {
    await new Promise(r => setTimeout(r, 1200));
    const res = await fetch(url, { headers: { "User-Agent": "BaseballNotes-curated-profile/2.0 (https://github.com/tomoya41/baseball-notes)" }, signal: AbortSignal.timeout(60000) });
    requests++; if (!res.ok) throw Error(`Wikipedia HTTP ${res.status}`);
    body = await res.text(); await writeFile(file, body);
  }
  const result = z.object({ query: z.object({ pages: z.array(z.object({ title: z.string() }).passthrough()),
    normalized: z.array(z.object({ from: z.string(), to: z.string() })).optional(), redirects: z.array(z.object({ from: z.string(), to: z.string() })).optional() }) }).parse(JSON.parse(body)).query;
  for (const p of result.pages) pages.set(p.title, p);
  for (const r of [...result.normalized ?? [], ...result.redirects ?? []]) redirects.set(r.from, r.to);
}
const chadwick = await read("chadwick-npb.json"), approved: ReturnType<typeof verifyWikipediaNpbIdentity>[] = [];
const archive: Record<string, unknown> = {};
for (const p of remaining) {
  const candidates: NonNullable<ReturnType<typeof verifyWikipediaNpbIdentity>>[] = [];
  for (const title of [p.displayName, `${p.displayName} (野球)`, `${p.displayName} (野球選手)`]) {
    let resolved = title; const visited = new Set<string>();
    while (redirects.has(resolved) && !visited.has(resolved)) { visited.add(resolved); resolved = redirects.get(resolved)!; }
    try {
      const match = verifyWikipediaNpbIdentity(pages.get(resolved), p, title, directory.teams.find(t => t.id === p.teamId)!.name);
      if (match && linkChadwickNpb(chadwick, [match])[0]?.approved) { candidates.push(match); archive[resolved] = pages.get(resolved); }
    } catch { /* Missing/disambiguation/unsupported pages are not identity evidence. */ }
  }
  const unique = [...new Map(candidates.map(c => [`${c.wikidataId}:${c.npbId}`, c])).values()];
  if (unique.length === 1 && !bridges.some(b => b.npbId === unique[0]!.npbId || b.wikidataId === unique[0]!.wikidataId)) approved.push(unique[0]!);
}
await writeFile(`${folder}/wikipedia-identity-discovery.json`, JSON.stringify({ observedAt: new Date().toISOString(), requests, examined: remaining.length, approved, pages: archive }, null, 2));
console.log(JSON.stringify({ examined: remaining.length, approved: approved.length, requests }));
