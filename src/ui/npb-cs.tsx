import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { readNpbCs } from "../application/npb-cs-reader";
import type { NpbCsDataset } from "../domain/npb-cs-observations";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";
import { npbCompetitionLabels } from "../domain/npb-competition";
import { comparisonValue } from "../domain/product-comparison";
import { DataState, LoadingSkeleton, MetricLabel, PageHeading } from "./components";
import { PublishedPlayerFallback } from "./npb-published-player";
import { normalizePlayerSearch } from "../domain/npb-player-directory";
import { GameHeading } from "./signature";
import { ScoreHero } from "./design-system";
import { StatTable } from "./stat-table";
import { npbTeamShortName as name } from "./npb-team-names";

function useCs(enabled = true) {
  const [data, setData] = useState<NpbCsDataset | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => { if(!enabled)return;let active = true; void readNpbCs().then(d => { if (active) { setData(d); setFailed(false); } }).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, [attempt, enabled]);
  return { data, failed, retry: () => { setFailed(false); setAttempt(a => a + 1); } };
}
function CsCredits({ data, pageIds }: { data: NpbCsDataset; pageIds?: number[] }) {
  return <aside aria-label="CS成績の出典">{data.sources.filter(s => !pageIds || pageIds.includes(s.pageId)).map(s => <p className="inline-note" key={s.pageId}><a href={`https://ja.wikipedia.org/w/index.php?curid=${s.pageId}&oldid=${s.revision}`} target="_blank" rel="noreferrer">Wikipedia「{s.title}」の執筆者</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · 原記事からの変更：試合表の抜粋・表記整理</p>)}</aside>;
}
export function NpbCsPlayerStats({ playerId, stage, role, repository }: { playerId: string; stage: string; role: "batting" | "pitching"; repository: { findLatestNpb(): Promise<NpbPlayerDirectory> } }) {
  const { data, failed, retry } = useCs(), [compare, setCompare] = useState(false);
  if (failed) return <><DataState kind="source-unavailable" title="CSの保存済み成績を取得できません" /><button onClick={retry}>再試行</button></>;
  if (!data) return <LoadingSkeleton />;
  const rows = data.rows.filter(r => r.aggregate.playerId === playerId && r.aggregate.scope.stage === stage && r.aggregate.role === role);
  const ids = [...new Set(rows.flatMap(r => r.gameIds))], games = data.games.filter(g => ids.includes(g.id));
  const keys = role === "batting" ? ["G", "AB", "H", "HR", "RBI", "AVG"] : ["G", "outsRecorded", "SO", "ERA", "H", "ER"];
  return <section><h2>2026年 · {npbCompetitionLabels[stage as keyof typeof npbCompetitionLabels]}</h2>
    <p className="data-notice">収録した{games.length}試合の該当表のみ。CS全試合・選手の大会通算成績ではありません。略称のみでIDを確認できない行や未収録の記録は含みません。</p>
    {!rows.length ? <DataState kind="no-data" title="この役割のCS成績は未収録です" /> : rows.map(r => <div key={r.aggregate.teamId}><h3>{name(r.aggregate.teamId)} · {role === "batting" ? "打撃" : "投球"}</h3><dl className="explorer-values">{keys.map(k => <div key={k}><dt><MetricLabel metric={k} label={k === "outsRecorded" ? "投球回" : k} /></dt><dd>{comparisonValue(k, r.aggregate.metrics[k] ?? null)}</dd></div>)}</dl><details><summary>詳細成績・欠損について</summary><p>空欄はnullのままです。四死球を四球と死球へ分けず、PA・OBP・OPS・WHIPを推定しません。</p><dl className="explorer-values">{Object.entries(r.aggregate.metrics).map(([k, v]) => <div key={k}><dt><MetricLabel metric={k} label={k === "outsRecorded" ? "投球回" : k} /></dt><dd>{comparisonValue(k, v)}</dd></div>)}</dl></details></div>)}
    <details><summary>集計に含まれる収録試合</summary><ul>{games.map(g => <li key={g.id}><Link to={`/NPB/games/${encodeURIComponent(g.id)}?competition=postseason&stage=${g.stage}`}>{g.date} · {name(g.awayTeamId)} {g.awayScore}–{g.homeScore} {name(g.homeTeamId)} · 試合詳細</Link></li>)}</ul></details>
    <CsCredits data={data} pageIds={[...new Set(games.map(g => g.sourcePageId))]} />
    <Link to="/NPB/cs?season=2026">CSの収録試合・選手を見る →</Link>
    <details onToggle={e => setCompare(e.currentTarget.open)}><summary>2026年の保存済み公式戦と見比べる</summary><p>対象試合数・収録範囲が異なります。公式戦とCSは合算しません。</p>{compare && <PublishedPlayerFallback key={`${playerId}:${role}`} playerId={playerId} period="season" repository={repository} pitcherBatting={role === "pitching"} role={role} reason="saved" />}</details>
  </section>;
}
export function NpbCsScreen() {
  const [params, setParams] = useSearchParams();
  const stage = params.get("stage") ?? "all", query = params.get("q") ?? "", role = params.get("role") ?? "batting";
  const valid = (!params.has("season") || params.get("season") === "2026") && ["all", "npb_cs_first", "npb_cs_final"].includes(stage) && ["batting", "pitching"].includes(role);
  const { data, failed, retry } = useCs(valid);
  const change = (key: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set(key, value); if(key!=="page")next.delete("page"); return next; });
  const matching = data?.rows.filter(r => (stage === "all" || r.aggregate.scope.stage === stage) && r.aggregate.role === role && normalizePlayerSearch(data.players.find(p => p.playerId === r.aggregate.playerId)?.name??"").includes(normalizePlayerSearch(query))) ?? [];
  const page = Math.max(1, Math.min(Math.ceil(matching.length / 30) || 1, Number(params.get("page")) || 1)), visible = matching.slice((page - 1) * 30, page * 30);
  return <div className="screen"><PageHeading eyebrow="NPB · 保存済みの大会記録" title="2026 クライマックスシリーズ" />
    <Link className="section-action" to="/NPB/postseason?season=2026">シリーズ勝敗・勝ち上がりを見る →</Link>
    <p className="data-notice">一部試合・一部選手の収録です。速報・公式ランキング・シリーズ全体の完全収録ではありません。未開催・終了未確認のテンプレートは掲載しません。</p>
    {!valid ? <DataState kind="unsupported" title="指定した年度・大会条件は未対応です" /> : failed ? <><DataState kind="source-unavailable" title="CSの収録データを取得できません" /><button onClick={retry}>再試行</button></> : !data ? <LoadingSkeleton /> : <>
      <p className="inline-note">原本取得 {data.observedAt.slice(0, 16).replace("T", " ")} UTC · {data.games.length}試合のスコア、{data.players.length}選手の該当表を収録。公式戦とは別集計です。</p>
      <label>ステージ<select value={stage} onChange={e => change("stage", e.target.value)}><option value="all">収録ステージすべて</option><option value="npb_cs_first">CS ファースト</option><option value="npb_cs_final">CS ファイナル</option></select></label>
      <h2>収録試合</h2><div className="row-list">{data.games.filter(g => stage === "all" || g.stage === stage).map(g => <article className="explorer-result" key={g.id}><p className="inline-note">{g.date} · {npbCompetitionLabels[g.stage]} · 終了</p><h3><Link to={`/NPB/games/${encodeURIComponent(g.id)}?competition=postseason&stage=${g.stage}`}>{name(g.awayTeamId)} <strong>{g.awayScore}–{g.homeScore}</strong> {name(g.homeTeamId)}</Link></h3><Link to={`/NPB/games/${encodeURIComponent(g.id)}?competition=postseason&stage=${g.stage}`}>試合詳細・選手成績 →</Link></article>)}</div>
      <h2>成績が収録されている選手</h2><div className="explorer-filter-grid"><label>成績<select value={role} onChange={e => change("role", e.target.value)}><option value="batting">打撃</option><option value="pitching">投球</option></select></label><label>選手名<input type="search" value={query} onChange={e => change("q", e.target.value)} /></label></div>
      {!matching.length && <DataState kind="no-data" title="条件に一致する収録選手はいません" />}
      <div className="row-list">{visible.map(r => { const a = r.aggregate; return <Link className="player-row" key={`${a.playerId}:${a.scope.stage}:${a.teamId}`} to={`/NPB/players/${a.playerId}/seasons?season=2026&competition=postseason&stage=${a.scope.stage}&role=${role}`}><strong>{data.players.find(p => p.playerId === a.playerId)!.name}</strong><span>{name(a.teamId)} · {npbCompetitionLabels[a.scope.stage as "npb_cs_first" | "npb_cs_final"]} · 該当表 {r.gameIds.length}試合 →</span></Link>; })}</div>
      <nav aria-label="CS収録選手のページ"><button disabled={page <= 1} onClick={() => change("page", String(page - 1))}>前へ</button><span>{page}ページ</span><button disabled={page * 30 >= matching.length} onClick={() => change("page", String(page + 1))}>次へ</button></nav>
      <CsCredits data={data} />
    </>}
  </div>;
}

/** Actual per-game observations only. Never spread a Series aggregate into individual games. */
export function NpbCsGameDetail(){
  const {gameId}=useParams(),[params]=useSearchParams();
  const valid=!!gameId&&/^npb:game:[a-f0-9]{20}$/.test(gameId)&&(!params.has("competition")||params.get("competition")==="postseason")&&(!params.has("season")||params.get("season")==="2026")&&(!params.has("stage")||["npb_cs_first","npb_cs_final"].includes(params.get("stage")!));
  const {data,failed,retry}=useCs(valid);
  if(!valid)return <DataState kind="unsupported" title="試合の年度・大会条件を確認してください" />;
  if(failed)return <><DataState kind="source-unavailable" title="試合詳細を取得できません" /><button onClick={retry}>再試行</button></>;
  if(!data)return <LoadingSkeleton />;
  const game=data.games.find(g=>g.id===gameId);
  if(!game)return <DataState kind="no-data" title="このポストシーズンの試合は未収録です" action="収録試合へ" to="/NPB/cs" />;
  if(params.has("stage")&&params.get("stage")!==game.stage)return <DataState kind="unsupported" title="指定したステージと試合が一致しません" />;
  const observations=data.observations?.filter(o=>o.gameId===game.id)??[];
  return <div className="screen game-detail"><GameHeading title={`${game.date} ${name(game.awayTeamId)}対${name(game.homeTeamId)}`} date={game.date} context={`NPB · ポストシーズン · ${npbCompetitionLabels[game.stage]}`} backTo={`/NPB/cs?season=2026&stage=${game.stage}`} />
    <ScoreHero away={name(game.awayTeamId)} home={name(game.homeTeamId)} awayScore={game.awayScore} homeScore={game.homeScore} status="試合終了" />
    <p role="status" className="game-detail__note">この試合の選手成績は一部収録です。未収録の選手・項目は出場なし・0成績とは扱いません。公式戦とは別集計です。</p>
    {([game.awayTeamId,game.homeTeamId]).map((teamId,index)=><details className="game-detail__team" key={teamId} open><summary>{index===0?"ビジター":"ホーム"} · {name(teamId)}<span>ボックススコア</span></summary><p className="game-detail__totals">{index===0?game.awayScore:game.homeScore}得点 · 安打 {index===0?game.awayHits??"—":game.homeHits??"—"}</p>
      {(["batting","pitching"] as const).map(role=>{const rows=observations.filter(o=>o.aggregate.teamId===teamId&&o.aggregate.role===role),keys=role==="batting"?["AB","H","HR","RBI"]:["outsRecorded","SO","R","ER"];
        return <section key={role}><h3>{role==="batting"?"打撃":"投球"} · この試合の収録分</h3>{!rows.length?<p>この球団・役割の試合別成績は未収録です。</p>:<><div className="mlb-stat-scroll box-primary" tabIndex={0} role="region" aria-label={`${name(teamId)}の${role==="batting"?"打撃":"投球"}成績`}><StatTable><thead><tr><th>選手</th>{keys.map(k=><th key={k}><MetricLabel metric={k} label={k==="outsRecorded"?"投球回":k} /></th>)}</tr></thead><tbody>{rows.map(({aggregate:a})=><tr key={a.playerId}><th scope="row"><Link to={`/NPB/players/${a.playerId}/seasons?season=2026&competition=postseason&stage=${game.stage}&role=${role}`}>{data.players.find(p=>p.playerId===a.playerId)!.name}</Link></th>{keys.map(k=><td key={k}>{comparisonValue(k,a.metrics[k]??null)}</td>)}</tr>)}</tbody></StatTable></div><details><summary>詳しい{role==="batting"?"打撃":"投球"}成績・出典</summary>{rows.map(({aggregate:a})=><section key={a.playerId}><h4>{data.players.find(p=>p.playerId===a.playerId)!.name}</h4><dl className="explorer-values">{Object.entries(a.metrics).filter(([k])=>k!=="G").map(([k,v])=><div key={k}><dt><MetricLabel metric={k} label={k==="outsRecorded"?"投球回":k} /></dt><dd>{comparisonValue(k,v)}</dd></div>)}</dl></section>)}</details></>}</section>;
      })}<p className="game-detail__minor">表示順から打順・登板順・交代経過は判断できません。</p></details>)}
    {!observations.length&&<p>この試合の選手成績は未収録です。</p>}
    <details><summary>収録範囲・更新・出典</summary><p>原本取得 {data.observedAt}。空欄は未収録です。四死球から四球・死球を分離せず、PA・OBP・OPS・WHIPは推定していません。一球速報・完全なイニング経過・交代情報は未収録です。</p><CsCredits data={data} pageIds={[game.sourcePageId]} /></details>
    <Link to={`/NPB/cs?season=2026&stage=${game.stage}`}>同じステージの試合・選手へ →</Link>
  </div>;
}
