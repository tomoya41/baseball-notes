import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ExplorerManifest, ExplorerProfile } from "./data-explorer";
import type { HistoricalDirectoryPlayer } from "../domain/historical-directory";
import type { AdvancedPlayerPayload } from "../domain/mlb-pa-analysis";
import type { ExplorerValues } from "../domain/data-explorer";
import { matchesMlbPlayerName } from "../domain/mlb-japanese-display";
import { seasonCheckpoints } from "../domain/mlb-product-metrics";
import { seasonCheckpointLabels } from "../domain/npb-season-milestones";
import { useHistoricalStatic } from "./use-mlb-historical";
import { useHistoricalCompetition } from "./historical-competition-context";
import { DataState, LoadingSkeleton, MetricLabel, PageHeading } from "./components";
import { ExplorerLinks } from "./data-explorer";
import { PaMetricTable } from "./mlb-historical-advanced";

export function MlbMatchup({manifest}:{manifest:ExplorerManifest}) {
  const [params,setParams]=useSearchParams(),competition=useHistoricalCompetition(),season=Number(params.get("season")??manifest.seasons.at(-1)!.season);
  const scope=competition==="postseason"?"&competition=postseason":"",descriptor=manifest.seasons.find(s=>s.season===season);
  const directory=useHistoricalStatic<{players:HistoricalDirectoryPlayer[]}>(descriptor?"players/index.json":null);
  const [queries,setQueries]=useState({batter:"",pitcher:""});
  const players=directory.value?.players.filter(p=>p.seasons.includes(season))??[];
  const batter=players.find(p=>p.id===params.get("batter")),pitcher=players.find(p=>p.id===params.get("pitcher"));
  const advanced=useHistoricalStatic<AdvancedPlayerPayload>(batter?`advanced/${season}/${batter.id.replaceAll(":","_")}.json`:null);
  const update=(key:string,value:string)=>setParams(old=>{const next=new URLSearchParams(old);if(value)next.set(key,value);else next.delete(key);return next;});
  const data=advanced.value,valid=data?.playerId===batter?.id&&data?.scope===String(season),opponent=valid&&data?.directBvp==="ready"?data.batting.opponents.find(p=>p.playerId===pitcher?.id):undefined;
  return <div className="screen"><PageHeading eyebrow={`MLB · ${season} · ${competition==="postseason"?"POSTSEASON":"REGULAR"}`} title="MATCHUP" /><ExplorerLinks league="MLB" scope={`?season=${season}${scope}`} />
    <label className="competition-season">シーズン<select value={season} onChange={e=>update("season",e.target.value)}>{!descriptor&&<option value={season}>未収録</option>}{manifest.seasons.map(s=><option key={s.season}>{s.season}</option>)}</select></label>
    {!descriptor?<DataState kind="unsupported" title="指定シーズンは未収録です" />:directory.status==="loading"?<LoadingSkeleton />:!directory.value?<><DataState kind="source-unavailable" title="選手一覧を読み込めません" /><button onClick={directory.retry}>再読み込み</button></>:<>
      <p className="inline-note">{descriptor.lastDate}までの過去記録。実際の打席で対戦した結果を表示します。</p>
      <div className="matchup-selectors">{(["batter","pitcher"] as const).map(kind=>{
        const selected=kind==="batter"?batter:pitcher,label=kind==="batter"?"打者":"投手",q=queries[kind];
        const candidates=q.trim()?players.filter(p=>matchesMlbPlayerName(p.id,p.name,q)).slice(0,20):[];
        return <section key={kind}><h2>{label}</h2>{selected&&<div className="compare-selection"><Link to={`/MLB/players/${encodeURIComponent(selected.id)}?season=${season}${scope}`}>{selected.name}</Link><button aria-label={`${label}の選択を解除`} onClick={()=>update(kind,"")}>×</button></div>}
          {params.get(kind)&&!selected&&<p role="status">指定選手はこの年度・集計対象に未収録です。</p>}
          <label className="search-field"><span className="sr-only">{label}を検索</span><input type="search" placeholder={`${label}名を検索`} value={q} onChange={e=>setQueries({...queries,[kind]:e.target.value})} /></label>
          <div className="row-list">{candidates.map(p=><button className="player-row" key={p.id} onClick={()=>{update(kind,p.id);setQueries({...queries,[kind]:""});}}>{p.name}</button>)}</div>{q.trim()&&!candidates.length&&<p>該当選手がいません。</p>}
          {kind==="pitcher"&&!q.trim()&&valid&&data?.directBvp==="ready"&&!selected&&<details><summary>この打者の対戦投手から選ぶ</summary><div className="row-list">{data.batting.opponents.slice(0,20).map(p=><button className="player-row" key={p.playerId} onClick={()=>update("pitcher",p.playerId)}>{p.name}<span>{p.metrics.PA} PA</span></button>)}</div><small>20人まで表示。ほかの相手は名前で検索できます。</small></details>}
        </section>;
      })}</div>
      {batter&&pitcher&&<button className="text-button" onClick={()=>setParams(old=>{const next=new URLSearchParams(old);next.set("batter",pitcher.id);next.set("pitcher",batter.id);return next;})}>打者・投手を入れ替える</button>}
      {batter&&advanced.status==="loading"&&<LoadingSkeleton />}
      {batter&&["missing","error"].includes(advanced.status)&&<><DataState kind="source-unavailable" title="対戦データを取得できません" /><button onClick={advanced.retry}>再読み込み</button></>}
      {data&&(!valid||data.directBvp!=="ready")&&<DataState kind="unsupported" title="この年度・選手の対戦データは利用できません" />}
      {batter&&pitcher&&valid&&data?.directBvp==="ready"&&(opponent?<section aria-label="直接対戦の成績"><h2>{batter.name} 対 {pitcher.name}</h2><p className="data-notice">対象 {opponent.metrics.PA}打席 · {season}年 {competition==="postseason"?"Postseason":"Regular Season"}</p><PaMetricTable metrics={opponent.metrics} /><p className="inline-note">少数打席だけで得意・苦手を判断しません。</p><Link className="text-link" to={`/MLB/players/${encodeURIComponent(batter.id)}/analysis?season=${season}${scope}`}>打者のAnalysis →</Link></section>:<DataState kind="no-data" title="この組み合わせの直接対戦は収録されていません" detail="同じ試合への出場だけでは対戦と扱いません。" />)}
      {!batter&&!pitcher&&<DataState kind="no-data" title="打者と投手を選択してください" />}
    </>}
  </div>;
}

export function SeasonCheckpointSummary({batting,pitching,season,playerId,competition}:{batting:ExplorerValues|null;pitching:ExplorerValues|null;season:number;playerId:string;competition:string}) {
  const checkpoints=seasonCheckpoints(batting,pitching).filter(c=>c.value>0).sort((a,b)=>a.remaining/a.step-b.remaining/b.step).slice(0,3);
  if(!checkpoints.length)return null;
  return <section className="season-checkpoints"><h2>シーズンの節目</h2><p className="inline-note">{season}年 · {competition==="postseason"?"Postseason":"Regular Season"}。通算記録ではありません。</p><div className="row-list">{checkpoints.map(c=><div className="checkpoint-row" key={c.metric}><strong>{seasonCheckpointLabels[c.metric as keyof typeof seasonCheckpointLabels]}</strong><span>{c.value} / 次の{c.next}まであと{c.remaining}</span></div>)}</div><Link to={`/MLB/milestones?season=${season}&player=${encodeURIComponent(playerId)}${competition==="postseason"?"&competition=postseason":""}`}>節目をすべて見る →</Link></section>;
}
export function MlbSeasonMilestones({manifest}:{manifest:ExplorerManifest}) {
  const [params,setParams]=useSearchParams(),competition=useHistoricalCompetition(),season=Number(params.get("season")??manifest.seasons.at(-1)!.season),descriptor=manifest.seasons.find(s=>s.season===season),scope=competition==="postseason"?"&competition=postseason":"";
  const directory=useHistoricalStatic<{players:HistoricalDirectoryPlayer[]}>(descriptor?"players/index.json":null);
  const source=useHistoricalStatic<{season:number;firstDate:string;lastDate:string;coverage:string;players:{playerId:string;batting:ExplorerValues|null;pitching:ExplorerValues|null}[]}>(descriptor?`seasons/${season}.json`:null);
  const update=(key:string,value:string)=>setParams(old=>{const next=new URLSearchParams(old);if(value)next.set(key,value);else next.delete(key);if(key!=="page")next.delete("page");return next;},{replace:key==="q"});
  const role=params.get("role")==="pitching"?"pitching":"batting",name=params.get("q")??"",mode=params.get("mode")==="achieved"?"achieved":"near";
  const names=new Map(directory.value?.players.filter(p=>p.seasons.includes(season)).map(p=>[p.id,p.name]));
  const valid=!!source.value&&!!descriptor&&source.value.season===season&&source.value.firstDate===descriptor.firstDate&&source.value.lastDate===descriptor.lastDate&&source.value.coverage===descriptor.coverage&&source.value.players.every(p=>names.has(p.playerId));
  const rows=valid?source.value!.players.flatMap(p=>seasonCheckpoints(p.batting,p.pitching).filter(c=>c.role===role&&(!params.get("metric")||params.get("metric")===c.metric)&&(!params.get("player")||params.get("player")===p.playerId)&&(mode==="achieved"?c.previous>0:c.value>0&&c.remaining<=c.step*.2)).map(c=>({...c,playerId:p.playerId,name:names.get(p.playerId)!}))).filter(r=>matchesMlbPlayerName(r.playerId,r.name,name)).sort((a,b)=>a.name.localeCompare(b.name,"ja")||a.metric.localeCompare(b.metric)):[];
  const pageRaw=Number(params.get("page")??0),pages=Math.max(1,Math.ceil(rows.length/40)),page=Number.isSafeInteger(pageRaw)&&pageRaw>=0?Math.min(pageRaw,pages-1):0;
  return <div className="screen"><PageHeading eyebrow={`MLB · ${season} · ${competition==="postseason"?"POSTSEASON":"REGULAR"}`} title="シーズンの節目" /><ExplorerLinks league="MLB" scope={`?season=${season}${scope}`} />
    <div className="explorer-filter-grid"><label>シーズン<select value={season} onChange={e=>update("season",e.target.value)}>{!descriptor&&<option value={season}>未収録</option>}{manifest.seasons.map(s=><option key={s.season}>{s.season}</option>)}</select></label><label>成績<select value={role} onChange={e=>{const next=new URLSearchParams(params);next.set("role",e.target.value);next.delete("metric");next.delete("page");setParams(next);}}><option value="batting">打撃</option><option value="pitching">投球</option></select></label><label>表示<select value={mode} onChange={e=>update("mode",e.target.value)}><option value="near">次の節目に接近</option><option value="achieved">到達した節目</option></select></label><label>指標<select value={params.get("metric")??""} onChange={e=>update("metric",e.target.value)}><option value="">すべて</option>{Object.entries(seasonCheckpointLabels).filter(([k])=>role==="batting"?["H","HR","RBI","SB"].includes(k):!["H","HR","RBI","SB"].includes(k)).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label></div>
    <label className="search-field"><span className="sr-only">節目を調べる選手名</span><input type="search" value={name} placeholder="選手名を検索" onChange={e=>update("q",e.target.value)} /></label>
    <p className="inline-note">{descriptor?.lastDate??"—"}時点のシーズン集計。通算・歴代記録ではありません。</p><details className="advanced-disclosure"><summary>節目の定義</summary><p>Watchと同じ固定間隔の節目です。接近は次の節目まで間隔の20%以内。到達はシーズン合計で既に満たした節目で、達成日や最後の試合での達成を表しません。未提供・一部未確認の指標は判定しません。</p></details>
    {!descriptor?<DataState kind="unsupported" title="指定シーズンは未収録です" />:source.status==="loading"||directory.status==="loading"?<LoadingSkeleton />:!valid?<><DataState kind="source-unavailable" title="整合したシーズン成績を取得できません" /><button onClick={()=>{source.retry();directory.retry();}}>再読み込み</button></>:descriptor.coverage!=="complete"?<DataState kind="small-sample" title="収録範囲を確認できないため節目の判定は利用できません" />:<>
    {params.get("player")&&!names.has(params.get("player")!)&&<DataState kind="unsupported" title="指定選手はこのシーズンに未収録です" />}
    {!rows.length&&<DataState kind="no-data" title="この条件に該当する節目はありません" />}<div className="row-list">{rows.slice(page*40,(page+1)*40).map(r=><article className="explorer-result" key={`${r.playerId}:${r.metric}`}><h2><Link to={`/MLB/players/${encodeURIComponent(r.playerId)}?season=${season}${scope}`}>{r.name}</Link></h2><div className="checkpoint-row"><MetricLabel metric={r.metric} /><strong>{r.value}</strong><span>{mode==="near"?`${r.next}まであと${r.remaining}`:`${r.previous}到達`}</span></div></article>)}</div>
    {pages>1&&<nav className="explorer-pagination" aria-label="節目のページ"><button disabled={!page} onClick={()=>update("page",String(page-1))}>前へ</button><span>{page+1}/{pages}</span><button disabled={page+1===pages} onClick={()=>update("page",String(page+1))}>次へ</button></nav>}</>}
  </div>;
}

export function SavedSeasonTimeline({profile,manifest,competition}:{profile:ExplorerProfile;manifest:ExplorerManifest;competition:string}) {
  const scope=competition==="postseason"?"&competition=postseason":"",id=encodeURIComponent(profile.player.id);
  return <section><h2>保存済みシーズン履歴</h2><p className="inline-note">収録された年度・出場球団のみ。完全なCareerや所属期間を示しません。</p><ol className="lifecycle-timeline">{profile.player.seasons.filter(y=>manifest.seasons.some(s=>s.season===y)).map(year=>{
    const teams=[...new Set([...profile.batting,...profile.pitching].filter(r=>r.season===year).map(r=>r.teamId))],totals=profile.seasonTotals[String(year)];
    return <li key={year}><h3>{year} · {competition==="postseason"?"Postseason":"Regular Season"}</h3><div className="hub-links">{teams.map(team=><Link key={team} to={`/MLB/teams/${encodeURIComponent(team)}?season=${year}${scope}`}>{manifest.teams.find(t=>t.id===team)?.name??"収録球団"}</Link>)}</div>
      <p>{totals?.batting?`${totals.batting.G?.value??"—"}試合 · ${totals.batting.H?.value??"—"}安打 · ${totals.batting.HR?.value??"—"}HR`:totals?.pitching?`${totals.pitching.appearances?.value??"—"}登板 · ${totals.pitching.SO?.value??"—"}奪三振`:"この年度の成績は未提供"}</p>
      <nav className="explorer-links" aria-label={`${year}年の履歴`}><Link to={`/MLB/history?player=${id}&season=${year}${scope}`}>シーズン履歴</Link><Link to={`/MLB/players/${id}/game-log?season=${year}${scope}`}>試合別</Link><Link to={`/MLB/season-compare?kind=player&entity=${id}${scope}`}>年度比較</Link><Link to={`/MLB/postseason?season=${year}`}>Postseason</Link></nav></li>;
  })}</ol></section>;
}
