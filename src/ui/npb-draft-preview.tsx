import { Link } from "react-router-dom";
import { draftTeams, draftExpandedPredictionOutcome, type DraftEvent } from "../domain/npb-draft-event";
import { npbTeamShortName as getTeamName } from "./npb-team-names";

const draftGroupLabels = {high_school:"高校生",university:"大学生",corporate:"社会人",independent:"独立リーグ"};
export function NpbDraftCandidates({data,q,group,onSearch,onGroup}:{data:DraftEvent;q:string;group:string;onSearch:(value:string)=>void;onGroup:(value:string)=>void}){
  const groups=new Map(data.candidateGroups?.map(c=>[c.candidateId,c.group]));
  const rows=data.candidates.filter(c=>(group==="all"||groups.get(c.id)===group)&&`${c.name} ${c.affiliation} ${c.position}`.includes(q));
  return <><h2>注目候補を探す</h2><p>所属・役割を記事から収録した選手です。全候補の一覧や、指名資格の確認済み名簿ではありません。</p>
    {data.candidateGroups&&<label>所属区分<select value={group} onChange={e=>onGroup(e.target.value)}><option value="all">すべて</option>{Object.entries(draftGroupLabels).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>}
    <label className="search-field">名前・学校・所属・守備位置<input type="search" maxLength={80} value={q} onChange={e=>onSearch(e.target.value)} placeholder="選手・学校・チームから探す"/></label><p className="inline-note">{rows.length}人 · 一部収録</p>
    {rows.map(c=><article className="player-row" key={c.id}><div className="player-row__body"><small>{groups.has(c.id)?draftGroupLabels[groups.get(c.id)!]:""}</small><strong>{c.name}</strong><p>{c.affiliation} · {c.position} · {c.throws}投{c.bats}打</p><small>{c.context} · 志望届未確認</small></div></article>)}
    {!rows.length&&<p role="status">この条件の選手は未収録です。</p>}
  </>;
}
const time=(value:string)=>new Intl.DateTimeFormat("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"}).format(new Date(value));
export function NpbExpandedDraftPreview({data,team}:{data:DraftEvent;team:string}){
  const forecast=data.expandedForecast;if(!forecast)return null;
  const candidates=new Map(data.candidates.map(c=>[c.id,c])),groups=new Map(data.candidateGroups?.map(c=>[c.candidateId,c.group]));
  return <>
    <h2>12球団の1〜3位予想</h2>
    <p className="inline-note">Baseball Notes独自予想 · {time(forecast.createdAt)}保存（日本時間）</p>
    <p>高校・大学・社会人・独立リーグを含む独自案。志望届・指名資格は未確認です。</p>
    <details><summary>予想の前提</summary><p>球団公表・報道予想ではありません。確認できた所属・守備位置を使い、投手・捕手・野手の組み合わせを考えたAIの編集案です。能力の順位表、球団の補強意向、抽選やウェーバー順のシミュレーションではありません。全候補を網羅せず、進路・資格の確認で対象が変わる可能性があります。1〜3位は最終的な支配下指名との参考比較で、初回入札・抽選とは区別します。</p></details>
    {draftTeams.filter(id=>team==="all"||id===team).map(teamId=><section key={teamId} aria-label={`${getTeamName(teamId)}の1〜3位予想`}>
      <h3>{getTeamName(teamId)}</h3>
      {forecast.predictions.filter(p=>p.teamId===teamId).sort((a,b)=>a.round-b.round).map(p=>{
        const c=candidates.get(p.candidateId)!,group=groups.get(c.id),outcome=draftExpandedPredictionOutcome(data,teamId,p.round),actual=data.selections.find(s=>s.teamId===teamId&&s.type==="regular"&&s.round===p.round),actualPlayer=candidates.get(actual?.candidateId??"");
        return <article key={p.round}>
          <Link className="player-row" to={`/NPB/talent/2026?view=candidates&q=${encodeURIComponent(c.name)}`}><div className="player-row__body"><small>{p.round}位 · {group?draftGroupLabels[group]:"区分未確認"} · 独自予想</small><strong>{c.name}</strong><span>{c.affiliation} · {c.position}</span></div><span aria-hidden="true">→</span></Link>
          <details><summary>{p.round}位の理由・答え合わせ</summary><p>{p.reason}</p>{actualPlayer&&<p>収録済みの支配下{p.round}位：<strong>{actualPlayer.name}</strong> · {actualPlayer.affiliation}</p>}<p>{({unavailable:"指名結果が未収録のため、答え合わせ待ちです。",match:"収録済みの指名と一致しています。",unverified:"記事・所属表記の照合を確認中です。名前だけで一致・不一致を判定しません。",different:"収録済みの指名は独自予想と異なります。"})[outcome]}</p><p>{c.context}</p></details>
        </article>;
      })}
    </section>)}
  </>;
}
