import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { readNpbHistoricalManifest, readNpbHistoricalSeason } from "../application/npb-historical-reader";
import { sumHistoricalRows, historicalBattingKeys, historicalPitchingKeys, type NpbHistoricalDataset, type NpbHistoricalManifest, type NpbHistoricalRow } from "../domain/npb-historical";
import { normalizePlayerSearch } from "../domain/npb-player-directory";
import { comparisonValue, type ComparisonRow } from "../domain/product-comparison";
import { DataState, LoadingSkeleton, MetricLabel, PageHeading } from "./components";
import { ComparisonBars } from "./comparison-bars";
import { FavoriteButton } from "./components";
import type { FavoriteActions } from "./team-favorite";
import { npbCompetitionLabels } from "../domain/npb-competition";
import type { NpbPostseasonAggregateDataset } from "../domain/npb-competition";
import { admittedNpbPostseasonScopes, readNpbPostseasonAggregates } from "../application/npb-competition-reader";
import type { NpbDirectoryPlayer, NpbPlayerDirectory } from "../domain/npb-player-directory";
import { NpbPlayerProgression } from "./npb-player-progression";
import { admittedCsScopes } from "../application/npb-cs-reader";
import { NpbCsPlayerStats } from "./npb-cs";
import { PublishedPlayerFallback } from "./npb-published-player";
import { HistoricalCredits as Credits } from "./npb-historical-credits";
import { NpbHistoricalCohort, type CohortRepository } from "./npb-historical-cohort";
import { NpbAgeSeason } from "./npb-age-season";
import { NpbPlayerStory } from "./npb-player-story";

const teams:Record<string,string>={giants:"巨人",tigers:"阪神",dragons:"中日",carp:"広島",swallows:"ヤクルト",baystars:"DeNA",hawks:"ソフトバンク",fighters:"日本ハム",lions:"西武",marines:"ロッテ",eagles:"楽天",buffaloes:"オリックス"};
const teamName=(id:string)=>teams[id.split(":").at(-1)!]??"球団未確認";
function Numbers({rows,role}:{rows:NpbHistoricalRow[];role:"batting"|"pitching"}) {
  const {metrics}=sumHistoricalRows(rows),keys=role==="batting"?["PA","H","HR","RBI","AVG","OPS"]:["G","W","outsRecorded","SO","ERA"];
  return <dl className="explorer-values">{keys.map(k=><div key={k}><dt><MetricLabel metric={k} label={k==="outsRecorded"?"投球回":k} /></dt><dd>{comparisonValue(k,metrics[k]??null)}</dd></div>)}</dl>;
}
function AggregateDetails({row}:{row:NpbHistoricalRow}) {
  const [open,setOpen]=useState(false),keys=row.role==="batting"?historicalBattingKeys:historicalPitchingKeys;
  const labels:Record<string,string>={outsRecorded:"投球回",noWalkGames:"無四球試合",CG:"完投",SHO:"完封",WPCT:"勝率",BF:"対戦打者",GDP:"併殺打",IBB:"故意四球",WP:"暴投",BK:"ボーク"};
  return <details className="explorer-tools" onToggle={e=>setOpen(e.currentTarget.open)}><summary>詳細成績</summary>{open&&<><dl className="explorer-values">{keys.map(k=><div key={k}><dt><MetricLabel metric={k} label={labels[k]??k} /></dt><dd>{comparisonValue(k,row.metrics[k]??null)}</dd></div>)}</dl><p className="inline-note">原表にない項目は「—」。率指標は原表の表示値です。</p></>}</details>;
}
/** Explicit navigation only: no extra requests on Home or the Current player overview. */
export function NpbPlayerSeasons({repository,profileRepository}:{repository:{findLatestNpb():Promise<NpbPlayerDirectory>};profileRepository?:CohortRepository}) {
  const {playerId}=useParams(),[params,setParams]=useSearchParams();
  const [pastOpen,setPastOpen]=useState(false);
  const [manifest,setManifest]=useState<NpbHistoricalManifest|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  const [directoryPlayer,setDirectoryPlayer]=useState<NpbDirectoryPlayer|null>(null),[directoryState,setDirectoryState]=useState<"loading"|"ready"|"error">("loading");
  const canonical=!!playerId&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(playerId);
  const player=manifest?.players.find(p=>p.playerId===playerId);
  const season=params.get("season")??(player&&(player.identityScope||directoryState==="ready"&&!directoryPlayer)?String(player.seasons.at(-1)):"2026"),role=params.get("role")==="pitching"?"pitching":"batting";
  const validRole=!params.has("role")||["batting","pitching"].includes(params.get("role")!);
  const competition=params.get("competition")??"regular",stage=params.get("stage");
  useEffect(()=>{if(!canonical)return;let active=true;void readNpbHistoricalManifest().then(m=>{if(active){setManifest(m);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[attempt,canonical]);
  useEffect(()=>{if(!canonical||(!manifest&&!failed)||player?.identityScope)return;let active=true;queueMicrotask(()=>{if(active){setDirectoryState("loading");setDirectoryPlayer(null);}});void repository.findLatestNpb().then(d=>{if(active){setDirectoryPlayer(d.players.find(p=>p.playerId===playerId)??null);setDirectoryState("ready");}}).catch(()=>{if(active)setDirectoryState("error");});return()=>{active=false;};},[canonical,manifest,failed,player?.identityScope,playerId,repository]);
  const admitted=[...admittedNpbPostseasonScopes,...admittedCsScopes].filter(s=>s.playerId===playerId&&String(s.season)===season);
  const supported=season==="2026"?!!directoryPlayer:!!player?.seasons.some(y=>String(y)===season);
  const regular=competition==="regular"&&!stage;
  const validScope=regular||competition==="postseason"&&admitted.some(s=>s.stage===stage);
  const update=(key:string,value:string)=>setParams(previous=>{const p=new URLSearchParams(previous);p.set(key,value);if(key==="season"){p.delete("years");if(![...admittedNpbPostseasonScopes,...admittedCsScopes].some(s=>s.playerId===playerId&&String(s.season)===value&&s.stage===p.get("stage"))){p.set("competition","regular");p.delete("stage");}}return p;});
  const currentLink=!!directoryPlayer;
  if(!canonical)return <DataState kind="no-data" title="選手IDを確認できません" action="選手を探す" to="/NPB/search" />;
  if(manifest&&!player&&directoryState==="ready"&&!directoryPlayer)return <DataState kind="no-data" title="収録されていない選手IDです" action="選手を探す" to="/NPB/search" />;
  return <div className="screen"><PageHeading eyebrow="NPB · 年度・大会" title={player?.name??directoryPlayer?.displayName??"選手の年度別成績"} />
    {currentLink&&<Link to={`/NPB/players/${playerId}`}>2026年の選手ページへ</Link>}
    <div className="explorer-filter-grid"><label>年度<select value={season} aria-label="選手成績の年度" onChange={e=>update("season",e.target.value)}>{currentLink&&<option value="2026">2026年 · 保存済み</option>}{player?.seasons.slice().reverse().map(y=><option key={y} value={y}>{y}年 · 一部収録</option>)}{!supported&&<option value={season}>{!player?.identityScope&&directoryState==="loading"?"情報を確認中":"未収録の年度"}</option>}</select></label>
      <label>大会<select value={validScope?(regular?"regular":stage!):"unavailable"} aria-label="選手成績の大会" onChange={e=>setParams(previous=>{const p=new URLSearchParams(previous);if(e.target.value==="regular"){p.set("competition","regular");p.delete("stage");}else{p.set("competition","postseason");p.set("stage",e.target.value);}p.delete("years");return p;})}><option value="regular">公式戦</option>{!validScope&&<option value="unavailable">指定の大会は未収録</option>}{(["preseason","npb_cs_first","npb_cs_final","japan_series"] as const).map(key=>{const available=admitted.some(s=>s.stage===key);return <option key={key} value={key} disabled={!available}>{npbCompetitionLabels[key]}{!available&&" · 未収録"}</option>;})}</select></label>
      <label>成績<select value={validRole?role:"unsupported"} onChange={e=>update("role",e.target.value)}>{!validRole&&<option value="unsupported" disabled>未対応の成績区分</option>}<option value="batting">打撃（投手打撃を含む）</option><option value="pitching">投球</option></select></label></div>
    {profileRepository&&supported&&validRole&&regular&&<details className="explorer-tools" open={params.get("story")==="1"} onToggle={e=>{const open=e.currentTarget.open;if(open!==(params.get("story")==="1"))setParams(previous=>{const next=new URLSearchParams(previous);if(open)next.set("story","1");else next.delete("story");return next;});}}><summary>選手の歩み · 経歴と収録シーズン</summary>{params.get("story")==="1"&&<NpbPlayerStory playerId={playerId!} role={role} manifest={manifest} repository={profileRepository} />}</details>}
    {failed&&season==="2026"&&<p className="inline-note">過去年度の一覧は取得できません。2026年の成績は独立した保存データです。<button onClick={()=>{setFailed(false);setAttempt(a=>a+1);}}>過去年度の一覧を再試行</button></p>}
    <details className="explorer-tools"><summary>大会ごとの収録状況</summary><p>2026年のCSは一部試合・選手のみ収録しています。オープン戦・日本シリーズの選手成績は未収録です。過去のポストシーズンは一部選手・大会のみ。出場なし・0成績とは判定しません。公式戦へ加算せず、大会ごとの取得・保存・公開条件を確認してから追加します。</p><p>2026年の所属・背番号・登録状態は過去年度の成績から推定しません。年度別成績には試合別成績やRecentは含まれません。</p><div className="hub-links"><a href="https://npb.jp/preseason/2026/" target="_blank" rel="noreferrer">オープン戦の公式情報</a><a href="https://npb.jp/games/2026/info_cs.html" target="_blank" rel="noreferrer">CSの公式規定</a><a href="https://npb.jp/nippons/2026/" target="_blank" rel="noreferrer">日本シリーズの公式情報</a></div></details>
    {!validRole?<DataState kind="unsupported" title="指定した成績区分は未対応です" />:!validScope?<DataState kind="unsupported" title="指定の大会・ステージは未収録です" />:failed&&season!=="2026"?<><DataState kind="source-unavailable" title="年度一覧を取得できません" /><button onClick={()=>{setFailed(false);setAttempt(a=>a+1);}}>再試行</button></>:season!=="2026"&&!manifest||(!player&&directoryState==="loading")||!player?.identityScope&&season==="2026"&&directoryState==="loading"?<LoadingSkeleton />:(season==="2026"||!player)&&directoryState==="error"?<><DataState kind="source-unavailable" title="2026年の選手情報を確認できません" /><button onClick={()=>setAttempt(a=>a+1)}>再試行</button></>:!supported?<DataState kind="no-data" title="この選手の指定年度は未収録です" />:!regular&&season==="2026"?<NpbCsPlayerStats key={`${playerId}:${stage}:${role}`} playerId={playerId!} stage={stage!} role={role} repository={repository} />:!regular&&player&&manifest?<PostseasonPlayerHistory key={`${playerId}:${season}:${role}:${stage}`} manifest={manifest} playerId={player.playerId} season={Number(season)} stage={stage!} role={role} />:season==="2026"?<><p className="data-notice">2026年の保存済み公式戦成績は、過去年度と集計範囲・出典が異なるため、自動的に通算へ加算しません。</p><PublishedPlayerFallback key={`${playerId}:${role}:current`} playerId={playerId!} period="season" repository={repository} role={role} reason="saved" />{player&&manifest&&<details onToggle={e=>setPastOpen(e.currentTarget.open)}><summary>過去年の推移・収録内最高値</summary>{pastOpen&&<PlayerSeasonHistory key={`${playerId}:${role}:past`} manifest={manifest} playerId={player.playerId} season={player.seasons.at(-1)!} role={role} />}</details>}</>:player&&manifest?<PlayerSeasonHistory key={`${playerId}:${season}:${role}:${attempt}`} manifest={manifest} playerId={player.playerId} season={Number(season)} role={role} />:<DataState kind="no-data" title="この選手の過去年度成績は未収録です" />}
  </div>;
}
function PostseasonPlayerHistory({manifest,playerId,season,stage,role}:{manifest:NpbHistoricalManifest;playerId:string;season:number;stage:string;role:"batting"|"pitching"}) {
  const [data,setData]=useState<NpbPostseasonAggregateDataset|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  const [compare,setCompare]=useState(false),[regular,setRegular]=useState<NpbHistoricalDataset|null>(null),[compareFailed,setCompareFailed]=useState(false),[compareAttempt,setCompareAttempt]=useState(0);
  useEffect(()=>{let active=true;void readNpbPostseasonAggregates().then(d=>{if(active){setData(d);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[attempt]);
  useEffect(()=>{if(!compare)return;let active=true;void readNpbHistoricalSeason(season,manifest).then(d=>{if(active)setRegular(d);}).catch(()=>{if(active)setCompareFailed(true);});return()=>{active=false;};},[compare,manifest,season,compareAttempt]);
  if(failed)return <><DataState kind="source-unavailable" title="大会別成績を取得できません" /><button onClick={()=>{setFailed(false);setAttempt(a=>a+1);}}>再試行</button></>;
  if(!data)return <LoadingSkeleton />;
  const rows=data.rows.filter(r=>r.playerId===playerId&&r.season===season&&r.scope.stage===stage&&r.role===role),rs=regular?.rows.filter(r=>r.playerId===playerId&&r.role===role)??[];
  return <section><h2>{season}年 · {npbCompetitionLabels[stage as keyof typeof npbCompetitionLabels]}</h2><p className="data-notice">一部選手の大会別年度成績です。大会全体・全試合・全選手の完全収録ではありません。</p>{rows.length?rows.map(r=><div key={r.teamId}><h3>{teamName(r.teamId)} · {role==="batting"?"打撃":"投球"}</h3><Numbers rows={[r]} role={role} /><AggregateDetails row={r} /></div>):<DataState kind="no-data" title="この役割の大会別成績は未収録です" />}<Credits data={data} playerId={playerId} />
    <details className="explorer-tools" onToggle={e=>{if(e.currentTarget.open)setCompare(true);}}><summary>同年の公式戦成績と見比べる</summary><p>大会と出場母数が異なります。数値を合計せず、それぞれの収録範囲を示します。</p>{compareFailed?<><DataState kind="source-unavailable" title="公式戦成績を取得できません" /><button onClick={()=>{setCompareFailed(false);setCompareAttempt(a=>a+1);}}>比較を再試行</button></>:!regular?<LoadingSkeleton />:rs.length?<><h3>{season}年 · 公式戦（一部収録）</h3><Numbers rows={rs} role={role} /><Credits data={regular} playerId={playerId} /></>:<DataState kind="no-data" title="この役割の公式戦成績は未収録です" />}</details>
  </section>;
}
function PlayerSeasonHistory({manifest,playerId,season,role}:{manifest:NpbHistoricalManifest;playerId:string;season:number;role:"batting"|"pitching"}) {
  const [data,setData]=useState<NpbHistoricalDataset|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{let active=true;void readNpbHistoricalSeason(season,manifest).then(d=>{if(active)setData(d);}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[season,manifest,attempt]);
  if(failed)return <><DataState kind="source-unavailable" title="年度別成績を取得できません" /><button onClick={()=>{setFailed(false);setAttempt(a=>a+1);}}>年度成績を再試行</button></>;
  if(!data)return <LoadingSkeleton />;
  const rows=data.rows.filter(r=>r.playerId===playerId&&r.role===role);
  return <><p className="data-notice">{season}年 · 公式戦 · 球団別成績の一部収録</p>{rows.length?<section><h2>{season}年の{role==="batting"?"打撃":"投球"}成績</h2>{rows.map(r=><div key={r.teamId}><h3>{teamName(r.teamId)}</h3><Numbers rows={[r]} role={role} /><AggregateDetails row={r} /></div>)}<Credits data={data} playerId={playerId} /></section>:<DataState kind="no-data" title="この役割の指定年度成績は未収録です" />}<PlayerHistory manifest={manifest} playerId={playerId} role={role} current={data} activeSeason={season} closeable={false} /></>;
}
export function NpbHistoricalHistory({current,cohortRepository,...favorites}:{current:React.ReactNode;cohortRepository?:CohortRepository}&Partial<FavoriteActions>) {
  const [params,setParams]=useSearchParams(),[manifest,setManifest]=useState<NpbHistoricalManifest|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  const season=params.get("season")??"2026",role=params.get("role")==="pitching"?"pitching":"batting";
  useEffect(()=>{let active=true;void readNpbHistoricalManifest().then(m=>{if(active){setManifest(m);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[attempt]);
  const retry=()=>{setManifest(null);setFailed(false);setAttempt(a=>a+1);};
  const update=(key:string,value:string)=>setParams(previous=>{const p=new URLSearchParams(previous);if(value)p.set(key,value);else p.delete(key);return p;},{replace:key==="q"});
  const supported=season==="2026"||!!manifest?.seasons.some(s=>String(s.season)===season);
  if(params.get("cohort")==="ageSeason"&&cohortRepository)return <div className="screen"><PageHeading eyebrow="NPB · 過去の公式戦" title="同じ年齢のシーズン" />{failed?<><DataState kind="source-unavailable" title="過去年度の一覧を取得できません" /><button onClick={retry}>再試行</button></>:!manifest?<LoadingSkeleton />:<NpbAgeSeason manifest={manifest} repository={cohortRepository} />}</div>;
  return <div className="screen"><PageHeading eyebrow="NPB · 公式戦" title="シーズン履歴" />
    <label className="competition-season">年度<select aria-label="NPB履歴の年度" value={season} onChange={e=>update("season",e.target.value)}><option value="2026">2026年 · 保存済みの今季</option>{manifest?.seasons.slice().reverse().map(y=><option key={y.season} value={y.season}>{y.season}年 · 過去の成績（一部）</option>)}{!supported&&<option value={season}>未収録の年度</option>}</select></label>
    {params.get("competition")==="postseason"?<DataState kind="unsupported" title="NPBの過去のポストシーズンは未収録です" />:season==="2026"?(params.has("cohort")?<DataState kind="unsupported" title="同期の過去年度比較は収録済みの過去年を選んでください" />:current):failed?<><DataState kind="source-unavailable" title="過去年度の一覧を取得できません" /><button onClick={retry}>再試行</button></>:!manifest?<LoadingSkeleton />:!supported?<DataState kind="unsupported" title="指定した年度は未収録です" />:params.has("cohort")&&cohortRepository?<NpbHistoricalCohort key={`${season}:${attempt}`} manifest={manifest} season={Number(season)} repository={cohortRepository} />:<><Link to={`/NPB/history?season=${season}&role=${role}&cohort=birthYear`}>同世代・ドラフト同期の年度比較 →</Link><p><Link to={`/NPB/history?cohort=ageSeason&age=26&role=${role}`}>同じ年齢だったシーズンを比較 →</Link></p><HistoricalSeason key={`${season}:${attempt}`} manifest={manifest} season={Number(season)} role={role} params={params} update={update} retry={retry} {...favorites} /></>}
    {failed&&season==="2026"&&<p className="inline-note">過去年度の一覧を取得できません。<button onClick={retry}>再試行</button></p>}
  </div>;
}
function HistoricalSeason({manifest,season,role,params,update,retry,favorites=[],toggle,saving=false}:{manifest:NpbHistoricalManifest;season:number;role:"batting"|"pitching";params:URLSearchParams;update:(key:string,value:string)=>void;retry:()=>void}&Partial<FavoriteActions>) {
  const [data,setData]=useState<NpbHistoricalDataset|null>(null),[failed,setFailed]=useState(false);
  const query=params.get("q")??"",team=params.get("team")??"",page=/^\d{1,3}$/.test(params.get("page")??"")?Math.max(1,Math.min(100,Number(params.get("page")))):1;
  const playerId=params.get("player")??"",player=manifest.players.find(p=>p.playerId===playerId);
  const ids=[...new Set((params.get("recentPlayers")??"").split(",").filter(id=>manifest.players.some(p=>p.playerId===id)))].slice(0,4);
  useEffect(()=>{let active=true;void readNpbHistoricalSeason(season,manifest).then(d=>{if(active){setData(d);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[season,manifest]);
  const rows=data?.rows.filter(r=>r.role===role&&(!team||r.teamId===team))??[];
  const candidates=data?.players.filter(p=>rows.some(r=>r.playerId===p.playerId)&&(!query||normalizePlayerSearch(p.name).includes(normalizePlayerSearch(query))))??[];
  // The manifest already indexes all admitted years. Cross-year discovery needs no additional request.
  const otherYears=query?manifest.players.filter(p=>!p.seasons.includes(season)&&normalizePlayerSearch(p.name).includes(normalizePlayerSearch(query))).slice(0,10):[];
  const pages=Math.max(1,Math.ceil(candidates.length/30)),safePage=Math.min(page,pages),visible=candidates.slice((safePage-1)*30,safePage*30);
  const keys=role==="batting"?["AVG","OPS","H","HR"]:["ERA","SO","outsRecorded"];
  const metric=keys.includes(params.get("sort1")??"")?params.get("sort1")!:keys[0]!;
  const comparisonRows:ComparisonRow[]=ids.flatMap(id=>{const source=rows.filter(r=>r.playerId===id);return source.length?[{id,name:manifest.players.find(p=>p.playerId===id)!.name,season,date:`${season}年度`,coverage:"partial",metrics:Object.fromEntries(Object.entries(sumHistoricalRows(source).metrics).map(([k,value])=>[k,{value,status:value===null?"unavailable":"partial"}]))}]:[];});
  return <><p className="data-notice">{season}年の一部選手の球団別年度成績です。全選手の成績・ランキングではありません。</p>
    <details className="explorer-tools"><summary>収録範囲・出典について</summary><p>Wikipediaの年度表を独立した選手IDで照合し、数値と単位を検証しています。情報がない年度・選手を出場なしとは判定しません。試合別成績・Recent・規定資格は未収録です。全キャリア通算ではありません。</p><p>データをまとめた日：{manifest.observedAt.slice(0,10)}。2026年のFacts・Coverage・HOT／ランキングの公開条件とは独立しています。</p><a href="https://creativecommons.org/licenses/by-sa/4.0/">抽出・正規化したデータはCC BY-SA 4.0</a></details>
    <div className="explorer-filter-grid"><label>成績<select value={role} onChange={e=>update("role",e.target.value)}><option value="batting">打撃（投手打撃を含む）</option><option value="pitching">投球</option></select></label><label>その年度の球団<select value={team} onChange={e=>{update("team",e.target.value);}}><option value="">すべて</option>{Object.entries(teams).map(([id,name])=><option key={id} value={`npb:team:${id}`}>{name}</option>)}</select></label><label>選手名<input type="search" value={query} onChange={e=>update("q",e.target.value)} /></label></div>
    {failed?<><DataState kind="source-unavailable" title="年度別成績を取得できません" /><button onClick={retry}>再試行</button></>:!data?<LoadingSkeleton />:<>
      {comparisonRows.length>0&&<section><h2>選んだ選手の収録分を比較</h2><label>指標<select value={metric} onChange={e=>update("sort1",e.target.value)}>{keys.map(k=><option key={k}>{k}</option>)}</select></label><ComparisonBars rows={comparisonRows} metric={metric} /><p className="inline-note">{season}年・{team?teamName(team):"収録球団"}の範囲。公式資格や優劣の判定ではありません。</p><aside aria-label="選手比較データの出典">{comparisonRows.map(r=><p key={r.id}><Credits data={data} playerId={r.id} /></p>)}</aside></section>}
      {playerId&&!player&&<DataState kind="no-data" title="指定した選手の過去年度成績は未収録です" />}
      {player&&<PlayerHistory manifest={manifest} playerId={player.playerId} role={role} current={data} activeSeason={season} />}
      <h2>{candidates.length}選手 · {safePage}/{pages}ページ</h2>{!visible.length&&<DataState kind="no-data" title="条件に一致する収録データがありません" />}
      {otherYears.length>0&&<section><h3>別の年度に収録されている選手</h3><div className="row-list">{otherYears.map(p=><Link className="player-row" key={p.playerId} to={`/NPB/history?season=${p.seasons.at(-1)}&player=${p.playerId}&q=${encodeURIComponent(p.name)}`}><strong>{p.name}</strong><span>{p.seasons[0]}〜{p.seasons.at(-1)}年の一部 →</span></Link>)}</div></section>}
      <div className="row-list">{visible.map(p=>{const records=rows.filter(r=>r.playerId===p.playerId);return <article className="explorer-result" key={p.playerId}><h3><button className="text-link" onClick={()=>update("player",p.playerId)}>{p.name}</button></h3>{records.map(r=><div key={r.teamId}><p>{season}年 · {teamName(r.teamId)}</p><Numbers rows={[r]} role={role} /><AggregateDetails row={r} /></div>)}<div className="explorer-links"><label><input type="checkbox" checked={ids.includes(p.playerId)} disabled={!ids.includes(p.playerId)&&ids.length>=4} onChange={()=>update("recentPlayers",ids.includes(p.playerId)?ids.filter(id=>id!==p.playerId).join(","):[...ids,p.playerId].join(","))} /> 比較（最大4人）</label>{!p.identityScope&&<Link to={`/NPB/players/${p.playerId}`}>2026年の選手ページ →</Link>}{toggle&&<FavoriteButton active={favorites.some(f=>f.league==="NPB"&&f.kind==="player"&&f.entityId===p.playerId)} saving={saving} label={p.name} onClick={()=>toggle({league:"NPB",kind:"player",entityId:p.playerId})} />}<button className="text-link" onClick={()=>update("player",p.playerId)}>年度推移・収録年合計</button></div><Credits data={data} playerId={p.playerId} /></article>;})}</div>
      <nav className="hub-links" aria-label="過去年度の結果ページ"><button disabled={safePage<=1} onClick={()=>update("page",String(safePage-1))}>前へ</button><button disabled={safePage>=pages} onClick={()=>update("page",String(safePage+1))}>次へ</button></nav>
    </>}</>;
}
function PlayerHistory({manifest,playerId,role,current,activeSeason,closeable=true,initialSingle=false}:{manifest:NpbHistoricalManifest;playerId:string;role:"batting"|"pitching";current:NpbHistoricalDataset;activeSeason:number;closeable?:boolean;initialSingle?:boolean}) {
  const [attempt,setAttempt]=useState(0);
  const [params,setParams]=useSearchParams(),player=manifest.players.find(p=>p.playerId===playerId)!;
  const raw=params.get("years"),years=useMemo(()=>{
    if(raw!==null) return [...new Set(raw.split(",").filter(y=>/^\d{4}$/.test(y)).map(Number).filter(y=>player.seasons.includes(y)))].slice(0,4);
    if(initialSingle)return player.seasons.includes(activeSeason)?[activeSeason]:[];
    return player.seasons.filter(y=>y<=activeSeason).slice(-4);
  },[raw,player,activeSeason,initialSingle]);
  const key=`${playerId}:${years.join(",")}:${manifest.inputSha256}:${attempt}`;
  const [result,setResult]=useState<{key:string;data:NpbHistoricalDataset[];error:boolean}|null>(null);
  useEffect(()=>{let active=true;void Promise.all(years.map(y=>current.rows.some(r=>r.season===y)?Promise.resolve(current):readNpbHistoricalSeason(y,manifest))).then(data=>{if(active)setResult({key,data,error:false});}).catch(()=>{if(active)setResult({key,data:[],error:true});});return()=>{active=false;};},[key,current,manifest,years]);
  const records=result?.key===key?result.data.flatMap(d=>d.rows.filter(r=>r.playerId===playerId&&r.role===role)):[];
  const values:ComparisonRow[]=years.flatMap(season=>{const rs=records.filter(r=>r.season===season);return rs.length?[{id:String(season),name:`${season}年 · ${[...new Set(rs.map(r=>teamName(r.teamId)))].join(" / ")}`,season,date:String(season),coverage:"partial",metrics:Object.fromEntries(Object.entries(sumHistoricalRows(rs).metrics).map(([k,value])=>[k,{value,status:value===null?"unavailable":"partial"}]))}]:[];});
  const sources=new Map((result?.key===key?result.data:[]).filter(d=>d.rows.some(r=>r.playerId===playerId&&r.role===role)).map(d=>{const p=d.players.find(p=>p.playerId===playerId)!;return [`${p.article}:${p.revision}`,d] as const;}));
  return <section className="profile-content"><h2>{player.name} · 収録済み年度の比較</h2>{player.identityScope&&<p className="inline-note">過去年度の選手情報です。現在の登録や所属を示しません。</p>}{closeable&&<button className="text-link" onClick={()=>setParams(previous=>{const p=new URLSearchParams(previous);p.delete("player");p.delete("years");return p;})}>年度比較を閉じる</button>}<fieldset><legend>比較年度（最大4年）</legend><div className="hub-links">{player.seasons.map(y=><label key={y}><input type="checkbox" checked={years.includes(y)} disabled={!years.includes(y)&&years.length>=4} onChange={()=>setParams(previous=>{const p=new URLSearchParams(previous);p.set("years",(years.includes(y)?years.filter(n=>n!==y):[...years,y]).sort((a,b)=>a-b).join(","));return p;})} /> {y}</label>)}</div></fieldset>
    {!years.length?<p>比較する年度を選んでください。</p>:result?.key!==key?<LoadingSkeleton />:result.error?<><DataState kind="source-unavailable" title="年度比較を取得できません" /><button onClick={()=>setAttempt(a=>a+1)}>年度比較を再試行</button></>:!records.length?<DataState kind="no-data" title="選択年度のこの役割の成績は未収録です" />:<><NpbPlayerProgression rows={records} years={years} teamName={teamName} /><ComparisonBars rows={values} metric={role==="batting"?"OPS":"ERA"} /><h3>{[...new Set(records.map(r=>r.season))].sort((a,b)=>a-b).join(" / ")}年の収録行合計</h3><Numbers rows={records} role={role} /><p className="inline-note">選択した年度・球団別行のみの合計です。欠けた年度・移籍先の行を補わず、全キャリア通算や完全な年度合計とは扱いません。</p><aside aria-label="年度比較・合計データの出典">{[...sources].map(([key,d])=><p key={key}><Credits data={d} playerId={playerId} /></p>)}</aside></>}
  </section>;
}
