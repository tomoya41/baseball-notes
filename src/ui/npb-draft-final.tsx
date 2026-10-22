import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { readNpbFinalDraft } from "../application/npb-draft-final-reader";
import { alternativeFinalDraw, assertFinalDraftBase, finalDraftOutcome, finalResultBridgesSchema, type FinalDraftForecast } from "../domain/npb-draft-final";
import type { DraftEvent } from "../domain/npb-draft-event";
import { DataState, LoadingSkeleton } from "./components";
import { npbTeamShortName as teamName } from "./npb-team-names";
import { DraftEligibilityCorrection } from "./npb-draft-eligibility";
import publication from "../data/npb-draft-final-publication.json";
import bridgeJson from "../data/npb-draft-final-result-bridges.json";

const time = (s: string) => new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date(s));
const groups = { high_school: "高校生", university: "大学生", corporate: "社会人", independent: "独立リーグ" };
const bridges = finalResultBridgesSchema.parse(bridgeJson);
function Evidence({ c }: { c: FinalDraftForecast["candidates"][number] }) {
  return <><p><strong>資格・人物の確認：</strong>{c.eligibility.basis}</p>{c.eligibility.studentList && <p>2026年 NPBドラフト対象者欄：{c.eligibility.studentList.school}・{c.eligibility.studentList.name}{c.eligibility.studentList.acceptedOn ? `（受付 ${c.eligibility.studentList.acceptedOn}）` : ""}</p>}{c.identityNote !== c.eligibility.basis && <p>{c.identityNote}</p>}<p>確認 {time(c.eligibility.checkedAt)}（日本時間）。指名・入団や現在のNPB所属の証拠ではありません。</p>{[...new Set([...c.eligibility.urls, ...c.identityUrls])].map((u, i) => <p key={u}><a href={u} target="_blank" rel="noreferrer">確認根拠 {i + 1} · {new URL(u).hostname} ↗</a></p>)}</>;
}
export function NpbFinalDraft({ base, team, view, q, group, onSearch, onGroup }: { base: DraftEvent; team: string; view: string; q: string; group: string; onSearch: (s: string) => void; onGroup: (s: string) => void }) {
  const [data, setData] = useState<FinalDraftForecast | null>(null), [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; void readNpbFinalDraft().then(f => { assertFinalDraftBase(f, base); if (active) { setData(f); setError(false); } }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [base, attempt]);
  if (error) return <><DataState kind="source-unavailable" title="直前最終予想を取得できません" detail="未確認の旧予想へ自動で差し替えません。保存版は切り替えから確認できます。" /><button onClick={() => { setError(false); setAttempt(a => a + 1); }}>再試行</button></>;
  if (!data) return <LoadingSkeleton />;
  const candidates = new Map(data.candidates.map(c => [c.id, c]));
  return <>
    <h2>会議前の固定予想（アーカイブ）</h2>
    <p className="inline-note">保存名：{data.title}。このアプリには会議終了後に掲載しています。</p>
    <p className="inline-note">{data.author} · 支配下1〜3位36枠 · 資格審査済み · 保留0枠</p>
    <p className="inline-note">情報確認 {time(data.informationCutoff)} / 固定 {time(data.frozenAt)}（日本時間）{publication.firstPublishedAt && <> / 固定版Release公開 {time(publication.firstPublishedAt)}</>}</p>
    <p>会議前にGitHub Releaseへ公開した36枠を、そのまま収録。結果に合わせた変更はしていません。会議前のアプリ公開を示すものではありません。</p>
    <p><a href="https://github.com/tomoya41/baseball-notes/releases/tag/npb-draft-final-20261022-v4">会議前の固定版を確認 ↗</a> · <Link to="/NPB/talent/2026?view=results&forecast=final">指名結果へ →</Link></p>
    <p className="inline-note">初回入札・抽選後の獲得は独自予想です。当選球団の仮定と、実際の指名結果は別に表示します。</p>
    {view !== "candidates" && <p className="inline-note">36枠の比較：{(["match", "different", "unverified", "unavailable"] as const).map(state => `${({ match: "一致", different: "相違", unverified: "人物照合待ち", unavailable: "結果未収録" })[state]} ${data.predictions.filter(p => finalDraftOutcome(data, base, p.teamId, p.round, bridges) === state).length}枠`).join(" / ")}。照合待ち・未収録を不的中に含めません。</p>}
    {view === "candidates" ? <>
      <label>選手名・所属で検索<input value={q} onChange={e => onSearch(e.target.value)} placeholder="選手名・学校・チーム" /></label>
      <label>所属区分<select value={group} onChange={e => onGroup(e.target.value)}><option value="all">すべて</option>{Object.entries(groups).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
      {data.candidates.filter(c => (group === "all" || c.group === group) && (!q || `${c.name} ${c.affiliation}`.includes(q))).map(c => <article key={c.id} className="draft-final-candidate"><h3>{c.name}</h3><p>{c.affiliation} · {groups[c.group]} · {c.position}</p><details><summary>資格・選手の確認根拠</summary><Evidence c={c} /></details></article>)}
      {!data.candidates.some(c => (group === "all" || c.group === group) && (!q || `${c.name} ${c.affiliation}`.includes(q))) && <DataState kind="no-data" title="この条件の選手は最終予想に含まれていません" detail="公式の全対象者名簿ではありません。掲載なしを指名資格なし・未指名とは判定しません。" />}
    </> : <>
      {data.clubs.filter(c => team === "all" || c.teamId === team).map(club => {
        const bid = candidates.get(data.firstBids.find(b => b.teamId === club.teamId)!.candidateId)!;
        return <section key={club.teamId} aria-label={`${teamName(club.teamId)}の直前最終予想`}>
          <h3>{teamName(club.teamId)}</h3><p><strong>初回入札予想：{bid.name}</strong> <span className="inline-note">{bid.affiliation}</span></p>
          <details><summary>補強の狙い・外部情報</summary><p>{club.context}</p><p>以下は参照した外部の論評・報道です。本表の36枠と抽選シナリオはBaseball Notesの独自判断で、記事の予想表の転載ではありません。</p>{club.referenceUrls.map(u => { const r = data.researchReferences.find(r => r.url === u)!; return <p key={u}><a href={u} target="_blank" rel="noreferrer">{r.publisher} · {r.topic} ↗</a><br /><small>{r.author} · {r.kind === "report" ? "報道（球団発表とは別）" : "論評・提案"}<br />公開 {r.publishedOn} · 更新 {r.updatedOn}</small></p>; })}</details>
          {data.predictions.filter(p => p.teamId === club.teamId).sort((a, b) => a.round - b.round).map(p => {
            const c = candidates.get(p.candidateId)!, outcome = finalDraftOutcome(data, base, p.teamId, p.round, bridges);
            const selection = base.selections.find(s => s.teamId === p.teamId && s.round === p.round && s.type === "regular");
            const actual = selection && base.candidates.find(c => c.id === selection.candidateId);
            return <article key={p.round}>
              <Link className="player-row" to={`/NPB/talent/2026?view=candidates&forecast=final&q=${encodeURIComponent(c.name)}`}><span className="player-row__body"><small>{p.round}位・獲得予想 · {groups[c.group]}</small><strong>{c.name}</strong><span>{c.affiliation} · {c.position}</span></span><span aria-hidden="true">→</span></Link>
              {actual && <p><strong>記事の支配下{p.round}位：{actual.name}</strong><br /><span className="inline-note">{actual.affiliation} · 指名時の所属</span></p>}
              <p>{p.reason}</p><details><summary>{p.round}位の資格根拠・答え合わせ</summary><Evidence c={c} /><p>{({ unavailable: "この順位の確認済み支配下指名は未収録です。未収録を不的中とは判定しません。", unverified: "実結果との選手ID照合を確認中です。名前だけでは答え合わせしません。", match: "確認済みの支配下指名と獲得予想が一致しています。", different: "確認済みの支配下指名は獲得予想と異なります。" })[outcome]}</p><p>答え合わせは抽選後の支配下指名に対して行います。初回入札・抽選の仮定は別で、育成指名を混ぜません。</p></details>
            </article>;
          })}
        </section>;
      })}
      <details><summary>競合・抽選が逆になった場合</summary><p>本線の仮定と、別球団が当選する例です。別の当選球団と本線の当選球団の1位候補を交換し、2・3位を固定した場合も36人の重複がないことを検証しています。実際には他球団の再入札・方針も変わり得ます。抽選の確率や結果を示すものではありません。</p>{data.lotteryAssumptions.map(a => <section key={a.candidateId}><h3>{candidates.get(a.candidateId)!.name}</h3><p>初回入札予想：{a.teamIds.map(teamName).join("・")} / 本線の当選仮定：{teamName(a.assumedWinner)}</p>{a.teamIds.filter(t => t !== a.assumedWinner).map(t => { const alt = alternativeFinalDraw(data, a.candidateId, t); return <p key={t}>{teamName(t)}が当選なら、{teamName(a.assumedWinner)}の再入札案は{candidates.get(alt.find(p => p.teamId === a.assumedWinner && p.round === 1)!.candidateId)!.name}。2・3位は本表を維持する別シナリオ。</p>; })}</section>)}</details>
      <details><summary>2・3位の指名順とシナリオの範囲</summary><p>2位：{data.roundTwoOrder.map(teamName).join(" → ")}</p><p>3位はこの逆順です。同一選手を複数球団・順位へ配分していません。全候補の網羅的な評価ではなく、個別に資格と人物を確認できた36人による独自シナリオです。未採用の選手が指名対象外という意味ではありません。</p>{data.orderSourceUrls.map(u => <p key={u}><a href={u} target="_blank" rel="noreferrer">指名手順の参照 · {new URL(u).hostname} ↗</a></p>)}<p>2026年の順番は会議前報道、一般的な入札・逆順の手順は公式の2025年説明も参照しています。2025年のリーグ優先順を2026年へ転用していません。</p></details>
    </>}
    <details><summary>旧予想の訂正履歴・今回の出典と利用範囲</summary><DraftEligibilityCorrection /><p>第1〜3版は変更していません。旧版の対象外・確認待ちを強制解除せず、本版に個別審査した別の36枠を追加しました。山田凜虎・石田雄星・福島陽奈汰は採用していません。</p><p>学生30人は公式NPB対象者欄、社会人5人は大学卒業歴と2シーズン以上の経歴、独立リーグ1人は高校卒業後の所属歴を個別に確認した編集審査です。NPBが本アプリの予想や全候補を承認したという意味ではありません。資格の事実と指名の予想は別です。</p><p>第三者の本文・写真・予想表・公式名簿の大量複製は行わず、必要最小限の事実の確認記録と独自文を掲載。原記事へのリンクで根拠を確認できます。候補IDは特集内だけのもので、既存NPB選手IDへ名前で統合していません。</p>{data.wikipediaAttribution.map(s => <p key={s.pageId}><a href={`https://ja.wikipedia.org/w/index.php?curid=${s.pageId}&oldid=${s.revision}`}>Wikipedia「{s.title}」の執筆者 · revision {s.revision}</a></p>)}<p>変更：必要項目の抽出、個別資格審査、補強理由・入札シナリオの作成。本データ・独自予想は<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>。アプリコード・リンク先の本文や写真の権利とは別です。</p></details>
  </>;
}
