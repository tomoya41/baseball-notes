import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Services } from "../app/services";
import { ageOnDate, type NpbCatalog } from "../domain/npb-product-contract";
import { lifecycleCoverage, lifecyclePlayers, lifecycleQuery, playerSchools, validateLifecycleStats, type LifecyclePlayer } from "../domain/npb-lifecycle";
import { positionDefinitions } from "../domain/baseball-terms";
import { readableMetric, type ExplorerRow } from "../domain/data-explorer";
import { readNpbExplorerSeason, readNpbRecentExplorer } from "../application/explorer-readers";
import { DataState, LoadingSkeleton, MetricLabel, PageHeading } from "./components";
import { Monogram } from "./design-system";

export function LifecycleLinks({ teamId, active }: {teamId?:string;active?:string}) {
  const suffix = teamId ? `&team=${encodeURIComponent(teamId)}` : "";
  return <nav className="explorer-links" aria-label="選手の歩みを探す"><Link aria-current={active === "draft" ? "page" : undefined} to={`/NPB/talent?view=draft${suffix}`}>Draft履歴</Link><Link aria-current={active === "young" ? "page" : undefined} to={`/NPB/talent?view=young${suffix}`}>若手探索</Link><Link aria-current={active === "school" ? "page" : undefined} to={`/NPB/talent?view=school${suffix}`}>学校・球歴</Link></nav>;
}
export function ProfileCredits({ player }: {player:LifecyclePlayer}) {
  return <details className="advanced-disclosure"><summary>プロフィールの出典・利用条件</summary><p>公開masterに採用済みの情報だけを使用しています。未確認・競合中の候補は補完しません。</p>{player.profile.credits?.map((c,i) => <p key={i}><a href={c.url} target="_blank" rel="noreferrer">{c.name}</a> · <a href={c.licenseUrl} target="_blank" rel="noreferrer">利用条件</a><small> · {c.fields.join(" / ")} · 構造化・加工済み</small></p>)}<Link to="/MLB/sources">Data Sources / Attribution →</Link></details>;
}
export function PlayerLifecycle({ player, effectiveDate }: {player:LifecyclePlayer;effectiveDate?:string}) {
  const f=player.profile, schools=playerSchools(player), date=effectiveDate ?? f.ageAsOfDate;
  return <section className="player-lifecycle" aria-labelledby="lifecycle-title"><h2 id="lifecycle-title">選手の歩み</h2><p className="inline-note">確認済みの部分履歴です。完全なCareer・在籍期間・現在の登録を示しません。</p>
    <ol className="lifecycle-timeline">
      {!!schools.length && <li><h3>学校・アマチュア球歴</h3>{schools.map(name => <Link key={name} to={`/NPB/talent?view=school&school=${encodeURIComponent(name)}`}>{name}</Link>)}<small>確認済みの学校・所属名。卒業や期間を推定しません。</small></li>}
      {f.draftYear !== null && <li><h3>{f.draftYear}年 Draft</h3><p>{f.draftRound ?? "順位未確認"} · {f.draftType === "regular" ? "通常指名" : f.draftType === "developmental" ? "育成指名" : "区分未確認"} · {f.draftTeamName ?? "指名球団未確認"}</p><Link to={`/NPB/talent?year=${f.draftYear}`}>{f.draftYear} Draft Class →</Link></li>}
      {!!f.affiliations?.length && <li><h3>保存済み所属履歴</h3>{f.affiliations.map((a,i) => <p key={i}>{a.name}{a.from || a.to ? ` · ${a.from ?? "開始未確認"}〜${a.to ?? "終了未確認"}` : " · 期間未確認"}</p>)}</li>}
      <li><h3>{date.slice(0,4)} 保存シーズン</h3><p>{date}時点の保存済みデータ</p><Link to={`/NPB/players/${player.playerId}/stats`}>Season成績 →</Link></li>
    </ol><LifecycleLinks /><ProfileCredits player={player} />
  </section>;
}
type StatsState = {key:string;rows:ExplorerRow[];coverage:"complete"|"partial"|"unknown"|"unavailable";error:boolean};
const coverageLabels = {complete:"Coverage確認済み",partial:"Coverage一部未確認",unknown:"Coverage未確認",unavailable:"Coverage利用不可"} as const;
export function NpbLifecycleExplorer({ services }: {services:Services}) {
  const [catalog,setCatalog]=useState<NpbCatalog|null>(null), [failed,setFailed]=useState(false), [attempt,setAttempt]=useState(0);
  useEffect(()=>{let active=true;void services.product.catalog().then(c=>{if(active){setCatalog(c);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[services,attempt]);
  if (!catalog) return failed ? <div className="screen"><DataState kind="source-unavailable" title="確認済みプロフィールを読み込めません" /><button onClick={()=>setAttempt(a=>a+1)}>再読み込み</button></div> : <LoadingSkeleton />;
  return <LifecycleWorkspace catalog={catalog} />;
}
export function LifecycleWorkspace({catalog}:{catalog:NpbCatalog}) {
  const [params,setParams]=useSearchParams(), query=lifecycleQuery(params,catalog), coverage=lifecycleCoverage(catalog);
  const [stats,setStats]=useState<StatsState|null>(null), [retries,setRetries]=useState<Record<string,number>>({});
  const successfulStats = useRef<{ catalog: NpbCatalog; retry: number; value: StatsState } | null>(null);
  const key=`${catalog.effectiveDate}:${query.period}`;
  const retry=retries[key] ?? 0;
  useEffect(()=>{
    if (query.errors.length) return;
    // Metadata validation must not discard or re-download a successful period.
    // An explicit retry and a different Catalog/period still initiate a read.
    const loaded = successfulStats.current;
    let active=true;
    if (loaded?.catalog === catalog && loaded.retry === retry && loaded.value.key === key) {
      queueMicrotask(() => { if (active) setStats(loaded.value); });
      return () => { active = false; };
    }
    const directory={effectiveDate:catalog.effectiveDate,players:catalog.players.map(p=>({playerId:p.playerId,displayName:p.displayName,teamId:p.membership.teamId}))};
    void (query.period === "season" ? readNpbExplorerSeason(Number(catalog.effectiveDate.slice(0,4))) : readNpbRecentExplorer(Number(query.period) as 7|14|30,directory)).then(p=>{
      validateLifecycleStats(catalog,p);
      if(active){
        const value = {key,coverage:p.coverage.status,error:false,rows:p.players.map(r=>({playerId:r.playerId,name:r.displayName,teamId:r.teamId,batting:r.batting?.metrics ?? null,pitching:r.pitching?.metrics ?? null}))};
        successfulStats.current = {catalog,retry,value};
        setStats(value);
      }
    }).catch(()=>{if(active)setStats({key,coverage:"unavailable",rows:[],error:true});});
    return()=>{active=false;};
  },[catalog,key,query.period,query.errors.length,retry]);
  const rows=stats?.key === key ? stats.rows : [], byId=new Map(rows.map(r=>[r.playerId,r]));
  const players=lifecyclePlayers(catalog,query,rows), teamNames=new Map(catalog.teams.map(t=>[t.teamId,t.shortName]));
  const update=(name:string,value:string)=>setParams(previous=>{const next=new URLSearchParams(previous);if(value)next.set(name,value);else next.delete(name);if(name!=="page" && name!=="compare")next.delete("page");if(["role","year","from","to","view"].includes(name))next.delete("compare");if(name==="year"){next.delete("from");next.delete("to");}if(name==="from"||name==="to")next.delete("year");if(name==="role")next.delete("minimum");return next;},{replace:["q","school","ageMin","ageMax","minimum"].includes(name)});
  const compare=[...new Set((params.get("compare")??"").split(","))].filter(id=>catalog.players.some(p=>p.playerId===id && (query.role==="pitching" ? p.pitchingAvailable : p.battingAvailable))).slice(0,4);
  const pageRaw=Number(params.get("page")??0), pages=Math.max(1,Math.ceil(players.length/30)), page=Number.isSafeInteger(pageRaw)&&pageRaw>=0?Math.min(pageRaw,pages-1):0;
  const availableYears=[...new Set(catalog.players.flatMap(p=>p.profile.draftYear === null?[]:[p.profile.draftYear]))].sort((a,b)=>b-a);
  const title=query.mode==="young"?"若手探索":query.mode==="school"?"学校・球歴から探す":query.year!==null?`${query.year} Draft Class`:"Draft履歴";
  const ready=stats?.key===key && !stats.error;
  return <div className="screen lifecycle-explorer"><PageHeading eyebrow="NPB · SAVED PLAYER DISCOVERY" title={title} /><LifecycleLinks active={query.mode} />
    <p className="inline-note">{query.mode === "young" ? "確認済み生年月日から基準日の年齢で探します。" : query.mode === "school" ? "確認済みの学校・アマチュア所属名から探します。" : "確認済みDraft情報を持つ収録選手を探索します。"} 指名全員の収録・新人資格・Prospect評価を表しません。</p>
    <details className="advanced-disclosure"><summary>情報の収録範囲・出典</summary><dl className="lifecycle-coverage">{Object.entries({"Draft年":coverage.draftYear,"指名順位":coverage.draftRound,"Draft区分":coverage.draftType,"指名球団の照合済み情報":coverage.draftTeam,"生年月日":coverage.birthDate,"学校・アマチュア球歴":coverage.school,"所属履歴":coverage.history}).map(([name,n])=><div key={name}><dt>{name}</dt><dd>{n}/{coverage.total}</dd></div>)}</dl><p>Draft年・順位・区分の未確認は「指名なし」を意味しません。指名球団filterは照合済みの一部だけが対象です。所属は最新保存情報で、現在の登録公示ではありません。採用済みCC0/CC BY-SA等の出典は各選手の情報から確認できます。</p><Link to="/MLB/sources">Data Sources / Attribution →</Link></details>
    <div className="explorer-filter-grid">{query.mode === "draft" ? <label>Draft年<select value={params.get("year")??""} onChange={e=>update("year",e.target.value)}><option value="">すべての確認済み年</option>{availableYears.map(y=><option key={y}>{y}</option>)}</select></label> : query.mode === "young" ? <label>年齢上限<input type="number" min="0" max="100" value={params.get("ageMax")??"25"} onChange={e=>update("ageMax",e.target.value)} /></label> : <label>学校・アマチュア所属名<input type="search" value={query.school} onChange={e=>update("school",e.target.value)} /></label>}<label>成績の種類<select value={query.role} onChange={e=>update("role",e.target.value)}><option value="all">全選手</option><option value="batting">打撃データあり</option><option value="pitching">投球データあり</option></select></label></div>
    <label className="search-field"><span className="sr-only">選手名</span><input type="search" placeholder="選手名" value={query.name} onChange={e=>update("q",e.target.value)} /></label>
    <details className="explorer-filters"><summary>Draft・学校・年齢の条件</summary><div className="explorer-filter-grid">
      <label>保存済み所属<select value={query.team} onChange={e=>update("team",e.target.value)}><option value="">すべて</option>{catalog.teams.map(t=><option value={t.teamId} key={t.teamId}>{t.shortName}</option>)}</select></label>
      {query.mode !== "draft" && <label>Draft年<select value={params.get("year")??""} onChange={e=>update("year",e.target.value)}><option value="">指定なし</option>{availableYears.map(y=><option key={y}>{y}</option>)}</select></label>}
      {query.mode !== "young" && <label>年齢上限<input type="number" min="0" max="100" value={params.get("ageMax")??""} onChange={e=>update("ageMax",e.target.value)} /></label>}
      <label>指名順位<select value={query.round} onChange={e=>update("round",e.target.value)}><option value="">すべて</option><option value="unknown">順位未確認</option>{[...new Set(catalog.players.flatMap(p=>p.profile.draftRound===null?[]:[p.profile.draftRound]))].sort((a,b)=>a.localeCompare(b,"ja",{numeric:true})).map(r=><option key={r}>{r}</option>)}</select></label>
      <label>Draft区分<select value={query.type} onChange={e=>update("type",e.target.value)}><option value="">すべて</option><option value="regular">通常指名</option><option value="developmental">育成指名</option><option value="unknown">区分未確認</option></select></label>
      <label>指名球団（照合済み{coverage.draftTeam}人のみ）<select value={query.draftTeam} onChange={e=>update("draftTeam",e.target.value)}><option value="">指定なし</option>{catalog.teams.map(t=><option key={t.teamId} value={t.teamId}>{t.shortName}</option>)}</select></label>
      <label>主ポジション<select value={query.position} onChange={e=>update("position",e.target.value)}><option value="">すべて</option>{[...new Set(catalog.players.flatMap(p=>p.profile.position?[p.profile.position]:[]))].map(p=><option value={p} key={p}>{positionDefinitions[p]}</option>)}</select></label>
      <label>Draft開始年<input type="number" value={params.get("from")??""} onChange={e=>update("from",e.target.value)} /></label><label>Draft終了年<input type="number" value={params.get("to")??""} onChange={e=>update("to",e.target.value)} /></label>
      <label>年齢下限<input type="number" min="0" value={params.get("ageMin")??""} onChange={e=>update("ageMin",e.target.value)} /></label><label>年齢の基準日<input type="date" max={catalog.effectiveDate} value={params.get("asOf")??catalog.effectiveDate} onChange={e=>update("asOf",e.target.value)} /></label>
      {query.mode !== "school" && <label>学校・アマチュア所属名<input type="search" value={query.school} onChange={e=>update("school",e.target.value)} /></label>}
    </div>{query.mode==="draft" && <label><input type="checkbox" checked={query.includeUnknown} onChange={e=>update("unknown",e.target.checked?"1":"")} />Draft年未確認の収録選手も表示</label>}<p className="inline-note">学校名は保存表記を部分一致検索します。同名校の同一性・卒業・在籍期間を認定しません。</p></details>
    <div className="explorer-filter-grid"><label>表示成績<select value={query.period} onChange={e=>update("period",e.target.value)}><option value="season">保存Season</option>{[7,14,30].map(d=><option value={d} key={d}>直近{d}日</option>)}</select></label><label>最低{query.role==="pitching"?"投球アウト数（3＝1回）":"PA"}<input type="number" min="0" disabled={query.role==="all"} value={params.get("minimum")??"0"} onChange={e=>update("minimum",e.target.value)} /></label></div>
    <p className="inline-note">年齢基準 {query.date} · 成績 {catalog.effectiveDate}までの{query.period==="season"?"保存Season":`直近${query.period}日`} · {ready ? coverageLabels[stats.coverage]:stats?.key === key && stats.error ? "成績未取得" : "成績確認中"}。球団は最新保存所属で、成績には移籍前も含みます。</p>
    {query.errors.map(error=><p className="data-notice" role="alert" key={error}>{error}</p>)}
    {!query.errors.length && stats?.key!==key && <LoadingSkeleton />}
    {stats?.key===key && stats.error && <><DataState kind="source-unavailable" title="成績を読み込めません" detail="確認済みプロフィールは維持しています。未取得の成績を0にしません。" /><button className="text-button" onClick={()=>setRetries(previous=>({...previous,[key]:(previous[key] ?? 0)+1}))}>成績を再読み込み</button></>}
    <div className="list-heading"><strong>{players.length}人 · 保存済み選手</strong><span>{page+1}/{pages}</span></div>
    {query.role==="all" ? <p className="inline-note">同期比較には打撃または投球を選び、2〜4人を選択してください。</p> : <div className="lifecycle-compare"><span>比較 {compare.length}/4人</span>{compare.length>=2 && <Link className="button button--secondary" to={`/NPB/compare?players=${compare.map(encodeURIComponent).join("%2C")}&role=${query.role}&condition=${query.period==="season"?"season":`${query.period}d`}`}>同期を比較 →</Link>}{compare.length>0&&<button className="text-button" onClick={()=>update("compare","")}>選択解除</button>}</div>}
    <div className="explorer-results">{players.slice(page*30,(page+1)*30).map(p=>{
      const age=ageOnDate(p.profile.birthDate,query.date), r=byId.get(p.playerId), role=query.role==="pitching"?"pitching":"batting", values=r?.[role];
      const keys=role==="pitching"?["outsRecorded","ERA","SO"]:["PA","OPS","HR"];
      return <article className="explorer-result lifecycle-result" key={p.playerId}><div className="lifecycle-identity"><Monogram name={p.displayName} /><Link to={`/NPB/players/${p.playerId}`}><strong>{p.displayName}</strong><small>{p.profile.position?positionDefinitions[p.profile.position]:"主ポジション未確認"} · {age===null?"年齢未確認":`${age}歳`} · {p.membership.teamId?teamNames.get(p.membership.teamId):"保存所属未確認"}</small></Link></div>
        <p className="lifecycle-draft">{p.profile.draftYear===null?"Draft年未確認":<Link to={`/NPB/talent?year=${p.profile.draftYear}&role=${query.role}`}>{p.profile.draftYear} Draft Class</Link>} · {p.profile.draftRound??"順位未確認"} · {p.profile.draftType==="regular"?"通常指名":p.profile.draftType==="developmental"?"育成指名":"区分未確認"}</p>
        <small>指名球団：{p.profile.draftTeamId?teamNames.get(p.profile.draftTeamId):p.profile.draftTeamName?`${p.profile.draftTeamName}（球団照合未確認）`:"未確認"}</small>
        {playerSchools(p).length>0&&<details><summary>学校・球歴 {playerSchools(p).length}件</summary>{playerSchools(p).map(name=><Link className="lifecycle-school" key={name} to={`/NPB/talent?view=school&school=${encodeURIComponent(name)}`}>{name}</Link>)}</details>}
        {query.role!=="all"&&<dl className="explorer-metrics">{keys.map(k=>{const value=ready?readableMetric(values?.[k]):null;return <div key={k}><dt><MetricLabel metric={k} /></dt><dd>{value===null?"—":k==="outsRecorded"?`${Math.floor(value/3)}.${value%3}`:["OPS","ERA"].includes(k)?value.toFixed(k==="OPS"?3:2):value}{values?.[k]?.status==="partial"&&<small> 一部</small>}</dd></div>;})}</dl>}
        <div className="lifecycle-actions"><Link to={`/NPB/players/${p.playerId}/more`}>選手の歩み・出典 →</Link>{query.role!=="all"&&<label><input type="checkbox" aria-label={`${p.displayName}を同期比較に選択`} checked={compare.includes(p.playerId)} disabled={!compare.includes(p.playerId)&&compare.length>=4} onChange={()=>update("compare",(compare.includes(p.playerId)?compare.filter(id=>id!==p.playerId):[...compare,p.playerId]).join(","))} />比較</label>}</div>
      </article>;
    })}</div>
    {!players.length&&!query.errors.length&&(query.minimum===0 || ready)&&<DataState kind="no-data" title="条件に合う確認済み選手がいません" detail="未確認の情報を条件に一致したものとして扱いません。" />}
    {pages>1&&<nav className="explorer-pagination" aria-label="Draft探索のページ"><button disabled={!page} onClick={()=>update("page",String(page-1))}>前へ</button><span>{page+1}/{pages}</span><button disabled={page+1>=pages} onClick={()=>update("page",String(page+1))}>次へ</button></nav>}
    <Link className="text-link" to="/NPB/data">成績の条件を詳しく探す →</Link>
  </div>;
}
