import { createHash } from "node:crypto";
import { z } from "zod";
import { npbJapanSeriesSchema } from "../domain/npb-japan-series";
import { japanSeriesHomeSummary } from "../presentation/japan-series-home";

const hash = (body: Uint8Array | string) => createHash("sha256").update(body).digest("hex");
const teamNames: Record<string,string> = { "npb:team:hawks":"ソフトバンク", "npb:team:baystars":"DeNA" };

/** Offline editorial input, not a new source, Fact, Current projection or Gate. */
export function prepareNpbAiEvidence(body: Uint8Array, pin: {bodySha256:string;seriesId:string;gameIds:string[]}) {
  if (body.byteLength > 50_000 || hash(body) !== pin.bodySha256) throw Error("Unadmitted Japan Series snapshot");
  const data = npbJapanSeriesSchema.parse(JSON.parse(Buffer.from(body).toString("utf8")));
  if (data.series.id !== pin.seriesId || JSON.stringify(data.series.games.map(g=>g.gameId)) !== JSON.stringify(pin.gameIds) ||
    data.series.teams.some(t=>!teamNames[t.teamId])) throw Error("Unsupported AI evidence identity");
  const {standingCompleteThroughLatest} = japanSeriesHomeSummary(data, Date.parse(data.observedAt));
  const facts = data.series.games.map(g=>({
    id:g.gameId, kind:g.status === "final" ? "confirmed_result" : "recorded_schedule",
    date:g.date,gameNumber:g.gameNumber,homeTeamId:g.homeTeamId,homeTeam:teamNames[g.homeTeamId],
    awayTeamId:g.awayTeamId,awayTeam:teamNames[g.awayTeamId],status:g.status,
    awayRuns:g.awayRuns,homeRuns:g.homeRuns,
    innings:data.results.find(r=>r.gameId===g.gameId)?.awayInnings.length ?? null,
  }));
  const evidence = { schemaVersion:1, scope:"NPB/2026/japan_series", snapshotSha256:pin.bodySha256,
    observedAt:data.observedAt,coverage:data.coverage,license:data.license,
    sources:data.sources.map(s=>({url:`https://ja.wikipedia.org/w/index.php?curid=${s.pageId}&oldid=${s.revision}`,
      authors:`Wikipedia「${s.title}」の執筆者`,licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/"})),
    standing:standingCompleteThroughLatest ? data.series.teams.map(t=>({teamId:t.teamId,name:teamNames[t.teamId],wins:t.playedWins})) : null,
    facts,limitations:["部分収録。取得時点の情報でリアルタイムではない。","個人成績・予告先発は未収録。MVP・出場予定・現在の調子は選考できない。","日程は開催・終了の証拠ではない。未収録を0対0、試合なし、未発表と表現しない。"] };
  const input = JSON.stringify(evidence);
  if (Buffer.byteLength(input)>12_000) throw Error("AI evidence exceeds input budget");
  return {inputSha256:hash(input),evidence};
}
export type NpbAiEvidence = ReturnType<typeof prepareNpbAiEvidence>;

const draftSchema = z.strictObject({schemaVersion:z.literal(1),inputSha256:z.string().regex(/^[a-f0-9]{64}$/),
  kind:z.enum(["review","preview","series"]),headline:z.string().min(1).max(70),body:z.string().min(1).max(300),
  factIds:z.array(z.string()).min(1).max(4)});

/** Reference/shape validation only: prose can still be false. Never auto-publish. */
export function validateNpbAiDraft(value:unknown, input:NpbAiEvidence) {
  const draft=draftSchema.parse(value),facts=draft.factIds.map(id=>input.evidence.facts.find(f=>f.id===id));
  if(draft.inputSha256!==input.inputSha256||new Set(draft.factIds).size!==draft.factIds.length||facts.some(f=>!f)||
    draft.kind==="review"&&!facts.some(f=>f?.kind==="confirmed_result")||
    draft.kind==="preview"&&!facts.some(f=>f?.status==="scheduled")) throw Error("AI draft evidence mismatch");
  const text=draft.headline+draft.body;
  if (/[<>]/u.test(text)||[...text].some(char=>char.codePointAt(0)!<=8)) throw Error("Unsupported AI draft markup");
  const numbers=(s:string)=>s.normalize("NFKC").match(/\d+(?:\.\d+)?/g)??[];
  const allowed=new Set(numbers(JSON.stringify({facts:facts.map(f=>({date:f!.date,gameNumber:f!.gameNumber,
    homeRuns:f!.homeRuns,awayRuns:f!.awayRuns,innings:f!.innings})),standing:input.evidence.standing,observedAt:input.evidence.observedAt})));
  if(numbers(text).some(n=>!allowed.has(n)))throw Error("Unsupported AI draft number");
  return {status:"CANDIDATE_REQUIRES_REVIEW" as const,publiclyAdmitted:false as const,
    narrativeReviewRequired:true as const,draft,inputSha256:input.inputSha256,sources:input.evidence.sources};
}
