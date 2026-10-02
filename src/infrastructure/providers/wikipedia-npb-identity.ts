import { z } from "zod";
import { baseballInfobox, infoboxPlainText } from "./wikipedia-npb-profile";
import type { NpbPlayerDirectory } from "../../domain/npb-player-directory";

// A documented API redirect from an exact requested registered name is additional
// evidence, not fuzzy matching. Explicit club + unique NPB ID are still required.
export function verifyWikipediaNpbIdentity(raw: unknown, player: NpbPlayerDirectory["players"][number],
  requestedTitle: string, canonicalTeamName: string) {
  const page = z.object({ title: z.string(), pageprops: z.object({ wikibase_item: z.string().regex(/^Q\d+$/) }),
    revisions: z.array(z.object({ revid: z.number().int(), slots: z.object({ main: z.object({ content: z.string() }) }) })).min(1) }).parse(raw);
  if (![player.displayName, `${player.displayName} (野球)`, `${player.displayName} (野球選手)`].includes(requestedTitle)) return null;
  const text = page.revisions[0]!.slots.main.content, fields = baseballInfobox(text);
  const team = infoboxPlainText(fields.get("所属球団") ?? "");
  if (team !== canonicalTeamName) return null;
  const ids = [...new Set([...text.matchAll(/(?:\{\{NPB\s*\|\s*|https?:\/\/(?:www\.)?npb\.(?:jp|or\.jp)\/bis\/players\/)(\d{8})(?=[\s|}.])/gi)].map(m => m[1]!))];
  if (ids.length !== 1) return null;
  return { playerId: player.playerId, wikidataId: page.pageprops.wikibase_item, npbId: ids[0]!,
    sourceUrl: `https://ja.wikipedia.org/w/index.php?title=${encodeURIComponent(page.title)}&oldid=${page.revisions[0]!.revid}`,
    sourceRevision: page.revisions[0]!.revid, requestedTitle, articleTitle: page.title, explicitTeam: team };
}
