import { createHash } from "node:crypto";
import { z } from "zod";
import { npbCs2026FinalRule } from "../../domain/npb-cs-rules";
import { npbPostseasonSeriesSchema, assertCsSeriesSnapshot } from "../../domain/npb-postseason-series";
import { npbCsDatasetSchema } from "../../domain/npb-cs-observations";
import type { PostseasonSeries } from "../../domain/competition";

const clubs: Record<string, string> = { 福岡ソフトバンクホークス: "hawks", 北海道日本ハムファイターズ: "fighters", 埼玉西武ライオンズ: "lions", 阪神タイガース: "tigers", 横浜DeNAベイスターズ: "baystars", 読売ジャイアンツ: "giants" };
const archiveSchema = z.object({ observedAt: z.iso.datetime(), response: z.object({ query: z.object({ pages: z.array(z.object({
  pageid: z.number().int(), title: z.string(), revisions: z.array(z.object({ revid: z.number().int(), timestamp: z.iso.datetime(), slots: z.object({ main: z.object({ content: z.string() }) }) })).length(1),
})).length(2) }) }) });
const plain = (text: string) => text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a: string, b?: string) => b ?? a).trim();
function fields(text: string) {
  const match = /\{\{Infobox 日本プロ野球プレーオフ\s*\n/.exec(text.replace(/<!--[\s\S]*?-->/g, ""));
  const source = text.replace(/<!--[\s\S]*?-->/g, "");
  if (!match) throw Error("Missing reviewed series infobox");
  let depth = 1, link = 0, start = match.index + match[0].length;
  const parts: string[] = [];
  for (let i = start; i < source.length - 1; i++) {
    const pair = source.slice(i, i + 2);
    if (pair === "[[") { link++; i++; } else if (pair === "]]") { link--; i++; }
    else if (pair === "{{") { depth++; i++; } else if (pair === "}}") {
      depth--; if (!depth) { parts.push(source.slice(start, i)); break; } i++;
    } else if (source[i] === "|" && depth === 1 && link === 0) { parts.push(source.slice(start, i)); start = i + 1; }
  }
  if (depth || link) throw Error("Unclosed series infobox");
  const result: Record<string, string> = {};
  for (const part of parts) { const eq = part.indexOf("="); if (eq < 0) continue;
    const key = part.slice(0, eq).trim(); if (key in result) throw Error("Duplicate series field"); result[key] = plain(part.slice(eq + 1));
  }
  return result;
}
/** IDs depend on article identity + stage, never a mutable winner, score or revision. */
export function npbSeriesId(pageId: number, stage: string) {
  const b = createHash("sha256").update(`baseball-notes:npb:series:v1:2026:${pageId}:${stage}`).digest().subarray(0, 16);
  b[6] = (b[6]! & 15) | 80; b[8] = (b[8]! & 63) | 128;
  const h = b.toString("hex"); return `npb:series:${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export function buildWikipediaNpbSeries(raw: unknown, saved: unknown, baseBodySha256: string) {
  const archive = archiveSchema.parse(raw), cs = npbCsDatasetSchema.parse(saved);
  if (archive.observedAt !== cs.observedAt) throw Error("Archive observation mismatch");
  const series: PostseasonSeries[] = [];
  for (const page of archive.response.query.pages) {
    const rev = page.revisions[0]!, source = cs.sources.find(s => s.pageId === page.pageid);
    if (!source || source.title !== page.title || source.revision !== rev.revid || source.revisionAt !== rev.timestamp ||
      source.contentSha256 !== createHash("sha256").update(rev.slots.main.content).digest("hex")) throw Error("Unpinned series source");
    const f = fields(rev.slots.main.content);
    if (f["開催年"] !== "2026" || f["リーグ"] !== (page.pageid === 5301694 ? "パ" : page.pageid === 5302364 ? "セ" : "")) throw Error("Unsupported series year/league");
    const team = (key: string) => { const club = clubs[f[key] ?? ""]; if (!club) throw Error(`Unknown series club: ${key}`); return `npb:team:${club}`; };
    const integer = (key: string) => { if (!/^\d{1,3}$/.test(f[key] ?? "")) throw Error(`Missing independent standings: ${key}`); return Number(f[key]); };
    const firstWinner = team("CS1優勝"), leader = team("1位");
    if (new Set([leader, team("2位"), team("3位")]).size !== 3 || ![team("2位"), team("3位")].includes(firstWinner)) throw Error("Series standings identity mismatch");
    for (const [key, stage] of [["CS1", "npb_cs_first"], ["CSF", "npb_cs_final"]] as const) {
      const winner = team(`${key}優勝`), opponent = team(`${key}対戦相手`), id = npbSeriesId(page.pageid, stage);
      const final = stage === "npb_cs_final", challenger = winner === leader ? opponent : winner;
      if (winner === opponent || (final ? challenger !== firstWinner || ![winner, opponent].includes(leader) : ![team("2位"), team("3位")].includes(opponent))) throw Error("Unverified series participants");
      const rank = challenger === team("2位") ? "2位" : "3位";
      const evidence = { season: 2026 as const, leaderTeamId: leader, challengerTeamId: challenger,
        leader: { wins: integer("1位勝"), losses: integer("1位負") }, challenger: { wins: integer(`${rank}勝`), losses: integer(`${rank}負`) },
        standingsEvidenceUrl: `https://ja.wikipedia.org/w/index.php?curid=${page.pageid}&oldid=${rev.revid}`, observedAt: cs.observedAt };
      const rule = final ? npbCs2026FinalRule(evidence) : { advantageWins: 0, maxPlayedGames: 3, winsRequired: 2 };
      const summary = /^(\d+)勝(\d+)敗(?:（(?:([12])勝のアドバンテージ|アドバンテージの([12])敗)を含む）)?$/.exec(f[`${key}勝敗`] ?? "");
      const games = cs.games.filter(g => g.sourcePageId === page.pageid && g.stage === stage).slice().sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).map((g,i) => ({ gameId: g.id, date: g.date, gameNumber: i + 1,
        homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId, homeRuns: g.homeScore, awayRuns: g.awayScore, status: g.status, scheduledAt: null,
        winnerId: g.homeScore > g.awayScore ? g.homeTeamId : g.awayScore > g.homeScore ? g.awayTeamId : null }));
      const teams = [winner, opponent].map(teamId => { const playedWins = games.filter(g => g.winnerId === teamId).length, advantageWins = final && teamId === leader ? rule.advantageWins : 0; return { teamId, playedWins, advantageWins, seriesTotal: playedWins + advantageWins }; });
      if (!summary || !games.length || games.length > rule.maxPlayedGames || Number(summary[1]) !== teams[0]!.seriesTotal || Number(summary[2]) !== teams[1]!.seriesTotal ||
        (final ? winner === leader ? Number(summary[3]) !== rule.advantageWins || !!summary[4] : Number(summary[4]) !== rule.advantageWins || !!summary[3] : !!summary[3] || !!summary[4]) ||
        teams[0]!.seriesTotal !== rule.winsRequired || teams[1]!.seriesTotal >= rule.winsRequired || games.at(-1)!.winnerId !== winner || team("優勝チーム") !== team("CSF優勝")) throw Error("Series summary/Game/rule mismatch");
      series.push({ id, league: "NPB", season: 2026, competitionType: "postseason", round: stage, name: `${f["リーグ"]}・リーグ ${final ? "CS ファイナル" : "CS ファースト"}`,
        bestOf: rule.maxPlayedGames, winsRequired: rule.winsRequired, ...(final ? { npbFinalRuleEvidence: evidence } : {}), teams, games,
        status: "complete", winnerId: winner, clinched: true, clinchReason: "wins_required", advancesToSeriesId: final ? null : npbSeriesId(page.pageid, "npb_cs_final"), effectiveDate: games.at(-1)!.date });
    }
  }
  const data = npbPostseasonSeriesSchema.parse({ schemaVersion: 1, league: "NPB", season: 2026, competition: "postseason", provider: "Wikipedia", license: "CC-BY-SA-4.0", coverage: "partial", observedAt: cs.observedAt, baseBodySha256,
    transformation: "Pinned article infobox series outcomes and standings normalized; scores joined to the unchanged CS Game release. Rule advantage kept separate from played wins. No Regular/Game/player Facts added.", sources: cs.sources, series });
  assertCsSeriesSnapshot(data, cs); return data;
}
