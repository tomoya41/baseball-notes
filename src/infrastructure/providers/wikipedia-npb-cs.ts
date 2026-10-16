import { createHash } from "node:crypto";
import { z } from "zod";
import { inningsToOuts } from "./wikipedia-npb-historical";
import { historicalBattingKeys, historicalPitchingKeys, historicalRates, npbHistoricalRowSchema } from "../../domain/npb-historical";
import { npbCompetitionAggregateSchema, type NpbCompetitionAggregate } from "../../domain/npb-competition";
import type { NpbCsDataset } from "../../domain/npb-cs-observations";

const teams: Record<string, string> = { 日本ハム: "fighters", 西武: "lions", ソフトバンク: "hawks", DeNA: "baystars", 巨人: "giants", 阪神: "tigers" };
const plain = (v: string) => v.replace(/'''?/g, "").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a: string, b?: string) => b ?? a).replace(/<[^>]*>/g, "").replace(/\s/g, "");
function split(text: string, separator: string): string[] {
  const result: string[] = []; let link = 0, template = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const pair = text.slice(i, i + 2);
    if (pair === "[[") { link++; i++; } else if (pair === "]]") { link--; i++; }
    else if (pair === "{{") { template++; i++; } else if (pair === "}}") { template--; i++; }
    else if (!link && !template && text.startsWith(separator, i)) { result.push(text.slice(start, i)); start = i + separator.length; i += separator.length - 1; }
  }
  result.push(text.slice(start)); return result;
}
function number(raw: string): number | null { const v = plain(raw); if (!v || v === "—" || v === "-") return null; if (!/^\d+$/.test(v)) throw Error("Unknown CS numeric cell"); return Number(v); }
const pageSchema = z.object({ pageid: z.number().int().positive(), title: z.string(), revisions: z.array(z.object({ revid: z.number().int().positive(), timestamp: z.iso.datetime(), slots: z.object({ main: z.object({ content: z.string() }) }) })).length(1) });
type Identity = { playerId: string; article: string };

/** Pinned, reviewed Wikipedia layouts only. Blank cells and combined BB/HBP stay unknown. */
export function parseWikipediaCs(raw: unknown, observedAt: string, identities: readonly Identity[]) {
  const p = pageSchema.parse(raw), rev = p.revisions[0]!, original = rev.slots.main.content;
  if (({ 5301694: "2026年のパシフィック・リーグクライマックスシリーズ", 5302364: "2026年のセントラル・リーグクライマックスシリーズ" } as Record<number, string>)[p.pageid] !== p.title || rev.timestamp > observedAt || /\{\{\s*(?:著作権侵害|Copyvio|転載疑惑)/i.test(original)) throw Error("Unreviewed CS article/revision");
  const text = original.replace(/<!--[\s\S]*?-->/g, ""), byArticle = new Map(identities.map(v => [v.article, v.playerId]));
  if (byArticle.size !== identities.length) throw Error("Ambiguous article identity");
  const games: NpbCsDataset["games"] = [], observations: { aggregate: NpbCompetitionAggregate; gameId: string }[] = [], issues: { date?: string; reason: string; article?: string }[] = [];
  const starts = [...text.matchAll(/\{\{Linescore\s*\n/g)];
  for (let n = 0; n < starts.length; n++) {
    const start = starts[n]!.index!, end = starts[n + 1]?.index ?? text.length, block = text.slice(start, end), before = text.slice(0, start);
    const stageHeading = [...before.matchAll(/^===\s*(ファーストステージ|ファイナルステージ)\s*===/gm)].at(-1)?.[1];
    const stage = stageHeading === "ファーストステージ" ? "npb_cs_first" : stageHeading === "ファイナルステージ" ? "npb_cs_final" : null;
    let depth = 1, close = -1;
    for (let i = "{{Linescore".length; i < block.length - 1; i++) { if (block.slice(i, i + 2) === "{{") { depth++; i++; } else if (block.slice(i, i + 2) === "}}") { depth--; if (!depth) { close = i; break; } i++; } }
    if (close < 0 || !stage) { issues.push({ reason: "unsupported_score_template" }); continue; }
    const fields: Record<string, string> = {};
    for (const part of split(block.slice("{{Linescore".length, close), "|")) { const eq = part.indexOf("="); if (eq > 0) { const key = part.slice(0, eq).trim(); if (fields[key] !== undefined) throw Error("Duplicate Linescore field"); fields[key] = part.slice(eq + 1).trim(); } }
    const dateMatch = /^(\d{1,2})月(\d{1,2})日$/.exec(plain(fields.Date ?? ""));
    const date = dateMatch ? `2026-${dateMatch[1]!.padStart(2, "0")}-${dateMatch[2]!.padStart(2, "0")}` : "";
    try {
      if (!z.iso.date().safeParse(date).success || date > observedAt.slice(0, 10) || !/試合時間[：:]\s*\d+時間\d+分/.test(fields.Note2 ?? "")) throw Error("not_observed_final");
      const home = teams[plain(fields.Home ?? "")], away = teams[plain(fields.Road ?? "")];
      if (!home || !away || home === away) throw Error("unknown_team");
      const hs = number(fields.HR ?? ""), rs = number(fields.RR ?? "");
      if (hs === null || rs === null || hs !== rs && !plain(fields.WP ?? "")) throw Error("no_final_result_evidence");
      for (const [prefix, total] of [["R", rs], ["H", hs]] as const) {
        const cells = Array.from({ length: 12 }, (_, i) => fields[`${prefix}${i + 1}`]);
        const last = cells.reduce((index, value, i) => value === undefined ? index : i, -1), innings = cells.slice(0, last + 1);
        // No skipped inning becomes an implicit zero; X belongs only to the final home half.
        if (innings.length < 9 || innings.some((v, i) => v === undefined || !(prefix === "H" && i === last ? /^(?:\d+[xX]?|X)$/i : /^\d+$/).test(plain(v))) || innings.reduce((sum, v) => sum + Number(plain(v!).replace(/[xX]/, "") || 0), 0) !== total) throw Error("incomplete_innings_or_score_mismatch");
      }
      const homeTeamId = npbHistoricalRowSchema.shape.teamId.parse(`npb:team:${home}`), awayTeamId = npbHistoricalRowSchema.shape.teamId.parse(`npb:team:${away}`);
      const id = `npb:game:${createHash("sha256").update([date, homeTeamId, awayTeamId, 1].join(":")).digest("hex").slice(0, 20)}`;
      if (games.some(g => g.id === id)) throw Error("duplicate_game_identity");
      const game: NpbCsDataset["games"][number] = { id, date, stage, homeTeamId, awayTeamId, homeScore: hs, awayScore: rs, homeHits: number(fields.HH ?? ""), awayHits: number(fields.RH ?? ""), sourcePageId: p.pageid, status: "final" };
      const perGame: typeof observations = [];
      const ambiguous = new Set<string>();
      for (const table of block.slice(close + 2).matchAll(/\{\|[^\n]*class="wikitable"[^]*?\n\|\}/g)) {
        const lines = table[0].split("\n"), banner = lines.find(l => /^!\s*colspan/.test(l)) ?? "";
        const team = teams[plain(banner.slice(banner.lastIndexOf("|") + 1))];
        const header = lines.find(l => l.includes("!!")) ?? "", normalized = plain(header);
        const batting = normalized === "!打順!!守備!!選手!!打数!!安打!!本塁打!!打点!!得点!!三振!!四死球!!犠打!!盗塁";
        const pitching = normalized.endsWith("選手!!投球回!!投球数!!打者!!被安打!!被本塁打!!奪三振!!与四死球!!失点!!自責点");
        if (!team || ![home, away].includes(team) || (!batting && !pitching)) { issues.push({ date, reason: "unsupported_box_header" }); continue; }
        for (const line of lines.filter(l => /^\|(?![-}])/.test(l))) {
          const cells = split(line.slice(1), "||"); if (cells.length !== (batting ? 12 : 11)) { issues.push({ date, reason: "unsupported_box_columns" }); continue; }
          const article = /^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/.exec(cells[batting ? 2 : 1]!.trim())?.[1];
          const playerId = article ? byArticle.get(article) : null;
          if (!article || !playerId) { issues.push({ date, reason: "unverified_article_identity", ...(article ? { article } : {}) }); continue; }
          try {
            const role = batting ? "batting" : "pitching", keys = batting ? historicalBattingKeys : historicalPitchingKeys;
            const metrics: Record<string, number | null> = Object.fromEntries(keys.map(k => [k, null])); metrics.G = 1;
            if (batting) for (const [i, key] of [[3, "AB"], [4, "H"], [5, "HR"], [6, "RBI"], [7, "R"], [8, "SO"], [10, "SH"], [11, "SB"]] as const) metrics[key] = number(cells[i]!);
            else {
              metrics.outsRecorded = inningsToOuts(plain(cells[2]!));
              for (const [i, key] of [[4, "BF"], [5, "H"], [6, "HR"], [7, "SO"], [9, "R"], [10, "ER"]] as const) metrics[key] = number(cells[i]!);
              if (plain(cells[0]!) === "勝") metrics.W = 1; if (plain(cells[0]!) === "敗") metrics.L = 1;
              if (plain(cells[0]!) === "S") metrics.SV = 1; if (plain(cells[0]!) === "H") metrics.HLD = 1;
            }
            Object.assign(metrics, historicalRates(role, metrics));
            const aggregate = npbCompetitionAggregateSchema.parse({ playerId, season: 2026, teamId: `npb:team:${team}`, role, metrics, scope: { league: "NPB", season: 2026, temporalScope: "saved_current", competition: "postseason", stage } });
            const participant = `${playerId}:${role}`, duplicate = perGame.findIndex(v => v.aggregate.playerId === playerId && v.aggregate.role === role);
            if (duplicate >= 0) { perGame.splice(duplicate, 1); ambiguous.add(participant); }
            if (ambiguous.has(participant)) throw Error("duplicate_participant");
            perGame.push({ aggregate, gameId: id });
          } catch (e) { issues.push({ date, reason: `box_validation:${(e as Error).message}`, article }); }
        }
      }
      const known = (teamId: string, role: string, metric: string) => perGame.filter(r => r.aggregate.teamId === teamId && r.aggregate.role === role).reduce((sum, r) => sum + (r.aggregate.metrics[metric] ?? 0), 0);
      const mismatch = [[homeTeamId, hs, game.homeHits, rs, game.awayHits, "R"], [awayTeamId, rs, game.awayHits, hs, game.homeHits, "H"]].some(([teamId, runs, hits, opponentRuns, opponentHits, prefix]) => {
        const innings = Object.keys(fields).filter(k => new RegExp(`^${prefix}\\d+$`).test(k)).length;
        return known(String(teamId), "batting", "R") > Number(runs) || known(String(teamId), "batting", "RBI") > Number(runs) || hits !== null && known(String(teamId), "batting", "H") > Number(hits) || known(String(teamId), "pitching", "ER") > Number(opponentRuns) || opponentHits !== null && known(String(teamId), "pitching", "H") > Number(opponentHits) || known(String(teamId), "pitching", "outsRecorded") > innings * 3;
      });
      games.push(game);
      if (mismatch) issues.push({ date, reason: "box_team_totals_conflict" });
      else observations.push(...perGame);
    } catch (e) { issues.push({ date, reason: (e as Error).message }); }
  }
  return { source: { pageId: p.pageid, title: p.title, revision: rev.revid, revisionAt: rev.timestamp, contentSha256: createHash("sha256").update(original).digest("hex") }, games, observations, issues };
}
