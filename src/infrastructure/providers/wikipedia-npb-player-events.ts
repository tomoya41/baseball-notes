import { createHash } from "node:crypto";
import { z } from "zod";
import { npbPlayerEventsSchema, legacyEventTransformation, citedClauseEventTransformation, type EventIdentity, type PlayerEvent } from "../../domain/npb-player-events";
import { dateInZone } from "../../domain/analysis-query";

const pageSchema = z.object({ pageid: z.literal(5145794), title: z.literal("2026年の日本プロ野球"), revisions: z.array(z.object({ revid: z.number().int().positive(), timestamp: z.iso.datetime(), slots: z.object({ main: z.object({ content: z.string().max(1000000) }) }) })).length(1) });
const clubNames: Record<string, string> = { "読売ジャイアンツ": "giants", "阪神タイガース": "tigers", "中日ドラゴンズ": "dragons", "広島東洋カープ": "carp", "東京ヤクルトスワローズ": "swallows", "横浜DeNAベイスターズ": "baystars", "福岡ソフトバンクホークス": "hawks", "北海道日本ハムファイターズ": "fighters", "埼玉西武ライオンズ": "lions", "千葉ロッテマリーンズ": "marines", "東北楽天ゴールデンイーグルス": "eagles", "オリックス・バファローズ": "buffaloes" };
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export function parseWikipediaPlayerEvents(raw: unknown, observedAt: string, identities: readonly EventIdentity[], identityInputSha256: string) {
  const p = pageSchema.parse(raw), r = p.revisions[0]!, text = r.slots.main.content;
  if (/\{\{\s*(?:著作権侵害|Copyvio|コピペ|転載疑惑)/i.test(text)) throw Error("Article rights warning");
  if (text.includes("§REF§")) throw Error("Reserved reference marker in source");
  if (new Set(identities.map(i => i.article)).size !== identities.length) throw Error("Ambiguous article bridge");
  const articles = new Map(identities.map(i => [i.article, i]));
  // Remove self-closing references first; they must not consume the next paired reference.
  const clean = text.replace(/<!--[\s\S]*?(?:-->|$)/g, "").replace(/<ref\b[^>]*\/\s*>/gi, "§REF§").replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, "§REF§");
  let month = 0, date: string | null = null, inChronology = false, includedCitedClause = false;
  const events: PlayerEvent[] = [], issues: { date: string | null; reason: string; statementSha256: string }[] = [];
  for (const line of clean.split(/\r?\n/)) {
    if (/^==\s*できごと\s*==$/.test(line)) { inChronology = true; continue; }
    if (/^==[^=]/.test(line)) { inChronology = false; date = null; }
    if (!inChronology) continue;
    const m = /^===\s*(\d{1,2})月\s*===$/.exec(line);
    if (m) { month = Number(m[1]); date = null; continue; }
    if (/^===/.test(line)) { month = 0; date = null; continue; }
    const day = /^\*\s*\[\[(\d{1,2})月(\d{1,2})日(?:\|[^\]]+)?\]\]\s*$/.exec(line);
    if (day) {
      const d = `2026-${day[1]!.padStart(2, "0")}-${day[2]!.padStart(2, "0")}`;
      date = Number(day[1]) === month && z.iso.date().safeParse(d).success ? d : null; continue;
    }
    if (/^\*(?!\*)/.test(line)) { date = null; continue; }
    if (!/^\*\* /.test(line)) continue;
    const parts = line.slice(3).split("。"), first = parts[0]!.trim();
    // The reviewed compound announcement cites its player notice separately
    // from two coaching clauses. Admit only that exact first clause: neither
    // coaches nor a later contract offer supplies player/roster evidence.
    const citedNotice = /^(.+に対し、来季の契約を行わない旨を通知したこと)§REF§、育成総合コーチの[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー・]+が今季限りで退任すること§REF§、新任コーチ、及び来季のコーチングスタッフについて発表$/u.exec(first)?.[1];
    const statement = (citedNotice ?? first).replaceAll("§REF§", "");
    const tail = parts.slice(1).join("。").trim();
    // This source also puts a shared reference after a following uniform-number
    // sentence. It supports the event, but we never publish/infer that current number.
    const cited = first.includes("§REF§") || tail.startsWith("§REF§") || /^背番号は[0-9'→]+§REF§。?$/.test(tail);
    if (!/引退|トレード|契約|戦力外|ポスティング|FA宣言|指名/.test(statement)) continue;
    const statementSha256 = digest(statement);
    const reject = (reason: string) => issues.push({ date, reason, statementSha256 });
    if (/@\w+@/.test(statement)) { reject("reserved_parser_marker"); continue; }
    if (!date || date > dateInZone(Date.parse(observedAt), "Asia/Tokyo")) { reject("missing_or_future_source_date"); continue; }
    if (!cited) { reject("missing_statement_citation"); continue; }
    const linked: EventIdentity[] = [], unresolvedArticles: string[] = [], participants: (EventIdentity | null)[] = [];
    let normalized = statement.replace(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g, (_all, title: string) => {
      const identity = articles.get(title);
      if (!identity) {
        if (clubNames[title]) return title;
        unresolvedArticles.push(title); participants.push(null); return "@UNRESOLVED@";
      }
      linked.push(identity); participants.push(identity); return "@PLAYER@";
    }).replace(/'''?/g, "");
    if (!linked.length || new Set(linked.map(p => p.playerId)).size !== linked.length) { reject("missing_or_duplicate_explicit_player_articles"); continue; }
    for (const [name, code] of Object.entries(clubNames)) normalized = normalized.replaceAll(name, `@${code}@`);
    if (/[[\]{}<>「」『』]/.test(normalized)) { reject("unsupported_or_quoted_statement"); continue; }
    let kind: PlayerEvent["kind"] | undefined, clubs: string[] = [], from: string | null = null, to: string | null = null;
    const trade = /^@(\w+)@の@PLAYER@が金銭トレードで@(\w+)@に移籍することを両球団が発表$/.exec(normalized);
    const retirement = /^@(\w+)@は、@PLAYER@(?:が|の)今季限りで(?:の)?現役(?:を)?引退(?:することを|すると|を)発表$/.exec(normalized);
    const playerRetirement = /^@(\w+)@の@PLAYER@が、今季限りでの現役引退を発表$/.exec(normalized);
    const pairRetirement = /^@(\w+)@は、@PLAYER@と@PLAYER@が今季限りで現役を引退することを発表$/.exec(normalized);
    const registration = /^@(\w+)@は、育成選手の@PLAYER@と支配下(?:選手)?契約を(?:締結した(?:ことを|と)|結んだ(?:ことを|と))発表$/.exec(normalized);
    const signing = /^@(\w+)@は、@PLAYER@と(?:今季の)?(?:育成選手)?契約(?:を(?:締結したこと|結んだこと)|合意した)(?:を|と)発表$/.exec(normalized);
    const renewal = /^@(\w+)@は、@PLAYER@と(?:の契約更改(?:を終えたと|に合意したと)|(?:来季の)?契約を更改した(?:と|ことを))発表$/.exec(normalized);
    const release = /^@(\w+)@は、@PLAYER@に自由契約を通達したと発表$/.exec(normalized);
    // A shared notice can be split only for independently admitted participants,
    // when every list entry is an article link, the explicit headcount matches,
    // and the entire sentence has one meaning. Unresolved entries get no IDs.
    // No retirement, development offer or free-agency status is inferred from it.
    const nonrenewal = /^@(\w+)@は、(?:育成(?:契約)?の)?(@(?:PLAYER|UNRESOLVED)@(?:、(?:育成の)?@(?:PLAYER|UNRESOLVED)@)*)(?:の([1-9]\d?)選手)?(?:に(?:対し)?|へ)、?(?:来季の契約を結ばない旨を通知したことを|来季の契約は締結しない旨を通達したと|来季契約を行わない旨を通知した(?:と|ことを)|来季の契約を行わない旨を通告したと|来季の契約を結ばないことを通告したと|来季契約を結ばない旨を通知したと|来季契約を結ばないことを通告したと|来季の契約を結ばないことを通達したと|来季の(?:選手)?契約を締結しない旨を通達したことを)発表$/.exec(normalized);
    const releaseList = /^@(\w+)@は、(?:育成の)?(@(?:PLAYER|UNRESOLVED)@(?:、(?:育成の)?@(?:PLAYER|UNRESOLVED)@)*)(?:の([1-9]\d?)選手)?に自由契約とすることを通知したと発表$/.exec(normalized);
    // A bare name is an unresolved list position, never an identity lookup.
    // Count all positions before emitting any independently linked recipient.
    const compoundNotice = citedNotice && /^@(\w+)@は、(.+)の([1-9]\d?)選手に対し、来季の契約を行わない旨を通知したこと$/.exec(normalized);
    const noticeEntries = compoundNotice?.[2]?.split("、");
    const unlinkedEntries = noticeEntries?.filter(entry => !/^@(?:PLAYER|UNRESOLVED)@$/.test(entry)) ?? [];
    const compoundCountMatches = compoundNotice && noticeEntries && noticeEntries.length === Number(compoundNotice[3]) &&
      noticeEntries.every(entry => /^@(?:PLAYER|UNRESOLVED)@$/.test(entry) || /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー・]{1,24}$/u.test(entry)) &&
      noticeEntries.length === participants.length + unlinkedEntries.length &&
      new Set(unlinkedEntries).size === unlinkedEntries.length && new Set(unresolvedArticles).size === unresolvedArticles.length;
    // This exact two-clause form states two different actions. Keep the article
    // positions (including unresolved participants) so the final player's release
    // cannot be attributed to anyone in the preceding nonrenewal list.
    const mixed = /^@(\w+)@は、(@(?:PLAYER|UNRESOLVED)@(?:、@(?:PLAYER|UNRESOLVED)@)*)の([1-9]\d?)選手に来季の契約を結ばないことを通知したこと、@(?:PLAYER|UNRESOLVED)@を自由契約とすることを発表$/.exec(normalized);
    const noticeParticipants = mixed?.[2]?.match(/@(?:PLAYER|UNRESOLVED)@/g)?.length;
    let selected: { identity: EventIdentity; kind: PlayerEvent["kind"] }[] | undefined;
    const listedCount = linked.length + unresolvedArticles.length;
    const noticeCountMatches = nonrenewal && (nonrenewal[3] ? Number(nonrenewal[3]) === listedCount : listedCount === 1) && new Set(unresolvedArticles).size === unresolvedArticles.length;
    const releaseCountMatches = releaseList && (releaseList[3] ? Number(releaseList[3]) === listedCount : listedCount === 1) && new Set(unresolvedArticles).size === unresolvedArticles.length;
    if (mixed && noticeParticipants === Number(mixed[3]) && participants.length === noticeParticipants + 1 && new Set(unresolvedArticles).size === unresolvedArticles.length) {
      clubs = [mixed[1]!];
      selected = participants.flatMap((identity, index) => identity ? [{ identity, kind: index < noticeParticipants ? "nonrenewal_notice" as const : "release" as const }] : []);
      if (unresolvedArticles.length) reject("unresolved_clause_participants");
    }
    else if (noticeCountMatches) { kind = "nonrenewal_notice"; clubs = [nonrenewal[1]!]; if (unresolvedArticles.length) reject("unresolved_notice_participants"); }
    else if (releaseCountMatches) { kind = "release"; clubs = [releaseList[1]!]; if (unresolvedArticles.length) reject("unresolved_release_participants"); }
    else if (compoundCountMatches) { kind = "nonrenewal_notice"; clubs = [compoundNotice[1]!]; if (unresolvedArticles.length || unlinkedEntries.length) reject("unresolved_notice_participants"); }
    else if (pairRetirement && linked.length === 2 && !unresolvedArticles.length) { clubs = [pairRetirement[1]!]; selected = linked.map(identity => ({ identity, kind: "retirement_announcement" })); }
    else if (unresolvedArticles.length) { reject("unresolved_article_outside_notice_list"); continue; }
    else if (linked.length !== 1) { reject("unsupported_multiple_player_statement"); continue; }
    else if (trade) { kind = "trade"; clubs = [trade[1]!, trade[2]!]; from = `npb:team:${trade[1]}`; to = `npb:team:${trade[2]}`; }
    else if (retirement) { kind = "retirement_announcement"; clubs = [retirement[1]!]; }
    else if (playerRetirement) { kind = "retirement_announcement"; clubs = [playerRetirement[1]!]; }
    else if (registration) { kind = "registration_change"; clubs = [registration[1]!]; }
    else if (renewal) { kind = "contract_renewal"; clubs = [renewal[1]!]; }
    else if (signing) { kind = "signing"; clubs = [signing[1]!]; }
    else if (release) { kind = "release"; clubs = [release[1]!]; }
    if (!kind && !selected) { reject("unsupported_event_grammar"); continue; }
    const excerpt = statement.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, title: string, label?: string) => label ?? title).replace(/'''?/g, "") + "。";
    if (excerpt.length > 300) { reject("statement_budget_exceeded"); continue; }
    for (const { identity, kind: eventKind } of selected ?? linked.map(identity => ({ identity, kind: kind! }))) {
      const id = `npb:event:${digest(JSON.stringify([date, eventKind, identity.playerId, clubs])).slice(0, 24)}`;
      if (events.some(e => e.id === id)) { reject("duplicate_statement"); continue; }
      if (compoundCountMatches) includedCitedClause = true;
      events.push({ id, kind: eventKind, playerId: identity.playerId, recordedDate: date, announcementDate: null, effectiveDate: null, status: "encyclopedia_record", relatedTeamIds: clubs.map(c => `npb:team:${c}`), fromTeamId: from, toTeamId: to, sourceRevision: r.revid, statementSha256, excerpt });
    }
  }
  const used = new Set(events.map(e => e.playerId));
  const dataset = npbPlayerEventsSchema.parse({ schemaVersion: 1, league: "NPB", season: 2026, coverage: "partial", provider: "Wikipedia", license: "CC-BY-SA-4.0", observedAt,
    source: { provider: "Wikipedia", pageId: p.pageid, title: p.title, revision: r.revid, revisionAt: r.timestamp, contentSha256: digest(text), url: `https://ja.wikipedia.org/w/index.php?curid=${p.pageid}&oldid=${r.revid}`, license: "CC-BY-SA-4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" },
    identityInputSha256, players: identities.filter(i => used.has(i.playerId)), events: events.sort((a, b) => b.recordedDate.localeCompare(a.recordedDate) || a.id.localeCompare(b.id)),
    transformation: includedCitedClause ? citedClauseEventTransformation : legacyEventTransformation });
  return { dataset, issues };
}
