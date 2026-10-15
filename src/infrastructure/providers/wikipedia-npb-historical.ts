import { createHash } from "node:crypto";
import { z } from "zod";
import { historicalBattingKeys, historicalPitchingKeys, npbHistoricalRowSchema, type NpbHistoricalRow } from "../../domain/npb-historical";

const teams: Record<string, string> = { "巨人": "giants", "阪神": "tigers", "中日": "dragons", "広島": "carp", "ヤクルト": "swallows", "DeNA": "baystars", "ソフトバンク": "hawks", "日本ハム": "fighters", "西武": "lions", "ロッテ": "marines", "楽天": "eagles", "オリックス": "buffaloes" };
const pageSchema = z.object({ title: z.string(), pageprops: z.object({ wikibase_item: z.string() }), revisions: z.array(z.object({ revid: z.number().int().positive(), timestamp: z.iso.datetime(), slots: z.object({ main: z.object({ content: z.string() }) }) })).length(1) });
export type HistoricalBridge = { playerId: string; wikidataId: string; npbId: string };
const plain = (text: string) => text.replace(/'''?/g, "").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_,title: string,label?:string) => label ?? title).trim();
// A deliberately small wikitext reader. Unsupported templates, spans and non-NPB tables are quarantined.
function splitCells(text: string) {
  let link = 0, template = 0, previous = 0; const cells: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const pair = text.slice(i,i+2);
    if (pair === "[[") { link++; i++; } else if (pair === "]]") { link--; i++; }
    else if (pair === "{{") { template++; i++; } else if (pair === "}}") { template--; i++; }
    else if (pair === "||" && !link && !template) { cells.push(text.slice(previous,i)); previous=i+2; i++; }
  }
  cells.push(text.slice(previous)); return cells;
}
function cell(raw: string) {
  const trimmed = raw.trim();
  const match = /^(?:(?:style|rowspan|colspan|align|class)\s*=)[^]*?\|/.exec(trimmed);
  const attributes = match?.[0] ?? "", value = trimmed.slice(attributes.length).trim();
  const rowspan = /rowspan\s*=\s*["']?(\d+)/i.exec(attributes)?.[1];
  if (/colspan/i.test(attributes)) throw Error("Unsupported colspan; no team-total duplication");
  return { value, span: rowspan ? Number(rowspan) : 1 };
}
export function inningsToOuts(value: string): number | null {
  if (/^(?:--|-|—)$/.test(value)) return null;
  const m = /^(\d+)(?:\.([012]))?$/.exec(value);
  if (!m) throw Error("Invalid baseball innings; never decimal IP");
  return Number(m[1]) * 3 + Number(m[2] ?? 0);
}
function numeric(value: string) {
  const text = plain(value);
  if (/^(?:--|-|—)$/.test(text)) return null;
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) throw Error("Unsupported numeric cell");
  return Number(text);
}
export function parseWikipediaHistorical(raw: unknown, bridge: HistoricalBridge, years: readonly number[]) {
  const page = pageSchema.parse(raw);
  if (page.pageprops.wikibase_item !== bridge.wikidataId || !/^\d+$/.test(bridge.npbId)) throw Error("Historical identity mismatch");
  const revision = page.revisions[0]!, text = revision.slots.main.content;
  if (/\{\{\s*(?:著作権侵害|Copyvio|コピペ|転載疑惑)/i.test(text)) throw Error("Article rights warning");
  const npbIds = [...text.matchAll(/npb\.jp\/bis\/players\/(\d+)\.html/g)].map(m=>m[1]);
  if (npbIds.length && !npbIds.includes(bridge.npbId)) throw Error("NPB profile evidence mismatch");
  const rows: NpbHistoricalRow[] = [], issues: { role: string; reason: string; year: string }[] = [];
  for (const role of ["batting", "pitching"] as const) {
    const heading = role === "batting" ? "年度別打撃成績" : "年度別投手成績";
    const section = new RegExp(`^={2,4}\\s*${heading}\\s*={2,4}\\s*$`, "m").exec(text);
    if (!section) continue;
    const after = text.slice(section.index + section[0].length);
    const table = /^\s*\{\|\s*\{\{(年度別打撃成績|投手成績)\s*\|リーグ=日本野球機構\s*\}\}([^]*?)\n\|\}/.exec(after);
    if (!table || (role === "batting" ? table[1] !== "年度別打撃成績" : table[1] !== "投手成績")) { issues.push({ role, year: "", reason: "unsupported_table_definition" }); continue; }
    const keys = role === "batting" ? historicalBattingKeys : historicalPitchingKeys;
    const carried = new Map<number, { value: string; remaining: number }>();
    for (const rawRow of table[2]!.split(/\n\|-.*\n/)) {
      if (!rawRow.trim()) continue;
      if (rawRow.trimStart().startsWith("!")) break; // Article career total is never imported.
      let yearText = "";
      try {
        const cells = rawRow.split(/\r?\n/).filter(l=>l.startsWith("|")).flatMap(line=>splitCells(line.slice(1))).map(cell);
        if (!cells.length) continue;
        const grid: string[] = []; let position=0;
        const carry = () => { while (carried.has(position)) { const c=carried.get(position)!; grid.push(c.value); c.remaining--; if (!c.remaining) carried.delete(position); position++; } };
        for (const c of cells) { carry(); grid.push(c.value); if (c.span > 1) carried.set(position,{ value:c.value,remaining:c.span-1 }); position++; }
        carry(); yearText=grid[0] ?? "";
        const year = /^\{\{by2\|(\d{4})\}\}$/i.exec(plain(yearText))?.[1];
        if (!year) throw Error("Unsupported year cell");
        if (!years.includes(Number(year))) continue;
        const team = teams[plain(grid[1] ?? "")];
        if (!team) throw Error("Unknown/non-NPB team; no latest-affiliation fallback");
        if (grid.length !== keys.length + 2) throw Error(`Unexpected column count ${grid.length}`);
        const metrics = Object.fromEntries(keys.map((key,i)=>[key, key === "outsRecorded" ? inningsToOuts(plain(grid[i+2]!)) : numeric(grid[i+2]!) ]));
        // Some source tables print .000 without any decisions. That is unavailable, not a 0% win rate.
        if (role === "pitching" && metrics.W === 0 && metrics.L === 0 && metrics.WPCT === 0) metrics.WPCT = null;
        rows.push(npbHistoricalRowSchema.parse({ playerId:bridge.playerId,season:Number(year),teamId:`npb:team:${team}`,role,metrics }));
      } catch (e) {
        // Invalid spanning rows can affect subsequent club/year positions. Stop this table, never guess.
        issues.push({ role, year:yearText, reason:e instanceof z.ZodError ? e.issues.map(i=>i.message).join("; ") : (e as Error).message });
        break;
      }
    }
  }
  return { player:{ playerId:bridge.playerId,name:page.title,wikidataId:bridge.wikidataId,npbId:bridge.npbId,article:page.title,revision:revision.revid,revisionAt:revision.timestamp,contentSha256:createHash("sha256").update(text).digest("hex") }, rows, issues };
}
