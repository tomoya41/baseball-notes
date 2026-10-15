import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { readNpbHistoricalManifest, readNpbHistoricalSeason } from "../application/npb-historical-reader";
import { sumHistoricalRows, type NpbHistoricalDataset, type NpbHistoricalManifest, type NpbHistoricalRow } from "../domain/npb-historical";
import { normalizePlayerSearch } from "../domain/npb-player-directory";
import { comparisonValue, type ComparisonRow } from "../domain/product-comparison";
import { DataState, LoadingSkeleton, MetricLabel, PageHeading } from "./components";
import { ComparisonBars } from "./comparison-bars";

const teams:Record<string,string>={giants:"巨人",tigers:"阪神",dragons:"中日",carp:"広島",swallows:"ヤクルト",baystars:"DeNA",hawks:"ソフトバンク",fighters:"日本ハム",lions:"西武",marines:"ロッテ",eagles:"楽天",buffaloes:"オリックス"};
const teamName=(id:string)=>teams[id.split(":").at(-1)!]??"球団未確認";
function Numbers({rows,role}:{rows:NpbHistoricalRow[];role:"batting"|"pitching"}) {
  const {metrics}=sumHistoricalRows(rows),keys=role==="batting"?["PA","H","HR","RBI","AVG","OPS"]:["G","W","outsRecorded","SO","ERA"];
  return <dl className="explorer-values">{keys.map(k=><div key={k}><dt><MetricLabel metric={k} label={k==="outsRecorded"?"投球回":k} /></dt><dd>{comparisonValue(k,metrics[k]??null)}</dd></div>)}</dl>;
}
function Credits({data,playerId}:{data:NpbHistoricalDataset;playerId:string}) {
  const p=data.players.find(p=>p.playerId===playerId)!;
  return <small><a href={`https://ja.wikipedia.org/w/index.php?title=${encodeURIComponent(p.article)}&oldid=${p.revision}`} target="_blank" rel="noreferrer">Wikipedia「{p.article}」の執筆者</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> · 年度表から抽出・正規化</small>;
}
export function NpbHistoricalHistory({current}:{current:React.ReactNode}) {
  const [params,setParams]=useSearchParams(),[manifest,setManifest]=useState<NpbHistoricalManifest|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  const season=params.get("season")??"2026",role=params.get("role")==="pitching"?"pitching":"batting";
  useEffect(()=>{let active=true;void readNpbHistoricalManifest().then(m=>{if(active){setManifest(m);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[attempt]);
  const update=(key:string,value:string)=>setParams(previous=>{const p=new URLSearchParams(previous);if(value)p.set(key,value);else p.delete(key);return p;},{replace:key==="q"});
  const supported=season==="2026"||!!manifest?.seasons.some(s=>String(s.season)===season);
  return <div className="screen"><PageHeading eyebrow="NPB · 公式戦" title="シーズン履歴" />
    <label className="competition-season">年度<select aria-label="NPB履歴の年度" value={season} onChange={e=>update("season",e.target.value)}><option value="2026">2026年 · 保存済みの今季</option>{manifest?.seasons.slice().reverse().map(y=><option key={y.season} value={y.season}>{y.season}年 · 過去の成績（一部）</option>)}{!supported&&<option value={season}>未収録の年度</option>}</select></label>
    {params.get("competition")==="postseason"?<DataState kind="unsupported" title="NPBの過去のポストシーズンは未収録です" />:season==="2026"?current:failed?<><DataState kind="source-unavailable" title="過去年度の一覧を取得できません" /><button onClick={()=>setAttempt(a=>a+1)}>再試行</button></>:!manifest?<LoadingSkeleton />:!supported?<DataState kind="unsupported" title="指定した年度は未収録です" />:<HistoricalSeason key={`${season}:${attempt}`} manifest={manifest} season={Number(season)} role={role} params={params} update={update} />}
    {failed&&season==="2026"&&<p className="inline-note">過去年度の一覧を取得できません。<button onClick={()=>setAttempt(a=>a+1)}>再試行</button></p>}
  </div>;
}
function HistoricalSeason({manifest,season,role,params,update}:{manifest:NpbHistoricalManifest;season:number;role:"batting"|"pitching";params:URLSearchParams;update:(key:string,value:string)=>void}) {
  const [data,setData]=useState<NpbHistoricalDataset|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  const query=params.get("q")??"",team=params.get("team")??"",page=/^\d{1,3}$/.test(params.get("page")??"")?Math.max(1,Math.min(100,Number(params.get("page")))):1;
  const playerId=params.get("player")??"",player=manifest.players.find(p=>p.playerId===playerId);
  const ids=[...new Set((params.get("recentPlayers")??"").split(",").filter(id=>manifest.players.some(p=>p.playerId===id)))].slice(0,4);
  useEffect(()=>{let active=true;void readNpbHistoricalSeason(season,manifest).then(d=>{if(active){setData(d);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[season,manifest,attempt]);
  const rows=data?.rows.filter(r=>r.role===role&&(!team||r.teamId===team))??[];
  const candidates=data?.players.filter(p=>rows.some(r=>r.playerId===p.playerId)&&(!query||normalizePlayerSearch(p.name).includes(normalizePlayerSearch(query))))??[];
  const pages=Math.max(1,Math.ceil(candidates.length/30)),safePage=Math.min(page,pages),visible=candidates.slice((safePage-1)*30,safePage*30);
  const keys=role==="batting"?["AVG","OPS","H","HR"]:["ERA","SO","outsRecorded"];
  const metric=keys.includes(params.get("sort1")??"")?params.get("sort1")!:keys[0]!;
  const comparisonRows:ComparisonRow[]=ids.flatMap(id=>{const source=rows.filter(r=>r.playerId===id);return source.length?[{id,name:manifest.players.find(p=>p.playerId===id)!.name,season,date:`${season}年度`,coverage:"partial",metrics:Object.fromEntries(Object.entries(sumHistoricalRows(source).metrics).map(([k,value])=>[k,{value,status:value===null?"unavailable":"partial"}]))}]:[];});
  return <><p className="data-notice">{season}年の一部選手の球団別年度成績です。全選手の成績・ランキングではありません。</p>
    <details className="explorer-tools"><summary>収録範囲・出典について</summary><p>Wikipediaの年度表を既存の選手IDで照合し、数値と単位を検証しています。情報がない年度・選手を出場なしとは判定しません。試合別成績・Recent・規定資格は未収録です。全キャリア通算ではありません。</p><p>原本の取得日：{manifest.observedAt.slice(0,10)}。2026年のFacts・Coverage・HOT／ランキングの公開条件とは独立しています。</p><a href="https://creativecommons.org/licenses/by-sa/4.0/">抽出・正規化したデータはCC BY-SA 4.0</a></details>
    <div className="explorer-filter-grid"><label>成績<select value={role} onChange={e=>update("role",e.target.value)}><option value="batting">打撃（投手打撃を含む）</option><option value="pitching">投球</option></select></label><label>その年度の球団<select value={team} onChange={e=>{update("team",e.target.value);}}><option value="">すべて</option>{Object.entries(teams).map(([id,name])=><option key={id} value={`npb:team:${id}`}>{name}</option>)}</select></label><label>選手名<input type="search" value={query} onChange={e=>update("q",e.target.value)} /></label></div>
    {failed?<><DataState kind="source-unavailable" title="年度別成績を取得できません" /><button onClick={()=>setAttempt(a=>a+1)}>再試行</button></>:!data?<LoadingSkeleton />:<>
      {comparisonRows.length>0&&<section><h2>選んだ選手の収録分を比較</h2><label>指標<select value={metric} onChange={e=>update("sort1",e.target.value)}>{keys.map(k=><option key={k}>{k}</option>)}</select></label><ComparisonBars rows={comparisonRows} metric={metric} /><p className="inline-note">{season}年・{team?teamName(team):"収録球団"}の範囲。公式資格や優劣の判定ではありません。</p></section>}
      {playerId&&!player&&<DataState kind="no-data" title="指定した選手の過去年度成績は未収録です" />}
      {player&&<PlayerHistory manifest={manifest} playerId={player.playerId} role={role} current={data} />}
      <h2>{candidates.length}選手 · {safePage}/{pages}ページ</h2>{!visible.length&&<DataState kind="no-data" title="条件に一致する収録データがありません" />}
      <div className="row-list">{visible.map(p=>{const records=rows.filter(r=>r.playerId===p.playerId);return <article className="explorer-result" key={p.playerId}><h3><button className="text-link" onClick={()=>update("player",p.playerId)}>{p.name}</button></h3>{records.map(r=><div key={r.teamId}><p>{season}年 · {teamName(r.teamId)}</p><Numbers rows={[r]} role={role} /></div>)}<div className="explorer-links"><label><input type="checkbox" checked={ids.includes(p.playerId)} disabled={!ids.includes(p.playerId)&&ids.length>=4} onChange={()=>update("recentPlayers",ids.includes(p.playerId)?ids.filter(id=>id!==p.playerId).join(","):[...ids,p.playerId].join(","))} /> 比較（最大4人）</label><Link to={`/NPB/players/${p.playerId}`}>2026年の選手ページ →</Link><button className="text-link" onClick={()=>update("player",p.playerId)}>年度推移・収録年合計</button></div><Credits data={data} playerId={p.playerId} /></article>;})}</div>
      <nav className="hub-links" aria-label="過去年度の結果ページ"><button disabled={safePage<=1} onClick={()=>update("page",String(safePage-1))}>前へ</button><button disabled={safePage>=pages} onClick={()=>update("page",String(safePage+1))}>次へ</button></nav>
    </>}</>;
}
function PlayerHistory({manifest,playerId,role,current}:{manifest:NpbHistoricalManifest;playerId:string;role:"batting"|"pitching";current:NpbHistoricalDataset}) {
  const [params,setParams]=useSearchParams(),player=manifest.players.find(p=>p.playerId===playerId)!;
  const raw=params.get("years"),years=useMemo(()=>raw===null?player.seasons.slice(-3):[...new Set(raw.split(",").filter(y=>/^\d{4}$/.test(y)).map(Number).filter(y=>player.seasons.includes(y)))].slice(0,4),[raw,player]);
  const key=`${playerId}:${years.join(",")}:${manifest.inputSha256}`;
  const [result,setResult]=useState<{key:string;data:NpbHistoricalDataset[];error:boolean}|null>(null);
  useEffect(()=>{let active=true;void Promise.all(years.map(y=>current.rows.some(r=>r.season===y)?Promise.resolve(current):readNpbHistoricalSeason(y,manifest))).then(data=>{if(active)setResult({key,data,error:false});}).catch(()=>{if(active)setResult({key,data:[],error:true});});return()=>{active=false;};},[key,current,manifest,years]);
  const records=result?.key===key?result.data.flatMap(d=>d.rows.filter(r=>r.playerId===playerId&&r.role===role)):[];
  const values:ComparisonRow[]=years.flatMap(season=>{const rs=records.filter(r=>r.season===season);return rs.length?[{id:String(season),name:`${season}年 · ${[...new Set(rs.map(r=>teamName(r.teamId)))].join(" / ")}`,season,date:String(season),coverage:"partial",metrics:Object.fromEntries(Object.entries(sumHistoricalRows(rs).metrics).map(([k,value])=>[k,{value,status:value===null?"unavailable":"partial"}]))}]:[];});
  return <section className="profile-content"><h2>{player.name} · 収録済み年度の比較</h2><fieldset><legend>比較年度（最大4年）</legend><div className="hub-links">{player.seasons.map(y=><label key={y}><input type="checkbox" checked={years.includes(y)} disabled={!years.includes(y)&&years.length>=4} onChange={()=>setParams(previous=>{const p=new URLSearchParams(previous);p.set("years",(years.includes(y)?years.filter(n=>n!==y):[...years,y]).sort((a,b)=>a-b).join(","));return p;})} /> {y}</label>)}</div></fieldset>
    {!years.length?<p>比較する年度を選んでください。</p>:result?.key!==key?<LoadingSkeleton />:result.error?<DataState kind="source-unavailable" title="年度比較を取得できません" />:!records.length?<DataState kind="no-data" title="選択年度のこの役割の成績は未収録です" />:<><ComparisonBars rows={values} metric={role==="batting"?"OPS":"ERA"} /><h3>{[...new Set(records.map(r=>r.season))].sort((a,b)=>a-b).join(" / ")}年の収録行合計</h3><Numbers rows={records} role={role} /><p className="inline-note">選択した年度・球団別行のみの合計です。欠けた年度・移籍先の行を補わず、全キャリア通算や完全な年度合計とは扱いません。</p></>}
  </section>;
}
