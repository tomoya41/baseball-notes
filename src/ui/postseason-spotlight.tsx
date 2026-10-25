import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {readNpbCs} from '../application/npb-cs-reader';
import {readNpbExplorerSeason} from '../application/explorer-readers';
import type {NpbSeasonPayload} from '../application/npb-season-payload';
import type {NpbCsDataset} from '../domain/npb-cs-observations';
import {npbCompetitionLabels} from '../domain/npb-competition';
import {comparisonValue} from '../domain/product-comparison';
import {postseasonSubjects,spotlightEvidence,spotlightRegular,spotlightStory,spotlightStatsUrl,spotlightRegularUrl,type SpotlightKind,type SpotlightScope} from '../presentation/postseason-spotlight';
import {LicensedPlayerPhoto} from './licensed-player-photo';
import {ClubIdentity} from './club-identity';
import {MetricLabel} from './components';
import {npbTeamShortName as name} from './npb-team-names';
const labels:Record<string,string>={G:'試合',PA:'打席',AB:'打数',H:'安打',HR:'本塁打',RBI:'打点',AVG:'打率',outsRecorded:'投球回',SO:'奪三振',ER:'自責点',ERA:'防御率'};
function Numbers({metrics,keys}:{metrics:Record<string,number|null>;keys:string[]}){return <dl className="spotlight-numbers">{keys.map(k=><div key={k}><dt><MetricLabel metric={k} label={k==="G"&&"outsRecorded" in metrics?"登板":labels[k]??k}/></dt><dd>{comparisonValue(k,metrics[k]??null)}</dd></div>)}</dl>;}
export function PostseasonSpotlight({scope,allowOutlook=false,data}:{scope:SpotlightScope;allowOutlook?:boolean;data?:NpbCsDataset}){
 const [cs,setCs]=useState<NpbCsDataset|null>(data??null),[failed,setFailed]=useState(false),[kind,setKind]=useState<SpotlightKind>('observed');
 const [season,setSeason]=useState<NpbSeasonPayload|null>(null),[requested,setRequested]=useState(false),[seasonFailed,setSeasonFailed]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{if(data)return;let active=true;void readNpbCs().then(d=>{if(active)setCs(d);}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[data]);
 useEffect(()=>{if(!requested)return;let active=true;void readNpbExplorerSeason(2026).then(d=>{if(active)setSeason(d);}).catch(()=>{if(active)setSeasonFailed(true);});return()=>{active=false;};},[requested,retry]);
 const load=()=>{if(seasonFailed){setSeasonFailed(false);setRetry(n=>n+1);}setRequested(true);};
 const visibleKind=allowOutlook?kind:'observed',dataset=data??cs;
 const subjects=dataset?postseasonSubjects.filter(s=>s.kind===visibleKind).flatMap(s=>{const evidence=spotlightEvidence(dataset,s,scope),regular=season?spotlightRegular(season,s):null;return evidence&&(s.kind==='observed'||regular)?[{s,evidence,regular}]:[];}):[];
 return <section className="postseason-spotlight" aria-label="CS・日本シリーズの注目選手"><header className="spotlight-heading"><div><p>短期決戦の注目選手</p><h2>CS・日本シリーズの注目選手</h2></div></header>
 <div className="spotlight-switch" role="group" aria-label="注目選手の読み方"><button aria-pressed={visibleKind==='observed'} onClick={()=>setKind('observed')}>CSで活躍</button>{allowOutlook&&<button aria-pressed={visibleKind==='outlook'} onClick={()=>{setKind('outlook');load();}}>次戦への注目</button>}</div>
 <p className="spotlight-context">{visibleKind==='observed'?'CSの収録分から紹介 · 一部試合・一部選手':'公式戦の実績から独自選考 · 出場未確認'}</p>
 {failed&&!dataset?<p role="status">CSの収録成績を読み込めません。</p>:!dataset?<p role="status">CS成績を読み込み中</p>:<div className="spotlight-cards">{subjects.map(({s,evidence:e,regular:r})=>{const story=spotlightStory(s,e,r);if(!story)return null;return <article className="spotlight-card" key={s.playerId} data-player={s.playerId}><header><div><ClubIdentity teamId={s.teamId}>{name(s.teamId)}</ClubIdentity><Link className="spotlight-player" to={`/NPB/players/${s.playerId}`}>{e.player.name} ›</Link><p>{s.role==='batting'?'打撃':'投手'} · {s.kind==='observed'?'収録CSの実績':'独自の注目'}</p></div><LicensedPlayerPhoto playerId={s.playerId} season={2026}/></header>
 <h3>{story.title}</h3><p className="spotlight-sample">{s.kind==='observed'?`${npbCompetitionLabels[s.stage]} · 収録${e.games.length}${s.role==='batting'?'試合':'登板'}のみ`:`公式戦 · 収録${r!.metrics.G}${s.role==='batting'?'試合':'登板'}・${r!.coverage==='complete'?'公開時点の収録完了':'一部未収集'}`}</p>
 <Numbers metrics={s.kind==='observed'?e.metrics:r!.metrics} keys={s.kind==='observed'?(s.role==='batting'?['AB','H','RBI']:['outsRecorded','SO','ER']):(s.role==='batting'?['PA','HR','RBI']:['G','outsRecorded','SO'])}/>
 <p className="spotlight-reading">{story.text}</p><p className="spotlight-caution">{story.caution}</p>
 <details onToggle={ev=>{if(ev.currentTarget.open)load();}}><summary>CSと公式戦を見比べる</summary><h4>{npbCompetitionLabels[s.stage]} · 該当表のみ</h4><Numbers metrics={e.metrics} keys={s.role==='batting'?['G','AB','H','HR','RBI','AVG']:['G','outsRecorded','SO','ER','ERA']}/><p className="spotlight-sample">{e.games[0]?.date}〜{e.games.at(-1)?.date} · 欠損は「—」</p>
 <h4>公式戦 · 保存済み</h4>{r?<><Numbers metrics={r.metrics} keys={s.role==='batting'?['G','PA','H','HR','AVG','OPS']:['G','outsRecorded','SO','ER','ERA']}/><p className="spotlight-sample">{r.period.from}〜{r.period.to} · 公開基準日 {r.effectiveDate} · {r.coverage==='complete'?'公開時点の収録完了':'一部未収集'}・更新未確認</p></>:<p role="status">{seasonFailed?'公式戦を読み込めません。':season?'比較できる公式戦成績は未収録です。':'公式戦を読み込み中'}</p>}{seasonFailed&&<button onClick={load}>再試行</button>}
 <nav aria-label={`${e.player.name}の成績へ`}><Link to={spotlightStatsUrl(s)}>CS成績・分析 →</Link><Link to={spotlightRegularUrl(s)}>公式戦成績 →</Link></nav><ul>{e.games.map(g=><li key={g.id}><Link to={`/NPB/games/${encodeURIComponent(g.id)}?season=2026&competition=postseason&stage=${g.stage}`}>{g.date.slice(5).replace('-','/')} {name(g.awayTeamId)} {g.awayScore}–{g.homeScore} {name(g.homeTeamId)} · 試合詳細</Link></li>)}</ul></details>
 <Link className="spotlight-destination" to={s.kind==='observed'?spotlightStatsUrl(s):spotlightRegularUrl(s)}>{s.kind==='observed'?'CSの成績・試合へ':'公式戦の成績へ'} →</Link></article>;})}
 {!subjects.length&&<p role="status">{visibleKind==='outlook'&&!season&&!seasonFailed?'保存済み公式戦を読み込み中':'選考の根拠を確認できる成績は未収録です。'}{seasonFailed&&<button onClick={load}>公式戦を再試行</button>}</p>}</div>}
 <details className="spotlight-sources"><summary>選考・対象期間・出典</summary><p>Baseball Notesの独自選考。打数と打点、投球回と失点、公式戦の長打や奪三振を読み比べます。写真の有無は選考に使いません。公式ランキングやHOTではありません。</p><p>日本シリーズの個人成績は未収録です。対投手・得点圏・登板予定・現在の調子は判定しません。CSと公式戦は合算しません。</p>{dataset&&<><p>CS原本取得 {dataset.observedAt}。成績の抜粋・表記整理・独自解説を追加。派生統計：CC BY-SA 4.0。</p>{dataset.sources.map(s=><p key={s.pageId}><a href={`https://ja.wikipedia.org/w/index.php?curid=${s.pageId}&oldid=${s.revision}`}>Wikipedia「{s.title}」の執筆者・版</a> · <a href={`https://ja.wikipedia.org/w/index.php?curid=${s.pageId}&action=history`}>履歴</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></p>)}</>}{season&&<p>公式戦：既存の保存済みnf3成績。{season.period.from}〜{season.period.to}、公開基準日 {season.effectiveDate}、生成 {season.generatedAt}。収録状況は{season.coverage.status==='complete'?'公開時点の収録完了':'一部未収集'}・更新未確認。</p>}</details></section>;
}
