import { createHash } from "node:crypto";
import { z } from "zod";
import { historicalBattingKeys, historicalPitchingKeys, historicalRates, npbHistoricalRowSchema, type NpbHistoricalRow } from "../../domain/npb-historical";
import { npbCompetitionAggregateSchema, type NpbCompetitionAggregate } from "../../domain/npb-competition";

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
  // MediaWiki permits an empty attribute field before the cell separator.
  // Accept that exact form only; malformed nonempty attributes (2|19) stay quarantined.
  const attributes = match?.[0] ?? (trimmed.startsWith("|") && !trimmed.startsWith("||") ? "|" : ""), value = trimmed.slice(attributes.length).trim();
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
  // Comments can contain whole future rows/tables, not only numeric annotations.
  // Parse the visible structure while retaining the original revision hash below.
  const visibleText = text.replace(/<!--[\s\S]*?(?:-->|$)/g, "");
  const rows: NpbHistoricalRow[] = [], issues: { role: string; reason: string; year: string; cells?:string[]; expectedRates?:Record<string,number|null> }[] = [];
  for (const role of ["batting", "pitching"] as const) {
    const heading = role === "batting" ? "年度別打撃成績" : "年度別投手成績";
    const section = new RegExp(`^={2,4}\\s*${heading}\\s*={2,4}\\s*$`, "m").exec(visibleText);
    if (!section) continue;
    const after = visibleText.slice(section.index + section[0].length);
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

/** Exact reviewed NPB postseason header only. MLB tables and unlabelled stages are excluded. */
export function parseWikipediaNpbPostseason(raw:unknown,bridge:HistoricalBridge,years:readonly number[]) {
  const identity=parseWikipediaHistorical(raw,bridge,[]).player;
  const page=pageSchema.parse(raw),text=page.revisions[0]!.slots.main.content.replace(/<!--[\s\S]*?(?:-->|$)/g, "");
  const h=/^===\s*ポストシーズン投手成績\s*===\s*$/m.exec(text);
  if(!h)return {player:identity,rows:[] as NpbCompetitionAggregate[]};
  const after=text.slice(h.index+h[0].length),end=after.search(/^={2,3}[^=]/m),section=end<0?after:after.slice(0,end);
  const table=/\{\|[^\n]*\n([^]*?)\n\|\}/.exec(section);
  if(!table)throw Error("Unsupported postseason table");
  const expected=["年度","プロ野球チーム一覧","ポストシーズン","登板","先発投手","勝利投手","敗戦投手","セーブ","ホールド","勝率","打者","投球回","安打","本塁打","四球","故意四球","死球","三振","暴投","ボーク","失点","自責点","防御率"];
  const head=table[1]!.split(/\r?\n/).find(l=>l.startsWith("!"))?.slice(1).split("!!").map(c=>/^\[\[([^|\]]+)/.exec(c.trim())?.[1]);
  if(JSON.stringify(head)!==JSON.stringify(expected))throw Error("Unreviewed postseason column definitions");
  const keys=["G","GS","W","L","SV","HLD","WPCT","BF","outsRecorded","H","HR","BB","IBB","HBP","SO","WP","BK","R","ER","ERA"];
  const carried=new Map<number,{value:string;remaining:number}>(),rows:NpbCompetitionAggregate[]=[];
  for(const physical of table[1]!.split(/\n\|-[^\n]*(?:\n|$)/).slice(1)) {
    if(physical.split(/\r?\n/).some(l=>l.startsWith("!")))break;
    const grid:string[]=[];let position=0;
    const carry=()=>{while(carried.has(position)){const c=carried.get(position)!;grid.push(c.value);if(--c.remaining===0)carried.delete(position);position++;}};
    for(const c of physical.split(/\r?\n/).filter(l=>l.startsWith("|")).flatMap(l=>splitCells(l.slice(1))).map(cell)){carry();grid.push(c.value);if(c.span>1)carried.set(position,{value:c.value,remaining:c.span-1});position++;}carry();
    if(grid.length!==23)throw Error("Ambiguous postseason columns");
    const year=/^\{\{by2\|(\d{4})\}\}$/i.exec(grid[0]!)?.[1],team=teams[plain(grid[1]!)];
    // Only exact labelled series links; references are attribution, not extra numeric evidence.
    const stageCell=grid[2]!.replace(/<ref\b[^>]*>[^]*?<\/ref>/g,"").trim();
    const stageMatch=/^\[\[(\d{4})年の(?:セントラル・リーグクライマックスシリーズ|パシフィック・リーグクライマックスシリーズ|日本シリーズ)\|(CSファースト|CSファイナル|日本シリーズ)\]\]$/.exec(stageCell);
    if(!year||!team||!stageMatch||stageMatch[1]!==year)throw Error("Unverified postseason year/team/stage");
    if(!years.includes(Number(year)))continue;
    const stage=stageMatch[2]==="CSファースト"?"npb_cs_first":stageMatch[2]==="CSファイナル"?"npb_cs_final":"japan_series";
    if((stage==="japan_series")!==stageCell.includes("年の日本シリーズ|"))throw Error("Postseason stage link mismatch");
    const metrics:Record<string,number|null>=Object.fromEntries(historicalPitchingKeys.map(k=>[k,null]));
    for(const [i,key] of keys.entries())metrics[key]=key==="outsRecorded"?inningsToOuts(plain(grid[i+3]!)):numeric(grid[i+3]!);
    rows.push(npbCompetitionAggregateSchema.parse({playerId:bridge.playerId,season:Number(year),teamId:`npb:team:${team}`,role:"pitching",metrics,scope:{league:"NPB",season:Number(year),temporalScope:"historical",competition:"postseason",stage}}));
  }
  return {player:identity,rows};
}
