import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { readNpbHistoricalSeason } from "../application/npb-historical-reader";
import type { NpbHistoricalDataset, NpbHistoricalManifest } from "../domain/npb-historical";
import { cohortIdentities, historicalCohort, type HistoricalCohortKind } from "../domain/npb-historical-cohort";
import type { NpbCatalog } from "../domain/npb-product-contract";
import { comparisonValue, type ComparisonRow } from "../domain/product-comparison";
import { ComparisonBars } from "./comparison-bars";
import { DataState, LoadingSkeleton, MetricLabel } from "./components";
import { HistoricalCredits } from "./npb-historical-credits";
import { SaveViewButton } from "./personal-library";

export type CohortRepository={catalog():Promise<NpbCatalog>};
export function NpbHistoricalCohort({manifest,season,repository}:{manifest:NpbHistoricalManifest;season:number;repository:CohortRepository}) {
  const [params,setParams]=useSearchParams(),[attempt,setAttempt]=useState(0);
  const [result,setResult]=useState<{data:NpbHistoricalDataset;catalog:NpbCatalog}|null>(null),[failed,setFailed]=useState(false);
  const kind=params.get("cohort"),role=params.get("role")??"batting",referenceId=params.get("peer")??"";
  const valid=(kind==="birthYear"||kind==="draftYear"||kind==="schoolYear")&&(role==="batting"||role==="pitching")&&(!params.has("competition")||params.get("competition")==="regular");
  useEffect(()=>{if(!valid)return;let active=true;void Promise.all([readNpbHistoricalSeason(season,manifest),repository.catalog()]).then(([data,catalog])=>{if(active){setResult({data,catalog});setFailed(false);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[valid,season,manifest,repository,attempt]);
  const update=(key:string,value:string)=>setParams(previous=>{const next=new URLSearchParams(previous);next.set(key,value);if(["cohort","peer","role"].includes(key)){next.delete("recentPlayers");next.delete("page");}return next;});
  if(!valid)return <DataState kind="unsupported" title="指定した同期の条件・成績区分は未対応です" />;
  if(failed)return <><DataState kind="source-unavailable" title="同期の成績・プロフィールを取得できません" /><button onClick={()=>{setFailed(false);setAttempt(a=>a+1);}}>再試行</button></>;
  if(!result)return <LoadingSkeleton />;
  const {data,catalog}=result,cohort=historicalCohort(data,catalog,referenceId,kind as HistoricalCohortKind,role as "batting"|"pitching");
  const referenceOptions=cohortIdentities(data,catalog).filter(p=>data.rows.some(r=>r.playerId===p.playerId&&r.role===role));
  const ids=[...new Set((params.get("recentPlayers")??"").split(","))].filter(id=>cohort.members.some(m=>m.player.playerId===id)).slice(0,4);
  const keys=role==="batting"?["OPS","AVG","HR","H"]:["ERA","SO","outsRecorded"];
  const metric=keys.includes(params.get("sort1")??"")?params.get("sort1")!:keys[0]!;
  const selected:ComparisonRow[]=ids.map(id=>{const m=cohort.members.find(m=>m.player.playerId===id)!;return {id,name:m.player.displayName,season,date:`${season}年の収録分`,coverage:"partial",metrics:Object.fromEntries(Object.entries(m.metrics).map(([k,value])=>[k,{value,status:value===null?"unavailable":"partial"}]))};});
  const pageRaw=params.get("page")??"1",pages=Math.max(1,Math.ceil(cohort.members.length/30)),page=/^[1-9]\d{0,3}$/.test(pageRaw)?Math.min(Number(pageRaw),pages):1;
  const teamName=(id:string)=>catalog.teams.find(t=>t.teamId===id)?.shortName??"球団未確認";
  const exit=new URLSearchParams(params);for(const k of ["cohort","peer","recentPlayers","page"])exit.delete(k);
  return <section className="historical-cohort" aria-label="同学年・ドラフト同期の年度比較">
    <h2>同学年・ドラフト同期を比較</h2><p className="inline-note">{season}年公式戦・一部収録。同学年、または指名年が確認できる選手を探します。現在の登録や新人資格は判定しません。</p>
    <div className="explorer-filter-grid"><label>同期の条件<select value={kind} onChange={e=>update("cohort",e.target.value)}><option value="schoolYear">同学年</option><option value="birthYear">同じ生年（暦年）</option><option value="draftYear">同じ指名年</option></select></label><label>基準の選手<select value={referenceId} onChange={e=>update("peer",e.target.value)}><option value="">選手を選ぶ</option>{referenceId&&!referenceOptions.some(p=>p.playerId===referenceId)&&<option value={referenceId}>{cohort.reference?.displayName??"未確認の選手"} · この年度・役割の成績は未収録</option>}{referenceOptions.map(p=><option key={p.playerId} value={p.playerId}>{p.displayName}</option>)}</select></label><label>成績<select value={role} onChange={e=>update("role",e.target.value)}><option value="batting">打撃（投手打撃を含む）</option><option value="pitching">投球</option></select></label></div>
    {cohort.year===null?<DataState kind="no-data" title={referenceId?"この選手の同期条件は未確認です":"基準にする選手を選んでください"} detail="未確認の生年・指名年を推定せず、同姓同名を統合しません。" />:<><h3>{kind==="schoolYear"?"同学年":`${cohort.year}年${kind==="birthYear"?"生まれ":"指名"}`} · {cohort.members.length}人の収録成績</h3>{kind==="schoolYear"&&<><p className="inline-note">{cohort.year}年4月2日〜{cohort.year+1}年4月1日生まれ</p><details><summary>同学年の区分について</summary><p>確認済み生年月日を日本の学年区分で整理しています。実際の入学・卒業・留年や海外の学年は判定しません。4月1日生まれは一つ上の学年です。</p><a href="https://www.mext.go.jp/a_menu/shotou/shugaku/detail/1422233.htm" target="_blank" rel="noreferrer">文部科学省：4月1日生まれの児童生徒の学年について</a></details></>}<p>2〜4人を選んで比較できます。率指標は球団別行の構成値から再計算し、母数も併記します。</p>
    {selected.length>=2&&<section aria-label="同期の成績比較"><label>比較指標<select value={metric} onChange={e=>update("sort1",e.target.value)}>{keys.map(k=><option key={k} value={k}>{k==="outsRecorded"?"投球回":k}</option>)}</select></label><ComparisonBars rows={selected} metric={metric} /><p className="inline-note">同じ年度・公式戦の収録分です。選手ごとに収録範囲・母数が異なります。規定資格や優劣の判定ではありません。</p><details><summary>比較した選手の母数・出典</summary>{ids.map(id=>{const m=cohort.members.find(m=>m.player.playerId===id)!,key=role==="batting"?"PA":"outsRecorded";return <p key={id}><strong>{m.player.displayName}</strong> · {comparisonValue(key,m.metrics[key]??null)}{role==="batting"?"打席":"回"}<br/><HistoricalCredits data={data} playerId={id}/></p>;})}</details></section>}
    <p role="status">比較 {ids.length}/4人 · {page}/{pages}ページ</p>
    <div className="explorer-results">{cohort.members.slice((page-1)*30,page*30).map(m=><article className="explorer-result" key={m.player.playerId}>
      <h3 className="explorer-result-title"><Link to={`/NPB/players/${m.player.playerId}/seasons?season=${season}&role=${role}`}>{m.player.displayName}</Link></h3><p>{m.teams.map(teamName).join(" / ")} · {kind==="schoolYear"?`${m.player.profile.birthDate}生まれ`:`${cohort.year}年${kind==="birthYear"?"生まれ":"指名"}`}</p>
      <dl className="explorer-values">{[role==="batting"?"PA":"outsRecorded",...keys.slice(0,2)].map(k=><div key={k}><dt><MetricLabel metric={k} label={k==="outsRecorded"?"投球回":k} /></dt><dd>{comparisonValue(k,m.metrics[k]??null)}</dd></div>)}</dl>
      <div className="lifecycle-actions"><label><input type="checkbox" aria-label={`${m.player.displayName}を同期比較に選択`} checked={ids.includes(m.player.playerId)} disabled={!ids.includes(m.player.playerId)&&ids.length>=4} onChange={()=>update("recentPlayers",(ids.includes(m.player.playerId)?ids.filter(id=>id!==m.player.playerId):[...ids,m.player.playerId]).join(","))} />比較に選ぶ</label></div>
      <details><summary>成績・同期条件の出典</summary><HistoricalCredits data={data} playerId={m.player.playerId} /><p>{m.player.identityScope==="historical_only"?"生年月日は過去成績の確認済みIdentityに基づきます。":`プロフィールの保存基準日 ${catalog.effectiveDate}。`}過去の所属は年度成績の球団別行です。</p>{m.player.profile.credits?.map((c,i)=><p key={i}><a href={c.url} target="_blank" rel="noreferrer">{c.name}</a> · <a href={c.licenseUrl} target="_blank" rel="noreferrer">利用条件</a> · 構造化・加工済み</p>)}</details>
    </article>)}</div>{!cohort.members.length&&<DataState kind="no-data" title="この年度・役割の同期成績は未収録です" />}
    {pages>1&&<nav aria-label="同期のページ"><button disabled={page===1} onClick={()=>update("page",String(page-1))}>前へ</button><button disabled={page===pages} onClick={()=>update("page",String(page+1))}>次へ</button></nav>}</>}
    <SaveViewButton league="NPB" kind="history" params={params} />
    <Link to={`/NPB/history?${exit}`}>年度の全収録選手へ →</Link>
  </section>;
}
