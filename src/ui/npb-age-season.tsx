import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { readNpbHistoricalSeason } from "../application/npb-historical-reader";
import { ageCollectedPlan, ageSeasonPlan, ageSeasonQuery, historicalBirthDate } from "../domain/npb-age-season";
import { sumHistoricalRows, type NpbHistoricalDataset, type NpbHistoricalManifest } from "../domain/npb-historical";
import { normalizePlayerSearch } from "../domain/npb-player-directory";
import type { NpbCatalog } from "../domain/npb-product-contract";
import { NpbHistoricalComparison } from "./npb-historical-comparison";
import { DataState, LoadingSkeleton } from "./components";
import { HistoricalCredits } from "./npb-historical-credits";
import type { CohortRepository } from "./npb-historical-cohort";
import { SaveViewButton } from "./personal-library";
import { CollectedRecordWatch } from "./npb-collected-records";
import { npbComparisonOrigin, npbHistoricalComparisonLinks } from "../domain/npb-player-journey";

export function NpbAgeSeason({ manifest, repository }: { manifest: NpbHistoricalManifest; repository: CohortRepository }) {
  const [params, setParams] = useSearchParams(), query = ageSeasonQuery(params);
  const [catalog, setCatalog] = useState<NpbCatalog | null>(null), [catalogFailed, setCatalogFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => { if (!query.valid) return; let active = true; void repository.catalog().then(c => { if (active) { setCatalog(c); setCatalogFailed(false); } }).catch(() => { if (active) setCatalogFailed(true); }); return () => { active = false; }; }, [repository, query.valid, attempt]);
  if (!query.valid) return <><DataState kind="unsupported" title="年齢・成績・比較選手の条件を確認してください" detail="公式戦の過去年度、0〜99歳、最大4人を指定できます。2026年の公式戦やCS・日本シリーズは含みません。" /><button onClick={() => setParams({ cohort: "ageSeason", age: "26", role: "batting" })}>条件を初期化</button></>;
  if (catalogFailed) return <><DataState kind="source-unavailable" title="生年月日の情報を取得できません" /><button onClick={() => { setCatalogFailed(false); setAttempt(n => n + 1); }}>再試行</button></>;
  if (!catalog) return <LoadingSkeleton />;
  return <AgeWorkspace key={manifest.inputSha256} manifest={manifest} catalog={catalog} params={params} update={(key, value) => setParams(previous => { const next = new URLSearchParams(previous); next.set(key, value); return next; })} />;
}

function AgeWorkspace({ manifest, catalog, params, update }: { manifest: NpbHistoricalManifest; catalog: NpbCatalog; params: URLSearchParams; update: (key: string, value: string) => void }) {
  const query = ageSeasonQuery(params), [search, setSearch] = useState(""), [attempt, setAttempt] = useState(0);
  const picker=useRef<HTMLDetailsElement>(null), searchInput=useRef<HTMLInputElement>(null);
  const collected=query.mode === "collected";
  const plan = collected?ageCollectedPlan(query.ids,query.age,catalog,manifest):ageSeasonPlan(query.ids,query.age,catalog,manifest).map(p=>({...p,seasons:p.available?[p.season!]:[]})), key = JSON.stringify([query.ids, query.age, query.role, query.mode, attempt]);
  const [confirmedKey,setConfirmedKey]=useState("");
  const cache = useRef(new Map<number, Promise<NpbHistoricalDataset>>());
  const [result, setResult] = useState<{ key: string; data: Map<number, NpbHistoricalDataset>; failed: number[] } | null>(null);
  const seasons = [...new Set(plan.flatMap(p => p.seasons))].sort((a, b) => a - b), seasonKey = seasons.join(",");
  const bytes=seasons.reduce((total,year)=>total+(manifest.seasons.find(s=>s.season===year)?.bytes??0),0), bounded=seasons.length<=36&&bytes<=8_000_000;
  const authorized=!collected||confirmedKey===key;
  useEffect(() => {
    let active = true;
    const years = seasonKey ? seasonKey.split(",").map(Number) : [];
    if(!authorized||!bounded)return()=>{active=false;};
    const values:{season:number;data:NpbHistoricalDataset|null}[]=[];
    let index=0;
    const worker=async()=>{while(active&&index<years.length){const season=years[index++]!;
      let task=cache.current.get(season);
      if(!task){task=readNpbHistoricalSeason(season,manifest).catch(error=>{cache.current.delete(season);throw error;});cache.current.set(season,task);}
      try{values.push({season,data:await task});}catch{values.push({season,data:null});}
    }};
    void Promise.all([worker(),worker()]).then(()=>{if(active)setResult({key,data:new Map(values.flatMap(v=>v.data?[[v.season,v.data] as const]:[])),failed:values.filter(v=>!v.data).map(v=>v.season)});});
    return () => { active = false; };
  }, [key, seasonKey, manifest,authorized,bounded]);
  const ready = result?.key === key;
  const observations = plan.map(p => {
    const datasets=ready?p.seasons.flatMap(year=>result.data.get(year)?[result.data.get(year)!]:[]):[];
    const rows=datasets.flatMap(data=>data.rows.filter(r=>r.playerId===p.playerId&&r.role===query.role));
    const failedYears=ready?p.seasons.filter(year=>result.failed.includes(year)):[];
    return {...p,datasets,rows,failedYears,aggregate:rows.length&&!failedYears.length?sumHistoricalRows(rows):null};
  });
  const options = query.role === "batting" ? collected?["HR","H","RBI","PA","OPS","AVG"]:["OPS", "AVG", "HR", "H", "PA"] : collected?["SO","W","outsRecorded","ERA","WHIP"]:["ERA", "SO", "outsRecorded", "WHIP"];
  const metric = options.includes(params.get("sort1") ?? "") ? params.get("sort1")! : options[0]!;
  const candidates = manifest.players.filter(p => historicalBirthDate(p.playerId,catalog,manifest).birthDate !== null && !query.ids.includes(p.playerId) && (!search || normalizePlayerSearch(p.name).includes(normalizePlayerSearch(search))));
  const teamName = (id: string) => catalog.teams.find(t => t.teamId === id)?.shortName ?? "球団未確認";
  const origin = npbComparisonOrigin(params), latest = Math.max(...manifest.seasons.map(s=>s.season));
  const originYear = manifest.seasons.some(s => String(s.season) === origin?.season) ? Number(origin?.season) : latest;
  const school = origin ? npbHistoricalComparisonLinks(origin.playerId, query.role, originYear, Number(origin.season), null).school :
    `/NPB/history?season=${latest}&role=${query.role}&cohort=schoolYear${query.ids[0]?`&peer=${query.ids[0]}`:""}`;
  const contenders = observations.map(p => {
    const profile = catalog.players.find(c => c.playerId === p.playerId);
    let reason = p.reason;
    if (p.failedYears.length) {
      reason = `年度成績を取得できません（${p.failedYears.join("・")}年）。${collected ? "合計は表示しません。" : ""}`;
    } else if (!reason && ready && !p.rows.length) {
      reason = "この役割の成績は未収録です。";
    } else if (!reason && !ready && bounded) {
      reason = authorized ? "年度成績を読み込み中です。" : "収録分の読み込み後に表示します。";
    }
    return {
      id: p.playerId, name: profile?.displayName ?? p.name, season: p.season, age: p.season === null ? null : query.age,
      metrics: p.aggregate?.metrics ?? null, teams: [...new Set(p.rows.map(r => teamName(r.teamId)))],
      collectedYears: collected ? p.aggregate?.seasons : undefined, reason, fetchFailed: p.failedYears.length > 0,
      annualSeason: p.aggregate?.seasons.at(-1), profileAvailable: !!profile,
      details: p.aggregate && <>
        <details><summary>年齢と成績の出典</summary>
          <p>生年月日 {p.birthDate} · {p.birthDateSource === "historical" ? "過去成績の確認済みIdentity" : `プロフィール基準 ${catalog.effectiveDate}`}。年度末年齢は生年月日から計算しました。</p>
          {p.datasets.filter((d,i,all)=>all.findIndex(other=>other.players.find(x=>x.playerId===p.playerId)?.contentSha256===d.players.find(x=>x.playerId===p.playerId)?.contentSha256)===i).map(d=><HistoricalCredits key={d.rows[0]!.season} data={d} playerId={p.playerId} />)}
          {profile?.profile.credits?.filter(c => c.fields.includes("birthDate")).map((c, i) => <p key={i}><a href={c.url} target="_blank" rel="noreferrer">{c.name}</a> · <a href={c.licenseUrl}>利用条件</a></p>)}
        </details>
        {collected && <CollectedRecordWatch rows={p.rows} />}
      </>,
    };
  });
  return <section className="historical-cohort" aria-label="同年齢の年度成績比較">
    <details className="historical-comparison-filters" open={query.ids.length<2}>
      <summary>比較条件 · 年末{query.age}歳 · {query.role==="batting"?"打撃":"投球"}{collected?" · 収録分合計":""}</summary>
      <div className="explorer-filter-grid"><label>比較する範囲<select value={query.mode} onChange={e=>update("ageMode",e.target.value)}><option value="season">その年齢のシーズン</option><option value="collected">その年齢のシーズンまでの収録分</option></select></label><form onSubmit={e => { e.preventDefault(); update("age", String(new FormData(e.currentTarget).get("age"))); }}><label>年末時点の年齢<input key={params.get("age") ?? "26"} name="age" type="number" min="0" max="99" step="1" required defaultValue={params.get("age") ?? "26"} /></label><button>年齢を適用</button></form><label>成績<select value={query.role} onChange={e => update("role", e.target.value)}><option value="batting">打撃（投手打撃を含む）</option><option value="pitching">投球</option></select></label></div>
    </details>
    <p role="status">比較 {query.ids.length}/4人</p>
    {!bounded?<DataState kind="unsupported" title="対象年度・通信量が比較の上限を超えています" detail="最大36年度・8MBまで。選手または年齢を変更してください。" />:collected&&!authorized?<><p>最大{seasons.length}年度・約{Math.ceil(bytes/1024)}KBの年度データを読み込みます。初回表示では取得しません。</p><button disabled={!seasons.length} onClick={()=>setConfirmedKey(key)}>収録分の合計を読み込む</button></>:query.ids.length > 0 && !ready && <LoadingSkeleton />}
    <NpbHistoricalComparison contenders={contenders} role={query.role} group={collected?`年末${query.age}歳までの収録分`:`同年齢 · 年末${query.age}歳`}
      resultsLabel="同年齢の比較結果" options={options} metric={metric} setMetric={key=>update("sort1",key)}
      add={query.ids.length<4?()=>{if(picker.current)picker.current.open=true;searchInput.current?.focus();}:undefined}
      remove={id=>update("recentPlayers",query.ids.filter(playerId=>playerId!==id).join(","))} removeLabel="を年齢比較から外す"
      collected={collected} note="年齢は各年度の12月31日時点。対象年度・母数・当時のリーグ環境も合わせて確認してください。" />
    <SaveViewButton league="NPB" kind="history" params={params} />
    {ready && result.failed.length > 0 && <button onClick={() => {setAttempt(n => n + 1);if(collected)setConfirmedKey(JSON.stringify([query.ids,query.age,query.role,query.mode,attempt+1]));}}>取得できなかった年度を再試行</button>}
    {query.ids.length < 4 && <details ref={picker} className="compare-search" open={query.ids.length < 2}><summary>比較する選手を追加（最大4人）</summary><label>選手名で探す<input ref={searchInput} type="search" value={search} onChange={e => setSearch(e.target.value.slice(0, 100))} /></label><p className="inline-note">プロフィールまたは過去成績のIdentityで生年月日を確認できる収録選手が対象です。検索結果は最大30人で、正式な現役・新人資格とは無関係です。</p><div className="row-list">{candidates.slice(0, 30).map(p => <button className="player-row" key={p.playerId} onClick={() => { update("recentPlayers", [...query.ids, p.playerId].join(",")); setSearch(""); }}><strong>{p.name}</strong><span>比較に追加</span></button>)}</div>{!candidates.length && <p>条件に合う収録選手はいません。</p>}</details>}
    <p className="inline-note">過去の公式戦の収録分です。年齢到達日までの通算や完全なキャリアではありません。</p>
    <p><Link to={school}>同学年の選手を同じ年度で比較 →</Link></p>
    <p><Link to={`/NPB/history?season=${latest}`}>同じ年度の成績を探す →</Link></p>
  </section>;
}
