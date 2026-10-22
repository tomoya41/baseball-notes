import { z } from "zod";
import { draftEventSchema, type DraftEvent } from "../../domain/npb-draft-event";
import { applyReviewedDraftResults, draftCandidateId, draftHash, draftTeamFullNames } from "./wikipedia-npb-draft";

type Kind = "regular" | "developmental";
type PersonCell = { name: string; article: string | null };
type MatrixCell = PersonCell & { teamId: string; type: Kind; round: number; attempt: number | null; row: string };
type ResultRow = PersonCell & { teamId: string; type: Kind; round: number; position: "投手" | "捕手" | "内野手" | "外野手"; affiliation: string; row: string; evidenceSha256: string; matrixRow: string };
const nameCell = (raw: string): PersonCell | null => {
  // Explicit display-only wrappers and a line break inside a displayed name do not create an identity.
  const value = raw.trim().replace(/^'''(.*)'''$/, "$1").replace(/^<small>(.*)<\/small>$/, "$1").replace(/<br\s*\/?>/g, "");
  const provisional = value.match(/^\{\{仮リンク\|([^|{}<>]+)\|(?:label=([^|{}<>]+)\|)?(?:en|ko)\|[^|{}<>]+\}\}$/);
  const linked = value.match(/^\[\[([^[\]|<>#]+)(?:\|([^[\]<>]+))?\]\]$/);
  const name = provisional ? provisional[2] ?? provisional[1]! : linked ? linked[2] ?? linked[1]! : value;
  if (!/^[\p{L}\p{M}\s々ー・.-]{2,80}$/u.test(name)) return null;
  return { name, article: linked?.[1] ?? null };
};
const key = (r: { teamId: string; type: Kind; round: number }) => `${r.teamId}:${r.type}:${r.round}`;

/** Only the explicitly headed 2026 table. Styles are discarded, never treated as lottery wins. */
function matrixCells(content: string) {
  const sections = content.split("== 指名選手一覧 ==\n");
  if (sections.length !== 2) throw Error("Unverified result matrix section");
  const blocks = sections[1]!.split("== 球団別指名選手一覧 ==")[0]!.split("|-\n").map(s => s.trim());
  const headers = blocks.filter(b => b.startsWith("!指名順\n"));
  if (headers.length !== 1) throw Error("Unverified result matrix header");
  const teams = [...headers[0]!.matchAll(/\[\[(2026年の[^\]|]+)\|[^\]]+\]\]/g)].map(m => {
    const team = Object.entries(draftTeamFullNames).find(([, name]) => m[1] === `2026年の${name}`);
    if (!team) throw Error("Unknown result matrix team"); return `npb:team:${team[0]}`;
  });
  if (teams.length !== 12 || new Set(teams).size !== 12) throw Error("Result matrix needs twelve unique explicit teams");
  let type: Kind | null = null;
  const cells: MatrixCell[] = [], seen = new Set<string>();
  for (const block of blocks) {
    if (/^!\s*colspan="13"\s*\|支配下選手$/.test(block.split("\n")[0]!)) { type = "regular"; continue; }
    if (/^!\s*colspan="13"\s*\|育成選手$/.test(block)) { type = "developmental"; continue; }
    const lines = block.replace(/\n\|\}$/, "").split("\n"), bid = lines[0]!.match(/^!1巡目([1-9]\d*)$/), selection = lines[0]!.match(/^!([1-9]\d*)巡目[→←]$/);
    if (!bid && !selection) continue;
    if (!type || bid && type !== "regular" || lines.length !== 13 || lines.slice(1).some(l => !l.startsWith("|"))) throw Error("Unsupported result matrix structure");
    const round = bid ? 1 : Number(selection![1]), attempt = bid ? Number(bid[1]) : null;
    for (let i = 0; i < 12; i++) {
      const slot = `${type}:${round}:${attempt}:${teams[i]}`; if (seen.has(slot)) throw Error("Duplicate matrix slot"); seen.add(slot);
      const raw = lines[i + 1]!.replace(/^\|style=background-color:#[a-f0-9]{3};font-weight:(?:heavy|normal)\|/, "|").slice(1).trim();
      if (!raw || raw === "---") continue;
      const person = nameCell(raw); if (!person) continue; // The corresponding team row is quarantined below.
      cells.push({ ...person, teamId: teams[i]!, type, round, attempt, row: lines.join("\n") });
    }
  }
  return cells;
}

/** Plain names remain source/slot-scoped observations, never automatic canonical player identities. */
export function draftUnlinkedResultId(r: Pick<ResultRow, "teamId" | "type" | "round" | "name" | "affiliation">) {
  return `npb:draft:2026:${draftHash(JSON.stringify(["unlinked-result-observation", 5282993, r.teamId, r.type, r.round, r.name, r.affiliation])).slice(0, 24)}`;
}
export const draftResultRowId = (r: ResultRow) => r.article ? draftCandidateId(r.article, r.affiliation) : draftUnlinkedResultId(r);

export function auditDraft2026ResultTables(content: string) {
  const matrices = matrixCells(content), sections = content.split("== 球団別指名選手一覧 ==\n");
  if (sections.length !== 2) throw Error("Unverified team result section");
  const rows: ResultRow[] = [], quarantine: { teamId: string; type: Kind | null; round: number | null; evidenceSha256: string; reason: string }[] = [], teams: string[] = [];
  for (const [id, name] of Object.entries(draftTeamFullNames)) {
    const parts = sections[1]!.split(`=== ${name} ===\n`); if (parts.length === 1) continue; if (parts.length !== 2) throw Error("Duplicate team result section");
    const teamId = `npb:team:${id}`; teams.push(teamId); let type: Kind | null = null, header = false;
    for (const raw of parts[1]!.split(/\n==+ /)[0]!.split("|-\n")) {
      const block = raw.trim().replace(/^\{\| class="wikitable"\n/, ""), mode = block.match(/^!\s*colspan="5"\s*\|(新人選手選択会議|育成選手選択会議)$/);
      if (mode) { type = mode[1] === "新人選手選択会議" ? "regular" : "developmental"; header = false; continue; }
      if (block === "!順位!!選手名!!守備!!所属!!結果") { if (!type) throw Error("Result scope missing"); header = true; continue; }
      const lines = block.replace(/\n\|\}$/, "").split("\n"), rank = lines[0]!.match(/^!(?:''')?([1-9]\d*)位(?:''')?$/);
      if (!rank) { if (/^!.*位/.test(lines[0]!)) throw Error("Unsupported result rank"); continue; }
      const round = Number(rank[1]), row = lines.join("\n");
      const reject = (reason: string) => quarantine.push({ teamId, type, round, evidenceSha256: draftHash(row), reason });
      if (!type || !header) { reject("unverified_scope_or_header"); continue; }
      const cells = lines.length === 2 && lines[1]!.startsWith("|") ? lines[1]!.slice(1).split("||").map(s => s.trim()) : lines.length === 5 && lines.slice(1).every(l => l.startsWith("|") && !l.includes("||")) ? lines.slice(1).map(l => l.slice(1).trim()) : [];
      if (cells.length !== 4) { reject("unsupported_row_shape"); continue; }
      if (cells.every(c => !c || c === "---")) continue; // Empty source cells never become results.
      const person = nameCell(cells[0]!), school = nameCell(cells[2]!);
      if (!person || !school || !["投手", "捕手", "内野手", "外野手"].includes(cells[1]!)) { reject("unsupported_identity_or_position"); continue; }
      const matches = matrices.filter(m => m.teamId === teamId && m.type === type && m.round === round && m.name === person.name);
      if (matches.length !== 1 || person.article && matches[0]!.article && person.article !== matches[0]!.article) { reject("matrix_team_table_conflict"); continue; }
      rows.push({ ...person, article: person.article ?? matches[0]!.article, teamId, type, round, position: cells[1] as ResultRow["position"], affiliation: school.name, row, evidenceSha256: draftHash(row), matrixRow: matches[0]!.row });
    }
  }
  // Ambiguous same-name/school observations are held on both sides, never first-row-wins.
  const accepted = rows.filter(r => {
    if (rows.filter(other => key(other) === key(r) || other.name === r.name && other.affiliation === r.affiliation).length === 1) return true;
    quarantine.push({ teamId: r.teamId, type: r.type, round: r.round, evidenceSha256: r.evidenceSha256, reason: "ambiguous_duplicate_observation" }); return false;
  });
  const groups: { name: string; article: string | null; attempt: number; teamIds: string[]; evidenceSha256: string }[] = [];
  for (const m of matrices.filter(m => m.attempt !== null)) {
    if (groups.some(g => g.attempt === m.attempt && g.name === m.name)) continue;
    const bids = matrices.filter(b => b.attempt === m.attempt && b.name === m.name && b.article === m.article);
    if (bids.length > 1) groups.push({ name: m.name, article: m.article, attempt: m.attempt!, teamIds: bids.map(b => b.teamId), evidenceSha256: draftHash(m.row) });
  }
  return { rows: accepted, quarantine, teams, groups };
}

const reviewedRow = z.strictObject({ teamId: z.string(), type: z.enum(["regular", "developmental"]), round: z.number().int().positive(), evidenceSha256: z.string().regex(/^[a-f0-9]{64}$/) });
const reviewSchema = z.strictObject({ format: z.literal("2026_tables"), reviewedBy: z.string().min(1).max(80), reviewedAt: z.iso.datetime(), eventState: z.enum(["in_progress", "ended"]), eventProof: z.strictObject({ pageId: z.literal(5282993), row: z.string() }), completionRow: z.string().optional(), selections: z.array(reviewedRow), lotteries: z.array(z.strictObject({ attempt: z.number().int().positive(), name: z.string(), evidenceSha256: z.string().regex(/^[a-f0-9]{64}$/) })) });

export function applyReviewedDraft2026Results(base: DraftEvent, content: string, raw: unknown, observedAt: string, buildTime = Date.now()) {
  const review = reviewSchema.parse(raw), audit = auditDraft2026ResultTables(content);
  // Reuse dated retrospective-event and fetch/review/build-time checks; this does not infer completion from a clock.
  const d = applyReviewedDraftResults(base, content, { reviewedBy: review.reviewedBy, reviewedAt: review.reviewedAt, eventState: "in_progress", eventProof: review.eventProof, selections: [], lotteries: [] }, observedAt, buildTime);
  if (review.eventState === "ended") {
    const row = review.completionRow;
    if (!row || content.split("\n").filter(l => l === row).length !== 1 || row.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>|<ref\b[^>]*\/>/g, "") !== "なお、今回は育成選手選択会議が終了した後にスペシャルトークショーを開催した。") throw Error("Missing explicit retrospective completion evidence");
    d.eventState = "ended";
  }
  for (const entry of review.selections) {
    const matches = audit.rows.filter(r => key(r) === key(entry) && r.evidenceSha256 === entry.evidenceSha256);
    if (matches.length !== 1) throw Error("Unreviewed or quarantined 2026 result");
    const r = matches[0]!, id = draftResultRowId(r), existing = d.candidates.find(c => c.id === id);
    if (existing && (existing.name !== r.name || existing.article !== r.article || existing.affiliation !== r.affiliation)) throw Error("Conflicting result observation identity");
    if (!existing) d.candidates.push({ id, name: r.name, article: r.article, affiliation: r.affiliation, position: r.position, throws: "未確認", bats: "未確認", eligibility: "unverified", context: "記事の指名結果・当時の所属。入団・現在所属の認定ではありません", sourcePageId: 5282993, evidenceSha256: r.evidenceSha256 });
    d.selections.push({ teamId: r.teamId, candidateId: id, type: r.type, round: r.round, status: "confirmed", sourcePageId: 5282993, evidenceSha256: r.evidenceSha256 });
  }
  for (const entry of review.lotteries) {
    const groups = audit.groups.filter(g => g.attempt === entry.attempt && g.name === entry.name && g.evidenceSha256 === entry.evidenceSha256);
    if (groups.length !== 1) throw Error("Unreviewed matrix lottery group"); const g = groups[0]!;
    const targets = d.selections.filter(s => s.type === "regular" && s.round === 1 && g.teamIds.includes(s.teamId)).map(s => d.candidates.find(c => c.id === s.candidateId)!).filter(c => c.name === g.name && c.article === g.article);
    if (targets.length !== 1) throw Error("Ambiguous lottery target observation");
    // Direct initial bids are known; styling/final selection alone never becomes an explicit draw-winner fact.
    d.lotteries.push({ attempt: g.attempt, candidateId: targets[0]!.id, teamIds: g.teamIds, winnerId: null, sourcePageId: 5282993, evidenceSha256: g.evidenceSha256 });
  }
  return draftEventSchema.parse(d);
}
