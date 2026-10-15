import { createHash } from "node:crypto";
import { z } from "zod";
import { historicalBattingKeys, historicalPitchingKeys, historicalRates, npbHistoricalRowSchema, type NpbHistoricalRow } from "../../domain/npb-historical";

const teams: Record<string, string> = { "巨人": "giants", "阪神": "tigers", "中日": "dragons", "広島": "carp", "ヤクルト": "swallows", "DeNA": "baystars", "ソフトバンク": "hawks", "日本ハム": "fighters", "西武": "lions", "ロッテ": "marines", "楽天": "eagles", "オリックス": "buffaloes" };
const pageSchema = z.object({ title: z.string(), pageprops: z.object({ wikibase_item: z.string() }), revisions: z.array(z.object({ revid: z.number().int().positive(), timestamp: z.iso.datetime(), slots: z.object({ main: z.object({ content: z.string() }) }) })).length(1) });
export type HistoricalBridge = { playerId: string; wikidataId: string; npbId: string; identityScope?: "historical_only" | undefined; sourceObservedAt?: string | undefined };
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
  const trimmed = raw.replace(/<!--[\s\S]*?-->/g, "").trim();
  const match = /^(?:(?:style|rowspan|colspan|align|class)\s*=)[^]*?\|/.exec(trimmed);
  const attributes = match?.[0] ?? "", value = trimmed.slice(attributes.length).trim();
  const rowspan = /rowspan\s*=\s*["']?(\d+)/i.exec(attributes)?.[1];
  if (/colspan/i.test(attributes)) throw Error("Unsupported colspan; no team-total duplication");
  return { value, span: rowspan ? Number(rowspan) : 1 };
}
export function inningsToOuts(value: string): number | null {
  if (/^(?:[-—–]{1,4})?$/.test(value)) return null;
  const m = /^(\d+)(?:\.([012]))?$/.exec(value);
  if (!m) throw Error("Invalid baseball innings; never decimal IP");
  return Number(m[1]) * 3 + Number(m[2] ?? 0);
}
function numeric(value: string) {
  const decorated = plain(value), wrapper=/^\{\{(?:color\|(?:red|blue)|nowrap)\|([^{}|]+)\}\}$/i.exec(decorated);
  const text=wrapper?plain(wrapper[1]!):decorated;
  if (/^(?:[-—–]{1,5}|\.-{1,4})?$/.test(text)) return null;
  if (!/^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\.\d+)$/.test(text)) throw Error("Unsupported numeric cell");
  return Number(text.replaceAll(",", ""));
}
export function parseWikipediaHistorical(raw: unknown, bridge: HistoricalBridge, years: readonly number[]) {
  const page = pageSchema.parse(raw);
  if (page.pageprops.wikibase_item !== bridge.wikidataId || !/^\d+$/.test(bridge.npbId)) throw Error("Historical identity mismatch");
  const revision = page.revisions[0]!, text = revision.slots.main.content;
  if (/\{\{\s*(?:著作権侵害|Copyvio|コピペ|転載疑惑)/i.test(text)) throw Error("Article rights warning");
  const npbIds = [...text.matchAll(/npb\.jp\/bis\/players\/(\d+)\.html/g)].map(m=>m[1]);
  if (npbIds.length && !npbIds.includes(bridge.npbId)) throw Error("NPB profile evidence mismatch");
  const rows: NpbHistoricalRow[] = [], issues: { role: string; reason: string; year: string; cells?:string[]; expectedRates?:Record<string,number|null> }[] = [];
  for (const role of ["batting", "pitching"] as const) {
    const heading = role === "batting" ? "年度別打撃成績" : "年度別投手成績";
    const section = new RegExp(`^={2,4}\\s*${heading}\\s*={2,4}\\s*$`, "m").exec(text);
    if (!section) continue;
    const after = text.slice(section.index + section[0].length);
    // These templates have fixed identical numeric columns regardless of the league-link parameter.
    // Template revisions 107218506 / 108239117 independently confirm their headers.
    const boundary = after.search(/^={2,3}[^=]/m), scope=boundary<0?after:after.slice(0,boundary);
    const tables=[...scope.matchAll(/\{\|\s*\{\{(年度別打撃成績|投手成績)\s*(?:\|リーグ=(?:日本野球機構|日本プロ野球|日本プロ野球機構)?)?\}\}([^]*?)\n\|\}/g)].filter(t=>t[1]===(role==="batting"?"年度別打撃成績":"投手成績"));
    if (!tables.length) { issues.push({ role, year: "", reason: "unsupported_table_definition" }); continue; }
    const keys = role === "batting" ? historicalBattingKeys : historicalPitchingKeys;
    for(const table of tables) {
    const carried = new Map<number, { value: string; remaining: number }>();
    for (const rawRow of table[2]!.split(/\n\|-[^\n]*(?:\n|$)/)) {
      if (!rawRow.trim()) continue;
      const header=rawRow.split(/\r?\n/).find(l=>l.startsWith("!"));
      if(header) {
        // A transfer-year total occupies one physical row in club rowspans. Never import it twice.
        if(/^'\d{2}計$/.test(header.split("|").at(-1)?.trim()??"")) {
          for(const [position,c] of carried) {c.remaining--;if(!c.remaining)carried.delete(position);}
          continue;
        }
        break; // Career/other header totals are outside the contract.
      }
      const grid:string[]=[];
      let yearText = "", structuralSafe=false,metrics:Record<string,number|null>|undefined;
      try {
        const cells = rawRow.split(/\r?\n/).filter(l=>l.startsWith("|")&&!l.startsWith("|-")).flatMap(line=>splitCells(line.slice(1))).map(cell);
        if (!cells.length) continue;
        let position=0;
        const carry = () => { while (carried.has(position)) { const c=carried.get(position)!; grid.push(c.value); c.remaining--; if (!c.remaining) carried.delete(position); position++; } };
        for (const c of cells) { carry(); grid.push(c.value); if (c.span > 1) carried.set(position,{ value:c.value,remaining:c.span-1 }); position++; }
        carry(); yearText=grid[0] ?? "";
        if (grid.length !== keys.length + 2) throw Error(`Unexpected column count ${grid.length}`);
        structuralSafe=true;
        // Non-NPB clubs and foreign-season markers are never imported, even in mixed tables.
        const team = teams[plain(grid[1] ?? "")];
        if (!team) continue;
        if(/^\{\{(?:mlby|[kt]boy)\|/i.test(plain(yearText))) continue;
        const year = /^\{\{by2\|(\d{4})\}\}$/i.exec(plain(yearText))?.[1] ?? /^(\d{4})$/.exec(plain(yearText))?.[1];
        if (!year) throw Error("Unsupported year cell");
        if (!years.includes(Number(year))) continue;
        metrics = Object.fromEntries(keys.map((key,i)=>[key, key === "outsRecorded" ? inningsToOuts(plain(grid[i+2]!)) : numeric(grid[i+2]!) ]));
        // Some source tables print .000 without any decisions. That is unavailable, not a 0% win rate.
        if (role === "pitching" && metrics.W === 0 && metrics.L === 0 && metrics.WPCT === 0) metrics.WPCT = null;
        rows.push(npbHistoricalRowSchema.parse({ playerId:bridge.playerId,season:Number(year),teamId:`npb:team:${team}`,role,metrics }));
      } catch (e) {
        issues.push({ role, year:yearText, reason:e instanceof z.ZodError ? e.issues.map(i=>i.message).join("; ") : (e as Error).message, cells:grid, ...(metrics?{expectedRates:historicalRates(role,metrics)}:{}) });
        // Numeric errors do not change known grid geometry. Structural ambiguity still stops the table.
        if(!structuralSafe) break;
      }
    }
    }
  }
  return { player:{ playerId:bridge.playerId,name:page.title,wikidataId:bridge.wikidataId,npbId:bridge.npbId,article:page.title,revision:revision.revid,revisionAt:revision.timestamp,contentSha256:createHash("sha256").update(text).digest("hex"),...(bridge.identityScope?{identityScope:bridge.identityScope}:{}),...(bridge.sourceObservedAt?{sourceObservedAt:bridge.sourceObservedAt}:{}) }, rows, issues };
}
