import { Link } from "react-router-dom";
import type { DraftEvent } from "../domain/npb-draft-event";
import { draftResearchedPredictionOutcome } from "../domain/npb-draft-research";
import { npbTeamShortName as teamName } from "./npb-team-names";
import { draftForecastAdmission } from "../domain/npb-draft-eligibility";
import { DraftHeldPrediction } from "./npb-draft-eligibility";

const time=(value:string)=>new Intl.DateTimeFormat("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"}).format(new Date(value));
const groupLabels={high_school:"高校生",university:"大学生",corporate:"社会人",independent:"独立リーグ"};
export function NpbResearchedDraftPreview({data,team}:{data:DraftEvent;team:string}){
  const f=data.researchedForecast;if(!f)return null;
  const candidates=new Map(data.candidates.map(c=>[c.id,c])),groups=new Map(data.candidateGroups?.map(g=>[g.candidateId,g.group])),references=new Map(f.references.map(r=>[r.id,r]));
  return <>
    <h2>球団事情から考える1〜3位予想</h2>
    <p className="inline-note">独自予想 · {time(f.createdAt)}保存（日本時間）</p>
    <p>1位は初回入札、2・3位は残る場合の候補。対象外・未確認は保留。</p>

    {f.clubs.filter(c=>team==="all"||c.teamId===team).map(club=><section key={club.teamId} aria-label={`${teamName(club.teamId)}の根拠付き予想`}>
      <h3>{teamName(club.teamId)}</h3>
      <details><summary>補強ポイント・参照した外部の見方</summary><p>{club.context}</p><p><strong>独自の判断：</strong>{club.judgment}</p>{club.referenceIds.map(id=>{const r=references.get(id)!;return <p key={id}><a href={r.url} target="_blank" rel="noreferrer">{r.publisher} · {r.topic} ↗</a><br/><small>{r.kind==="report"?"報道（公式発表ではありません）":"論評・提案（球団の意向とは別）"} · {r.author}<br/>公開 {r.publishedOn} · 更新 {r.updatedOn} · 確認 {time(r.checkedAt)}（日本時間）</small></p>;})}</details>
      {f.predictions.filter(p=>p.teamId===club.teamId).sort((a,b)=>a.round-b.round).map(p=>{
        const c=candidates.get(p.candidateId)!,g=groups.get(c.id),outcome=draftResearchedPredictionOutcome(data,club.teamId,p.round);
        if(!draftForecastAdmission(c,g).admitted)return <DraftHeldPrediction key={p.round} candidate={c} group={g} round={p.round}/>;
        return <article key={p.round}>
          <Link className="player-row" to={`/NPB/talent/2026?view=candidates&q=${encodeURIComponent(c.name)}`}><span className="player-row__body"><small>{p.round===1?"1位・初回入札予想":`${p.round}位・残っている場合`} · {g?groupLabels[g]:"区分未確認"}</small><strong>{c.name}</strong><span>{c.affiliation} · {c.position}</span></span><span aria-hidden="true">→</span></Link>
          <details><summary>{p.round}位の選択理由・答え合わせ</summary><p>{p.reason}</p><p>{outcome==="unavailable"?(p.round===1?"初回入札の直接証拠は未収録です。最終的な1位指名からは判定しません。":"この順位の支配下指名は未収録です。未収録を不的中にはしません。"):outcome==="not_applicable"?"その選手は前の順位ですでに指名され、この条件付き案は対象外です。":outcome==="match"?"収録済みの結果と一致しています。":outcome==="unverified"?"記事・所属の照合を確認中です。名前だけでは判定しません。":"収録済みの結果はこの案と異なります。"}</p>{p.round>1&&<p>当該候補が先に指名されていれば、この条件付き案は成立しません。</p>}<p>{c.context}</p></details>
        </article>;
      })}
    </section>)}
    <details><summary>外部情報と独自予想の違い</summary><p>外部の見解・報道を読み、補強の優先順をBaseball Notesが独自に考えた案です。球団発表・公式予想ではありません。記事本文・予想表・評価点の転載はせず、参照先で元の見方を確認できます。各球団の状況欄も独自の編成仮説で、最新の登録名簿や去就の確定情報ではありません。</p><p>複数球団で同じ1位候補を予想できますが、実際の入札・抽選を示すものではありません。2・3位も各球団別の条件付き案で、12球団を一つにした指名順のシミュレーションではありません。未収録・確認待ちの選手もいるため、全候補を比較した予想ではありません。</p></details>
  </>;
}
