import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import json from "../src/data/npb-draft-2026-final-forecast.json";
import pin from "../src/data/npb-draft-final-release.json";
import { alternativeFinalDraw, assertFirstFinalPublication, assertFinalAppPublicationWindow, assertFinalDraftBase, finalDraftForecastSchema, finalDraftOutcome } from "../src/domain/npb-draft-final";
import { draftFixture } from "./fixtures/npb-draft";

const f = () => structuredClone(json), parsed = () => finalDraftForecastSchema.parse(f());
it("pins all 36 reviewed, unique final selections without changing the three older editions", () => {
  const data = parsed();
  expect(data.candidates).toHaveLength(36); expect(new Set(data.predictions.map(p => p.candidateId)).size).toBe(36);
  const body = JSON.stringify(data) + "\n";
  expect(Buffer.byteLength(body)).toBe(pin.bytes); expect(createHash("sha256").update(body).digest("hex")).toBe(pin.bodySha256);
  expect(data.candidates.filter(c => c.group === "high_school")).toHaveLength(7);
  expect(data.candidates.filter(c => c.group === "university")).toHaveLength(23);
  expect(data.candidates.filter(c => c.group === "corporate")).toHaveLength(5);
  expect(data.candidates.filter(c => c.group === "independent")).toHaveLength(1);
  expect(readFileSync("src/data/npb-draft-2026-release.json", "utf8") + readFileSync("src/data/npb-draft-retained-releases.json", "utf8")).toContain(data.baseBodySha256);
  expect(data.candidates.some(c => ["山田凜虎", "石田雄星", "福島陽奈汰", "前田侑仁"].includes(c.name))).toBe(false);
});
it("requires exact 12 by 3 scope and the first-bid lottery allocation", () => {
  const duplicate = f(); duplicate.predictions[1]!.candidateId = duplicate.predictions[0]!.candidateId;
  expect(() => finalDraftForecastSchema.parse(duplicate)).toThrow(/36 distinct/);
  const wrong = f(); wrong.lotteryAssumptions[0]!.assumedWinner = "npb:team:giants";
  expect(() => finalDraftForecastSchema.parse(wrong)).toThrow(/Lottery/);
  const missing = f(); missing.firstBids[0]!.teamId = missing.firstBids[1]!.teamId;
  expect(() => finalDraftForecastSchema.parse(missing)).toThrow(/twelve/);
  const unknown = f(); unknown.predictions[0]!.candidateId = "unknown";
  expect(() => finalDraftForecastSchema.parse(unknown)).toThrow(/Unknown predicted/);
});
it("keeps every alternate draw globally unique and leaves rounds two and three independent of first-round winners", () => {
  const data = parsed(); let cases = 0;
  for (const a of data.lotteryAssumptions) for (const winner of a.teamIds) {
    const ps = alternativeFinalDraw(data, a.candidateId, winner); cases++;
    expect(ps).toHaveLength(36); expect(new Set(ps.map(p => p.candidateId)).size).toBe(36);
    expect(ps.filter(p => p.round > 1)).toEqual(data.predictions.filter(p => p.round > 1));
    expect(ps.find(p => p.teamId === winner && p.round === 1)!.candidateId).toBe(a.candidateId);
  }
  expect(cases).toBe(9); expect(() => alternativeFinalDraw(data, "missing", "npb:team:giants")).toThrow();
  expect(data.roundTwoOrder[0]).toBe("npb:team:eagles"); expect(data.roundTwoOrder.at(-1)).toBe("npb:team:tigers");
});
it("does not turn representative rosters, non-NPB lists or short corporate tenure into eligibility", () => {
  for (const mutate of [
    (d: ReturnType<typeof f>) => { d.candidates.find(c => c.group === "university")!.eligibility.studentList = null; },
    (d: ReturnType<typeof f>) => { d.candidates.find(c => c.group === "corporate")!.eligibility.firstCorporateSeason = 2026; },
    (d: ReturnType<typeof f>) => { d.candidates.find(c => c.group === "independent")!.eligibility.highSchoolGraduated = false; },
    (d: ReturnType<typeof f>) => { d.candidates[0]!.name = "山田凜虎"; },
    (d: ReturnType<typeof f>) => { d.candidates.find(c => c.group === "university")!.eligibility.urls = ["https://example.com/"]; },
  ]) { const data = f(); mutate(data); expect(() => finalDraftForecastSchema.parse(data)).toThrow(); }
});
it("rejects after-start freeze, future evidence and exact deadline first publication", () => {
  const data = f(); data.frozenAt = "2026-10-22T07:50:00Z"; expect(() => finalDraftForecastSchema.parse(data)).toThrow();
  const future = f(); future.candidates[0]!.eligibility.checkedAt = "2026-10-22T07:50:00Z"; expect(() => finalDraftForecastSchema.parse(future)).toThrow();
  expect(() => assertFirstFinalPublication(Date.parse("2026-10-22T07:49:59Z"))).not.toThrow();
  expect(() => assertFirstFinalPublication(Date.parse("2026-10-22T07:50:00Z"))).toThrow();
});
it("stops first Pages promotion before the deadline while allowing retention of an already published edition", () => {
  expect(() => assertFinalAppPublicationWindow(false, Date.parse("2026-10-22T07:34:59Z"))).not.toThrow();
  expect(() => assertFinalAppPublicationWindow(false, Date.parse("2026-10-22T07:35:00Z"))).toThrow();
  expect(() => assertFinalAppPublicationWindow(false, Date.parse("2026-10-22T08:00:00Z"))).toThrow();
  expect(() => assertFinalAppPublicationWindow(true, Date.parse("2026-10-23T08:00:00Z"))).not.toThrow();
});
it("cannot join new candidates to actual results by name or treat developmental picks as regular results", () => {
  const data = parsed(), base = draftFixture(), p = data.predictions.find(p => !data.candidates.find(c => c.id === p.candidateId)!.legacyCandidateId)!;
  const expected = data.candidates.find(c => c.id === p.candidateId)!;
  const actual = { ...base.candidates[0]!, name: expected.name, affiliation: expected.affiliation };
  base.candidates = [actual]; base.selections = [{ teamId: p.teamId, candidateId: actual.id, round: p.round, type: "developmental", status: "confirmed", sourcePageId: actual.sourcePageId, evidenceSha256: actual.evidenceSha256 }];
  expect(finalDraftOutcome(data, base, p.teamId, p.round)).toBe("unavailable");
  base.selections[0]!.type = "regular";
  expect(finalDraftOutcome(data, base, p.teamId, p.round)).toBe("unverified");
  const resultSource = base.sources.find(s => s.pageId === actual.sourcePageId)!;
  const bridge = { forecastCandidateId: expected.id, resultCandidateId: actual.id, name: actual.name, affiliation: actual.affiliation, article: actual.article, resultEvidenceSha256: actual.evidenceSha256, identityEvidenceUrls: [expected.identityUrls[0]!, `https://ja.wikipedia.org/w/index.php?curid=${resultSource.pageId}&oldid=${resultSource.revision}`], reviewedAt: base.observedAt };
  expect(finalDraftOutcome(data, base, p.teamId, p.round, [bridge])).toBe("match");
  expect(finalDraftOutcome(data, base, p.teamId, p.round, [{ ...bridge, identityEvidenceUrls: [expected.eligibility.urls[0]!, "https://example.com/"] }])).toBe("unverified");
  expect(finalDraftOutcome(data, base, p.teamId, p.round, [{ ...bridge, article: "別人" }])).toBe("unverified");
  expect(finalDraftOutcome(data, base, p.teamId, p.round, [bridge, bridge])).toBe("unverified");
  actual.name = "別人";
  expect(finalDraftOutcome(data, base, p.teamId, p.round, [{ ...bridge, name: actual.name }])).toBe("unverified");
});
it("requires the exact unchanged legacy observation; preserving names alone is insufficient", () => {
  const data = parsed(), base = draftFixture();
  expect(() => assertFinalDraftBase(data, base)).toThrow(/identity mismatch/);
});
it("requires usable individual evidence for all nine new identities, including the corporate candidate", () => {
  const data = parsed(), newCandidates = data.candidates.filter(c => !c.legacyCandidateId);
  expect(newCandidates).toHaveLength(9);
  for (const expected of newCandidates) {
    const p = data.predictions.find(p => p.candidateId === expected.id)!, base = draftFixture();
    const actual = { ...base.candidates[0]!, name: expected.name, affiliation: expected.affiliation };
    base.candidates = [actual]; base.selections = [{ teamId: p.teamId, candidateId: actual.id, round: p.round, type: "regular", status: "confirmed", sourcePageId: actual.sourcePageId, evidenceSha256: actual.evidenceSha256 }];
    const source = base.sources.find(s => s.pageId === actual.sourcePageId)!;
    const bridge = { forecastCandidateId: expected.id, resultCandidateId: actual.id, name: actual.name, affiliation: actual.affiliation, article: actual.article, resultEvidenceSha256: actual.evidenceSha256, identityEvidenceUrls: [...expected.identityUrls, `https://ja.wikipedia.org/w/index.php?curid=${source.pageId}&oldid=${source.revision}`], reviewedAt: base.observedAt };
    expect(finalDraftOutcome(data, base, p.teamId, p.round, [bridge]), expected.name).toBe("match");
    const other = { ...actual, id: "npb:draft:2026:" + "c".repeat(24), name: "別の架空結果選手", article: "別の架空記事", sourcePageId: 5209343 };
    base.sources.push({ ...source, pageId: other.sourcePageId, revision: 2 }); base.candidates.push(other);
    base.selections[0] = { ...base.selections[0]!, candidateId: other.id, sourcePageId: other.sourcePageId };
    expect(finalDraftOutcome(data, base, p.teamId, p.round, [bridge]), expected.name + " at another slot/source").toBe("different");
    base.observedAt = "2026-10-21T01:00:00Z";
    expect(finalDraftOutcome(data, base, p.teamId, p.round, [bridge]), expected.name + " after an append-only snapshot").toBe("different");
    expect(finalDraftOutcome(data, base, p.teamId, p.round, [{ ...bridge, reviewedAt: "2026-10-19T00:00:00Z" }])).toBe("unverified");
    source.revision++;
    expect(finalDraftOutcome(data, base, p.teamId, p.round, [bridge]), expected.name + " changed source revision").toBe("unverified");
    source.revision--;
    expect(finalDraftOutcome(data, base, p.teamId, p.round, [{ ...bridge, identityEvidenceUrls: [...expected.identityUrls, `https://ja.wikipedia.org/w/index.php?curid=${other.sourcePageId}&oldid=2`] }])).toBe("unverified");
  }
  const missing = f(), corporate = missing.candidates.find(c => c.name === "柴﨑聖人")!;
  corporate.identityUrls = corporate.identityUrls.filter(u => !u.includes("kan6bb.jp"));
  expect(() => finalDraftForecastSchema.parse(missing)).toThrow(/individually bridgeable/);
});
