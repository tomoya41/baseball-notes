import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { historicalCurrentBridges, assertHistoricalBridge } from "./npb-historical-admission";
import { eventIdentitySchema, type EventIdentity } from "../../domain/npb-player-events";
import { npbPlayerDirectorySchema } from "../../domain/npb-player-directory";

/** Build/collector only. Reuse approved article/ID associations, never a news-name lookup. */
export async function admittedEventIdentities(directory: unknown) {
  const d = npbPlayerDirectorySchema.parse(directory), ids = new Map(d.players.map(p => [p.playerId, p]));
  const files = ["src/data/npb-wikipedia-profile-registry.json", "src/data/npb-codex-assisted-profile-registry.json"];
  const hash = createHash("sha256"), associations = new Map<string, Map<string, number>>();
  for (const file of files) {
    const bytes = await readFile(file); hash.update(bytes);
    const registry = JSON.parse(bytes.toString()) as { entries: { playerId: string; sourceUrl: string; license: string; verificationStatus: string; publicReuseAllowed: boolean }[] };
    for (const e of registry.entries) {
      if (!ids.has(e.playerId) || !e.publicReuseAllowed || e.license !== "CC-BY-SA-4.0" || e.verificationStatus !== "source_verified") continue;
      const url = new URL(e.sourceUrl);
      if (url.origin !== "https://ja.wikipedia.org" || url.pathname !== "/w/index.php") continue;
      const title = url.searchParams.get("title"), revision = Number(url.searchParams.get("oldid"));
      if (!title || !Number.isSafeInteger(revision) || revision < 1) continue;
      const map = associations.get(e.playerId) ?? new Map<string, number>();
      map.set(title, Math.max(map.get(title) ?? 0, revision)); associations.set(e.playerId, map);
    }
  }
  const admittedBytes = await readFile("src/data/npb-event-identity-registry.json"); hash.update(admittedBytes);
  const admitted = JSON.parse(admittedBytes.toString()) as { players: (EventIdentity & { identityContentSha256: string })[] };
  for (const p of admitted.players) {
    assertHistoricalBridge(p);
    if (!/^[a-f0-9]{64}$/.test(p.identityContentSha256)) throw Error("Missing pinned identity content proof");
    const map = associations.get(p.playerId) ?? new Map<string, number>();
    map.set(p.article, Math.max(map.get(p.article) ?? 0, p.identityRevision)); associations.set(p.playerId, map);
  }
  const identities: EventIdentity[] = [];
  for (const bridge of historicalCurrentBridges) {
    const articles = associations.get(bridge.playerId), player = ids.get(bridge.playerId);
    if (!player || articles?.size !== 1) continue;
    const [article, identityRevision] = [...articles.entries()][0]!;
    identities.push(eventIdentitySchema.parse({ ...bridge, name: player.displayName, article, identityRevision }));
  }
  const ambiguous = new Set(identities.filter(p => identities.some(q => q.playerId !== p.playerId && q.article === p.article)).map(p => p.article));
  return { identities: identities.filter(p => !ambiguous.has(p.article)), inputSha256: hash.digest("hex"), ambiguousArticles: ambiguous.size };
}
