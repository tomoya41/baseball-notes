import { expect, it } from "vitest";
import { auditDraft2026ResultTables, applyReviewedDraft2026Results, draftUnlinkedResultId } from "../src/infrastructure/providers/wikipedia-npb-draft-results";
import { draftTeamFullNames, draftHash, assertCarriedDraftEvidence } from "../src/infrastructure/providers/wikipedia-npb-draft";
import { assertDraftSnapshotAdvance } from "../src/domain/npb-draft-event";
import { draftFixture } from "./fixtures/npb-draft";

// Fictional people/rows/revisions only; actual source bodies remain in private archives.
const event = "'''2026年度新人選手選択会議'''は2026年10月22日に開催された第62回のドラフト会議。";
const completion = "なお、今回は育成選手選択会議が終了した後にスペシャルトークショーを開催した。";
const teams = Object.keys(draftTeamFullNames), observedAt = "2026-10-23T00:00:00Z", reviewedAt = "2026-10-23T00:01:00Z", buildTime = Date.parse("2026-10-23T00:02:00Z");
function fixture(name = "架空三", matrixName = `[[${name}]]`, school = "[[架空大学]]") {
  const matrixRow = (title: string, tiger: string, dragon: string) => `${title}\n${teams.map(t => `|${t === "tigers" ? tiger : t === "dragons" ? dragon : "---"}`).join("\n")}`;
  const header = teams.map(t => `![[2026年の${draftTeamFullNames[t]}|表示名]]`).join("\n");
  const table = (team: string, first: string, dev = "") => `=== ${draftTeamFullNames[team]} ===\n{| class="wikitable"\n!colspan="5"|新人選手選択会議\n|-\n!順位!!選手名!!守備!!所属!!結果\n|-\n!1位\n| ${first} || 投手 || [[架空大学]]||\n|-${dev ? `\n! colspan="5" |育成選手選択会議\n|-\n!順位!!選手名!!守備!!所属!!結果\n|-\n!'''1位'''\n|${name}\n|外野手\n|${school}\n|\n|-` : ""}\n|}\n`;
  return `${event}\n${completion}\n== 指名選手一覧 ==\n{| class="wikitable"\n|-\n!colspan="13"|支配下選手\n|-\n!指名順\n${header}\n|-\n${matrixRow("!1巡目1", "[[架空一]]", "[[架空一]]")}\n|-\n${matrixRow("!1巡目2", "---", "[[架空二]]")}\n|-\n!colspan="13"|育成選手\n|-\n${matrixRow("!1巡目→", matrixName, "---")}\n|}\n== 球団別指名選手一覧 ==\n${table("tigers", "架空一", "yes")}\n${table("dragons", "架空二")}`;
}
function base() { const d = draftFixture(); d.sources.push({ ...d.sources[0]!, pageId: 5282993, title: "架空のドラフト記事", revision: 2 }); return d; }
function review(content: string, ended = true) { const a = auditDraft2026ResultTables(content); return { format: "2026_tables", reviewedBy: "fixture reviewer", reviewedAt, eventState: ended ? "ended" : "in_progress", eventProof: { pageId: 5282993, row: event }, ...(ended ? { completionRow: completion } : {}), selections: a.rows.map(r => ({ teamId: r.teamId, type: r.type, round: r.round, evidenceSha256: r.evidenceSha256 })), lotteries: a.groups.map(g => ({ attempt: g.attempt, name: g.name, evidenceSha256: g.evidenceSha256 })) }; }
const apply = (content: string, r: unknown = review(content)) => applyReviewedDraft2026Results(base(), content, r, observedAt, buildTime);

it("checks horizontal/vertical/bold-rank rows against explicit matrix team columns", () => {
  const a = auditDraft2026ResultTables(fixture()); expect(a.rows).toHaveLength(3); expect(a.quarantine).toEqual([]);
  expect(a.rows.map(r => r.type)).toEqual(["regular", "developmental", "regular"]);
  expect(a.rows[0]).toMatchObject({ teamId: "npb:team:tigers", name: "架空一", article: "架空一", affiliation: "架空大学" });
});
it("supports only explicit display wrappers and provisional links, without inventing Japanese article identities", () => {
  for (const [row, matrix, school] of [
    ["架空三", "<small>[[架空三|架空<br/>三]]</small>", "[[架空大学]]"],
    ["{{仮リンク|架空三|ko|가상}}", "{{仮リンク|架空三|ko|가상}}", "{{仮リンク|架空校|label=架空大学|en|Example College}}"],
  ]) { const a = auditDraft2026ResultTables(fixture(row, matrix, school)); expect(a.rows).toHaveLength(3); expect(a.quarantine).toEqual([]); const c = a.rows.find(r => r.type === "developmental")!; expect(c.name).toBe("架空三"); expect(c.affiliation).toBe("架空大学"); if (row.startsWith("{{")) expect(c.article).toBeNull(); }
});
it("holds conflicting or unsupported rows rather than normalizing names or filling missing cells", () => {
  const conflict = auditDraft2026ResultTables(fixture("架空邊", "[[架空辺]]")); expect(conflict.rows).toHaveLength(2); expect(conflict.quarantine[0]!.reason).toBe("matrix_team_table_conflict");
  const unknown = auditDraft2026ResultTables(fixture("{{不明|架空三}}")); expect(unknown.rows).toHaveLength(2); expect(unknown.quarantine[0]!.reason).toBe("unsupported_identity_or_position");
  const missing = auditDraft2026ResultTables(fixture().replace("|外野手\n|[[架空大学]]\n|", "|\n|[[架空大学]]\n|")); expect(missing.rows).toHaveLength(2);
  expect(() => auditDraft2026ResultTables(fixture().replace("2026年の読売ジャイアンツ", "2025年の読売ジャイアンツ"))).toThrow(/twelve/);
});
it("records result observations, preserves all frozen data and never infers lottery winners from styles", () => {
  const text = fixture(), prior = base(), d = apply(text); expect(d.selections).toHaveLength(3); expect(d.coverage).toBe("partial"); expect(d.eventState).toBe("ended");
  expect(d.lotteries).toHaveLength(1); expect(d.lotteries[0]!.winnerId).toBeNull(); expect(d.forecast).toEqual(prior.forecast); expect(d.candidates[0]).toEqual(prior.candidates[0]);
  expect(d.candidates.every(c => c.id.startsWith("npb:draft:2026:"))).toBe(true); expect(() => assertDraftSnapshotAdvance(prior, d)).not.toThrow(); expect(apply(text)).toEqual(d);
  const styled = text.replace("|[[架空一]]", "|style=background-color:#ffc;font-weight:heavy|[[架空一]]"); expect(apply(styled).lotteries[0]!.winnerId).toBeNull();
});
it("requires unique row-hash review and actual dated completion evidence", () => {
  const text = fixture(), r = review(text); r.selections[0]!.evidenceSha256 = "0".repeat(64); expect(() => apply(text, r)).toThrow(/Unreviewed/);
  const duplicate = review(text); duplicate.selections.push(duplicate.selections[0]!); expect(() => apply(text, duplicate)).toThrow();
  const future = text.replace(completion, completion.replace("開催した", "開催する予定")); const planned = { ...review(future, false), eventState: "ended", completionRow: future.split("\n")[1] }; expect(() => apply(future, planned)).toThrow(/completion/);
  expect(() => applyReviewedDraft2026Results(base(), text, { ...review(text), reviewedAt: "2026-10-22T07:00:00Z" }, observedAt, buildTime)).toThrow(/review time/);
});
it("keeps plain, unlinked names scoped to the exact result observation", () => {
  const a = { teamId: "npb:team:tigers", type: "regular" as const, round: 1, name: "架空一", affiliation: "架空大学" };
  expect(draftUnlinkedResultId(a)).not.toBe(draftUnlinkedResultId({ ...a, teamId: "npb:team:dragons" }));
  const d = apply(fixture("架空三", "架空三")); const s = d.selections.find(s => s.type === "developmental")!, c = d.candidates.find(c => c.id === s.candidateId)!; expect(c.article).toBeNull(); expect(c.id).toBe(draftUnlinkedResultId({ ...a, type: "developmental", name: "架空三" }));
});
it("retains multiline evidence across an append-only revision but rejects changed/removed proof", () => {
  const text = fixture(), d = apply(text), source = d.sources.find(s => s.pageId === 5282993)!;
  const nextSource = { ...source, revision: 3, contentSha256: draftHash(text + "\n追記") };
  expect(() => assertCarriedDraftEvidence(d, [{ source: nextSource, content: text + "\n追記" }])).not.toThrow();
  expect(() => assertCarriedDraftEvidence(d, [{ source: nextSource, content: text.replace("|架空三\n|外野手", "|別の架空人物\n|外野手") }])).toThrow(/evidence changed/);
});
