import { useEffect,useState } from "react";
import { Link,useSearchParams } from "react-router-dom";
import { z } from "zod";
import { readMlbWeekly,type WeeklyManifest } from "../application/mlb-weekly";
import { readNpbWeekly,type NpbWeeklyStage } from "../application/npb-weekly";
import { calendarWeek,collectedWeeks,type WeekSummary,type WeeklyGame } from "../domain/weekly-analysis";
import { FORM_POLICY,type FormEntry,type FormCategory } from "../domain/historical-form";
import { readableMetric } from "../domain/data-explorer";
import type { Services } from "../app/services";
import { PageHeading,DataState,LoadingSkeleton,MetricLabel } from "./components";
import { ScoreboardRow } from "./design-system";
import { LicensedPlayerPhoto } from "./licensed-player-photo";
import { useHistoricalCompetition } from "./historical-competition-context";
import { CompetitionSelect } from "./historical-competition";
import { formatDateTime } from "../presentation/formatters";
import "./weekly-analysis.css";

const stages={regular:"公式戦",npb_cs_first:"CSファースト",npb_cs_final:"CSファイナル",japan_series:"日本シリーズ"};
const categories={batting:"HOT打者",starters:"HOT先発投手",relievers:"HOT救援投手"};
const shortDate=(s:string)=>s.slice(5).replace("-","/");
const numeric=(e:FormEntry,k:string)=>readableMetric(e.metrics[k]);
const innings=(n:number|null|undefined)=>n==null?"—":`${Math.floor(n/3)}.${n%3}`;
const stat=(e:FormEntry,k:string)=>{const n=numeric(e,k);return n===null?"—":k==="outsRecorded"?innings(n):["OPS","AVG"].includes(k)?n.toFixed(3).replace(/^0/,""):k==="ERA"?n.toFixed(2):k==="K9"?n.toFixed(1):String(n);};

export function WeeklyNavigation({weeks,selected,onChange}:{weeks:string[];selected:string;onChange:(week:string)=>void}) {
  const i=weeks.indexOf(selected);
  return <div className="weekly-week"><button type="button" disabled={i<=0} onClick={()=>onChange(weeks[i-1]!)} aria-label="前の週">‹</button>
    <label><span className="sr-only">対象週（月曜〜日曜）</span><select aria-label="対象週（月曜〜日曜）" value={selected} onChange={e=>onChange(e.target.value)}>{weeks.map(w=><option key={w} value={w}>{shortDate(w)}〜{shortDate(calendarWeek(w).to)}</option>)}</select></label>
    <button type="button" disabled={i<0||i>=weeks.length-1} onClick={()=>onChange(weeks[i+1]!)} aria-label="次の週">›</button></div>;
}
function ResultError({retry}:{retry:()=>void}) {return <><DataState kind="source-unavailable" title="週間データを読み込めません" detail="保存済みデータの通信・整合性を確認できませんでした。"/><button onClick={retry}>再読み込み</button></>;}
export function MlbWeeklyScreen({manifest}:{manifest:WeeklyManifest}) {
  const [params,setParams]=useSearchParams(),competition=useHistoricalCompetition();
  const season=Number(params.get("season")??manifest.seasons.at(-1)?.season),descriptor=manifest.seasons.find(s=>s.season===season);
  const date=params.get("week")??descriptor?.lastDate??"",validDate=z.iso.date().safeParse(date).success;
  const weeks=descriptor?collectedWeeks(descriptor.firstDate,descriptor.lastDate):[],week=validDate?calendarWeek(date).from:"";
  const valid=!!descriptor&&weeks.includes(week),key=`${competition}:${season}:${week}`;
  const [state,setState]=useState<{key:string;value:Awaited<ReturnType<typeof readMlbWeekly>>|null;error:boolean}>({key:"",value:null,error:false}),[attempt,setAttempt]=useState(0);
  useEffect(()=>{if(!valid)return;let active=true;void readMlbWeekly(manifest,season,week,competition).then(value=>{if(active)setState({key,value,error:false});}).catch(()=>{if(active)setState({key,value:null,error:true});});return()=>{active=false;};},[manifest,season,week,competition,key,valid,attempt]);
  const update=(field:string,value:string)=>{const p=new URLSearchParams(params);p.set(field,value);if(field==="season")p.delete("week");setParams(p);};
  const value=state.key===key?state.value:null;
  return <div className="screen weekly-screen"><PageHeading eyebrow={`MLB · ${competition==="regular"?"レギュラーシーズン":"ポストシーズン"}`} title="週間レポート"/>
    <div className="weekly-controls"><label><span className="sr-only">年度</span><select aria-label="年度" value={descriptor?.season??""} onChange={e=>update("season",e.target.value)}>{!descriptor&&<option value="">未収録年度</option>}{manifest.seasons.map(s=><option key={s.season} value={s.season}>{s.season}年</option>)}</select></label><CompetitionSelect season={season}/></div>
    {valid&&<WeeklyNavigation weeks={weeks} selected={week} onChange={w=>update("week",w)}/>}
    {!valid?<DataState kind="no-data" title="この年度・週は未収録です"/>:state.key===key&&state.error?<ResultError retry={()=>setAttempt(n=>n+1)}/>:!value?<LoadingSkeleton/>:<>
      <WeeklySummary summary={value.summary} names={value.names}/>
      {(["batting","starters","relievers"] as const).map(category=><HotSection key={category} category={category} entries={value.hot[category]} season={season} week={week} competition={competition}/>)}
      <section className="weekly-section"><h2>前週から急上昇 <span>↗</span></h2>{value.rising.length?<div className="weekly-rising">{value.rising.map(e=><Link key={`${e.category}:${e.playerId}`} to={playerLink(e,season,value.summary.week.to,competition)}><strong>{e.name}</strong><span>{e.category==="batting"?"OPS":"防御率"} {e.previous?.toFixed(e.category==="batting"?3:2)} → {stat(e,e.category==="batting"?"OPS":"ERA")}</span><small>前週 {e.category==="batting"?e.previousSample??"—":innings(e.previousSample)}{e.category==="batting"?"打席":"回"} · 今週 {e.category==="batting"?numeric(e,FORM_POLICY[e.category].sample)??"—":innings(numeric(e,FORM_POLICY[e.category].sample))}{e.category==="batting"?"打席":"回"}</small></Link>)}</div>:<p className="muted">両週の母数と上昇基準を満たす選手はいません。</p>}<p className="inline-note">比較期間 {shortDate(value.summary.week.previous.from)}〜{shortDate(value.summary.week.previous.to)} → {shortDate(week)}〜{shortDate(value.summary.week.to)}{value.summary.previousCoverage!=="complete"&&" · 前週の範囲が不足するため比較保留"}</p></section>
      <WeeklyTeams summary={value.summary}/>
      <details className="weekly-method"><summary>選び方・収録範囲・出典</summary><p>月曜〜日曜。試合記録の日付で集計。打者はOPSを中心に打席・本塁打・安打、投手は防御率とK/9・投球回・登板数で並べています。公式表彰ではありません。</p><p>打者20打席、先発5回・1先発、救援2回・2登板以上。前週も同じ母数を満たし、OPSが0.100以上上昇、または防御率が1.00以上改善した選手を急上昇として紹介します。先発・救援は明示された登板区分で分けています。</p><p>シーズン境界を含む週・部分収録は選手評価を保留。収録最終日 {value.asOf}。配信データに更新日時の記録はありません。</p><p>{value.attribution}</p><Link to="/MLB/sources">出典・利用条件</Link><p className="inline-note">検証世代 {value.sourceFingerprint.slice(0,12)}</p></details>
    </>}
  </div>;
}
function playerLink(e:FormEntry,season:number,to:string,competition:string) {return `/MLB/players/${encodeURIComponent(e.playerId)}/analysis?season=${season}&asOfDate=${to}&period=7${competition==="postseason"?"&competition=postseason":""}`;}
function HotSection({category,entries,season,week,competition}:{category:FormCategory;entries:FormEntry[];season:number;week:string;competition:string}) {
  const keys=category==="batting"?["AVG","H","HR","RBI","PA"]:["outsRecorded","SO","G","K9"],labels:Record<string,string>={AVG:"打率",H:"安打",HR:"本塁打",RBI:"打点",PA:"打席",outsRecorded:"投球回",SO:"奪三振",G:"登板",K9:"K/9"};
  return <section className="weekly-section weekly-hot"><header><h2>{categories[category]}</h2><MetricLabel metric={category==="batting"?"OPS":"ERA"}/><Link to={`/MLB/form?season=${season}&asOfDate=${calendarWeek(week).to}&category=${category}${competition==="postseason"?"&competition=postseason":""}`}>成績一覧 →</Link></header>
    {!entries.length?<p className="muted">収録範囲・母数条件を満たす選手はいません。</p>:<ol>{entries.map((e,i)=><li key={e.playerId}><div className="weekly-person"><Link to={playerLink(e,season,calendarWeek(week).to,competition)}><small>{i+1}</small><strong>{e.name}</strong><span className="weekly-main-metric"><span>{category==="batting"?"OPS":"防御率"}</span><b>{stat(e,category==="batting"?"OPS":"ERA")}</b></span></Link>{i===0&&<LicensedPlayerPhoto playerId={e.playerId} season={season}/>}</div><dl className="weekly-statline">{keys.map(k=><div key={k}><dt>{k==="K9"?<MetricLabel metric="K9"/>:labels[k]}</dt><dd>{stat(e,k)}</dd></div>)}</dl>{e.previous!==null&&e.delta!==null&&<p className="weekly-change">前週 {e.previous.toFixed(category==="batting"?3:2)} → 今週 {stat(e,category==="batting"?"OPS":"ERA")}</p>}</li>)}</ol>}
  </section>;
}
function weeklyGameLink(g:WeeklyGame,s:WeekSummary["scope"]) {return `/${s.league}/games/${encodeURIComponent(g.id)}?season=${s.season}${s.competition==="postseason"?`&competition=postseason${s.stage?`&stage=${s.stage}`:""}`:""}${s.league==="NPB"&&s.competition==="regular"?`&date=${g.date}`:""}`;}
export function WeeklySummary({summary:s,names}:{summary:WeekSummary;names:ReadonlyMap<string,string>}) {
  const games=s.highlights.length?s.highlights:s.games.slice(-3);
  return <><section className="weekly-overview" aria-label="週間の収録結果"><p>{s.week.from}〜{s.week.to} <span>{s.coverage==="complete"?"収録範囲確認済み":"一部収録"}</span></p><div className="weekly-totals"><div><strong>{s.games.length}</strong><span>収録試合</span></div><div><strong>{s.games.length||s.coverage==="complete"?s.closeGames:"—"}</strong><span>1点差・引き分け</span></div><div><strong>{s.games.length||s.coverage==="complete"?s.bigGames:"—"}</strong><span>10得点以上</span></div></div></section>
    <section className="weekly-section"><h2>この週のハイライト</h2>{games.length?<div className="scoreboard-list">{games.map(g=><ScoreboardRow key={g.id} to={weeklyGameLink(g,s.scope)} away={names.get(g.awayId)!} home={names.get(g.homeId)!} awayId={g.awayId} homeId={g.homeId} awayScore={g.awayRuns} homeScore={g.homeRuns} status="試合終了" date={shortDate(g.date)}/>)}</div>:<p className="muted">この週の終了結果は未収録です。</p>}
    {s.innings.map(r=><Link className="weekly-inning" key={`${r.gameId}:${r.inning}:${r.half}`} to={weeklyGameLink(s.games.find(g=>g.id===r.gameId)!,s.scope)}><strong>{r.inning}回{r.half}</strong><span>{names.get(r.teamId)}が{r.runs}得点</span><span aria-hidden="true">→</span></Link>)}
    {!!s.pending&&<p className="inline-note">日程・未確定状態の収録 {s.pending}件。未収録の結果は集計に含めていません。</p>}</section></>;
}
function WeeklyTeams({summary:s}:{summary:WeekSummary}) {
  return <details className="weekly-section weekly-teams"><summary>球団別の勝敗・得失点 <span>{s.teams.length}球団</span></summary>{s.teams.length?<div className="table-scroll"><table><caption className="sr-only">収録試合の球団成績。前週比は両週の収録範囲が確認できた場合の1試合あたり得点差。</caption><thead><tr><th>球団</th><th>勝–敗–分</th><th>得–失点</th><th>前週比*</th></tr></thead><tbody>{s.teams.map(t=><tr key={t.teamId}><th scope="row">{t.name}</th><td>{t.wins}–{t.losses}–{t.ties}</td><td>{t.runsFor}–{t.runsAgainst}<span className="weekly-runbar" style={{width:`${Math.max(0,t.runsPerGame/Math.max(1,...s.teams.map(t=>t.runsPerGame))*100)}%`}}/></td><td>{t.previous?.runsPerGame!=null?`${t.runsPerGame-t.previous.runsPerGame>=0?"+":""}${(t.runsPerGame-t.previous.runsPerGame).toFixed(1)}`:"—"}<small>{t.games}試合</small></td></tr>)}</tbody></table></div>:<p className="muted">終了結果が収録されると集計できます。</p>}<p className="inline-note">*1試合あたり得点の前週差。部分収録では収録分の勝敗・得失点のみ。</p></details>;
}
export function NpbWeeklyScreen({services}:{services:Pick<Services,"gameSurface">}) {
  const [params,setParams]=useSearchParams(),rawStage=params.get("stage")??"regular",date=params.get("week")??undefined;
  const expectedCompetition=rawStage==="regular"?"regular":"postseason";
  const valid=Object.hasOwn(stages,rawStage)&&(!date||z.iso.date().safeParse(date).success)&&(!params.has("season")||params.get("season")==="2026")&&(!params.has("competition")||params.get("competition")===expectedCompetition);
  const stage=rawStage as NpbWeeklyStage,key=`${rawStage}:${date??"latest"}`;
  const [state,setState]=useState<{key:string;value:Awaited<ReturnType<typeof readNpbWeekly>>|null;error:boolean}>({key:"",value:null,error:false}),[attempt,setAttempt]=useState(0);
  useEffect(()=>{if(!valid)return;let active=true;void readNpbWeekly(stage,date,services.gameSurface).then(value=>{if(active)setState({key,value,error:false});}).catch(()=>{if(active)setState({key,value:null,error:true});});return()=>{active=false;};},[key,stage,date,valid,services.gameSurface,attempt]);
  const update=(field:string,value:string)=>{const p=new URLSearchParams(params);p.set(field,value);if(field==="stage")p.delete("week");setParams(p);};
  const value=state.key===key?state.value:null;
  return <div className="screen weekly-screen"><PageHeading eyebrow="NPB · 2026" title="週間レポート"/><label className="weekly-stage"><span className="sr-only">集計対象</span><select aria-label="集計対象" value={stage} onChange={e=>update("stage",e.target.value)}>{Object.entries(stages).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    {!valid?<DataState kind="no-data" title="この条件は未対応です"/>:state.key===key&&state.error?<ResultError retry={()=>setAttempt(n=>n+1)}/>:!value?<LoadingSkeleton/>:<>
      <WeeklyNavigation weeks={value.weeks} selected={value.summary.week.from} onChange={w=>update("week",w)}/><WeeklySummary summary={value.summary} names={value.names}/><WeeklyTeams summary={value.summary}/>
      <section className="weekly-section"><h2>選手の週間評価</h2><p className="muted">収録状況と公開条件が揃っていないため未公開です。</p><Link to="/NPB/records">選手成績の公開状況 →</Link></section>
      <details className="weekly-method"><summary>収録範囲・出典</summary><p>{stages[stage]}のみ。収録分の試合結果を集計し、公式戦・CS・日本シリーズを合算していません。部分収録の勝敗を週全体の成績とは扱いません。</p><p>収録最終日 {value.asOf} · データ更新 {formatDateTime(value.updatedAt)}</p><p>{value.attribution}</p>{value.sources.map(s=><p key={s.url}><a href={s.url}>{s.label}</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></p>)}<Link to="/MLB/sources">利用条件</Link></details>
    </>}
  </div>;
}
