import { useEffect,useState } from "react";
import { Link,useSearchParams } from "react-router-dom";
import { z } from "zod";
import type { Services } from "../app/services";
import { readMlbWeekly,type WeeklyManifest } from "../application/mlb-weekly";
import { readNpbWeekly,type NpbWeeklyStage } from "../application/npb-weekly";
import { calendarMonth,collectedMonths } from "../domain/weekly-analysis";
import { readableMetric } from "../domain/data-explorer";
import { useHistoricalCompetition } from "./historical-competition-context";
import { CompetitionSelect } from "./historical-competition";
import { PageHeading,DataState,LoadingSkeleton,MetricLabel } from "./components";
import { WeeklySummary,WeeklyTeams } from "./weekly-analysis";
import "./weekly-analysis.css";

type Props={league:"MLB";manifest:WeeklyManifest}|{league:"NPB";services:Pick<Services,"gameSurface">};
type Report=Awaited<ReturnType<typeof readMlbWeekly>>|Awaited<ReturnType<typeof readNpbWeekly>>;
const stages={regular:"公式戦",npb_cs_first:"CSファースト",npb_cs_final:"CSファイナル",japan_series:"日本シリーズ"};
export function MonthlyScreen(props:Props) {
  const [params,setParams]=useSearchParams(),competition=useHistoricalCompetition();
  const manifest=props.league==="MLB"?props.manifest:undefined,services=props.league==="NPB"?props.services:undefined;
  const season=Number(params.get("season")??manifest?.seasons.at(-1)?.season??2026),descriptor=manifest?.seasons.find(s=>s.season===season);
  const stage=params.get("stage")??"regular",raw=params.get("month"),date=raw?`${raw}-01`:descriptor?.lastDate;
  const valid=(!raw||/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)&&z.iso.date().safeParse(`${raw}-01`).success)&&
    (props.league==="MLB"?!!descriptor&&!!date&&collectedMonths(descriptor.firstDate,descriptor.lastDate).includes(calendarMonth(date).from):
      season===2026&&Object.hasOwn(stages,stage)&&(!params.has("competition")||params.get("competition")===(stage==="regular"?"regular":"postseason"))&&(!raw||raw.startsWith("2026-")));
  const key=`${props.league}:${season}:${stage}:${competition}:${raw??"latest"}`;
  const [state,setState]=useState<{key:string;value:Report|null;error:boolean}>({key:"",value:null,error:false}),[retry,setRetry]=useState(0);
  useEffect(()=>{if(!valid)return;let active=true;
    const request=manifest?readMlbWeekly(manifest,season,date!,competition,undefined,"month"):readNpbWeekly(stage as NpbWeeklyStage,raw?`${raw}-01`:undefined,services!.gameSurface,undefined,"month");
    void request.then(value=>{if(active)setState({key,value,error:false});}).catch(()=>{if(active)setState({key,value:null,error:true});});
    return()=>{active=false;};
  },[valid,key,manifest,services,season,date,competition,stage,raw,retry]);
  const value=state.key===key?state.value:null;
  const months=descriptor?collectedMonths(descriptor.firstDate,descriptor.lastDate):value&&"weeks" in value?value.weeks:[];
  const selected=raw??value?.summary.week.from.slice(0,7)??descriptor?.lastDate.slice(0,7)??"";
  const update=(field:string,v:string)=>{const next=new URLSearchParams(params);next.set(field,v);if(field!=="month")next.delete("month");if(field==="stage")next.delete("competition");setParams(next);};
  return <div className="screen weekly-screen"><PageHeading eyebrow={`${props.league} · ${season}`} title="月間レポート"/>
    <div className="weekly-controls">{manifest?<><label><span className="sr-only">年度</span><select aria-label="年度" value={descriptor?.season??""} onChange={e=>update("season",e.target.value)}>{!descriptor&&<option value="">未収録年度</option>}{manifest.seasons.map(s=><option key={s.season} value={s.season}>{s.season}年</option>)}</select></label><CompetitionSelect season={season}/></>:<label><span className="sr-only">集計対象</span><select aria-label="集計対象" value={stage} onChange={e=>update("stage",e.target.value)}>{Object.entries(stages).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>}
    {!!months.length&&<label><span className="sr-only">対象月</span><select aria-label="対象月" value={selected} onChange={e=>update("month",e.target.value)}>{months.map(m=><option key={m} value={m.slice(0,7)}>{Number(m.slice(5,7))}月</option>)}</select></label>}</div>
    {!valid?<DataState kind="no-data" title="この年度・月は未収録です"/>:state.key===key&&state.error?<><DataState kind="source-unavailable" title="月間データを確認できません"/><button onClick={()=>setRetry(n=>n+1)}>再読み込み</button></>:!value?<LoadingSkeleton/>:<>
      <WeeklySummary summary={value.summary} names={value.names} period="月"/><WeeklyTeams summary={value.summary} period="月"/>
      {"hot" in value&&value.playerEvaluation==="available"?(["batting","starters","relievers"] as const).map(category=><section className="weekly-section" key={category}><h2>{category==="batting"?"月間の打者":category==="starters"?"月間の先発投手":"月間の救援投手"}</h2>{value.hot[category].length?<div className="weekly-rising">{value.hot[category].map(e=>{const metric=category==="batting"?"OPS":"ERA",n=readableMetric(e.metrics[metric]),sample=readableMetric(e.metrics[category==="batting"?"PA":"outsRecorded"]);return <Link key={e.playerId} to={`/MLB/form?season=${season}&mode=monthly-change&asOfDate=${value.summary.week.to}&category=${category}`}><strong>{e.name}</strong><span><MetricLabel metric={metric}/> {n==null?"—":n.toFixed(category==="batting"?3:2)} · {sample==null?"—":category==="batting"?`${sample}打席`:`${Math.floor(sample/3)}.${sample%3}回`}</span>{e.previous!=null&&<small>前月 {e.previous.toFixed(category==="batting"?3:2)}</small>}</Link>;})}</div>:<p className="muted">収録範囲と母数条件を満たす選手はいません。</p>}</section>):<p className="inline-note">{props.league==="NPB"?"選手の月間評価は公開条件が揃うまで非公開です。":"月全体の収録を確認できない場合とポストシーズンでは、月間の選手評価を保留します。"}</p>}
      <details className="weekly-method"><summary>集計方法・収録範囲</summary><p>暦月の1日〜末日。勝敗・得失点は終了結果の収録分。前月比は両月の全範囲が確認できる場合のみ、1試合あたり得点を比較します。未収録を0試合とは扱いません。</p><p>{props.league==="NPB"?`${stages[stage as NpbWeeklyStage]}のみ。公式戦・CS・日本シリーズを合算しません。`:`${competition==="regular"?"レギュラーシーズン":"ポストシーズン"}のみ。打者80打席、先発20回、救援8回に加え既存の登板条件を適用。率指標は構成値から再計算します。`}</p><p>収録最終日 {value.asOf}。{value.attribution}</p>{"sources" in value&&value.sources.map(s=><p key={s.url}><a href={s.url}>{s.label}</a> · CC BY-SA 4.0</p>)}{"fetches" in value&&<p>選択した2か月の静的データのみ取得（最大62日、同時4件）。初期ホームの追加通信はありません。</p>}<Link to="/MLB/sources">出典・利用条件</Link></details>
    </>}
    <Link className="section-action" to={`/${props.league}/weekly?season=${season}${props.league==="NPB"?`&stage=${stage}`:competition==="postseason"?"&competition=postseason":""}`}>週間レポート →</Link>
  </div>;
}
