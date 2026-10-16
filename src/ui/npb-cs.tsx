import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { readNpbCs } from "../application/npb-cs-reader";
import type { NpbCsDataset } from "../domain/npb-cs-observations";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";
import { npbCompetitionLabels } from "../domain/npb-competition";
import { comparisonValue } from "../domain/product-comparison";
import { DataState, LoadingSkeleton, MetricLabel, PageHeading } from "./components";
import { PublishedPlayerFallback } from "./npb-published-player";
import { normalizePlayerSearch } from "../domain/npb-player-directory";

const names: Record<string, string> = { lions: "西武", fighters: "日本ハム", hawks: "ソフトバンク", giants: "巨人", baystars: "DeNA", tigers: "阪神" };
const name = (id: string) => names[id.split(":").at(-1)!] ?? "球団未確認";
function useCs(enabled = true) {
  const [data, setData] = useState<NpbCsDataset | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => { if(!enabled)return;let active = true; void readNpbCs().then(d => { if (active) { setData(d); setFailed(false); } }).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, [attempt, enabled]);
  return { data, failed, retry: () => { setFailed(false); setAttempt(a => a + 1); } };
}
function CsCredits({ data, pageIds }: { data: NpbCsDataset; pageIds?: number[] }) {
  return <aside aria-label="CS成績の出典">{data.sources.filter(s => !pageIds || pageIds.includes(s.pageId)).map(s => <p className="inline-note" key={s.pageId}><a href={`https://ja.wikipedia.org/w/index.php?curid=${s.pageId}&oldid=${s.revision}`} target="_blank" rel="noreferrer">Wikipedia「{s.title}」の執筆者</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · 試合表から抽出・正規化</p>)}</aside>;
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
    <details><summary>集計に含まれる収録試合</summary><ul>{games.map(g => <li key={g.id}>{g.date} · {name(g.awayTeamId)} {g.awayScore}–{g.homeScore} {name(g.homeTeamId)}</li>)}</ul></details>
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
    <p className="data-notice">一部試合・一部選手の収録です。速報・公式ランキング・シリーズ全体の完全収録ではありません。未開催・終了未確認のテンプレートは掲載しません。</p>
    {!valid ? <DataState kind="unsupported" title="指定した年度・大会条件は未対応です" /> : failed ? <><DataState kind="source-unavailable" title="CSの収録データを取得できません" /><button onClick={retry}>再試行</button></> : !data ? <LoadingSkeleton /> : <>
      <p className="inline-note">原本取得 {data.observedAt.slice(0, 16).replace("T", " ")} UTC · {data.games.length}試合のスコア、{data.players.length}選手の該当表を収録。RegularのFacts・Coverage・HOT／ランキングとは別です。</p>
      <label>ステージ<select value={stage} onChange={e => change("stage", e.target.value)}><option value="all">収録ステージすべて</option><option value="npb_cs_first">CS ファースト</option><option value="npb_cs_final">CS ファイナル</option></select></label>
      <h2>収録試合</h2><div className="row-list">{data.games.filter(g => stage === "all" || g.stage === stage).map(g => <article className="explorer-result" key={g.id}><p className="inline-note">{g.date} · {npbCompetitionLabels[g.stage]} · 終了</p><h3>{name(g.awayTeamId)} <strong>{g.awayScore}–{g.homeScore}</strong> {name(g.homeTeamId)}</h3></article>)}</div>
      <h2>成績が収録されている選手</h2><div className="explorer-filter-grid"><label>成績<select value={role} onChange={e => change("role", e.target.value)}><option value="batting">打撃</option><option value="pitching">投球</option></select></label><label>選手名<input type="search" value={query} onChange={e => change("q", e.target.value)} /></label></div>
      {!matching.length && <DataState kind="no-data" title="条件に一致する収録選手はいません" />}
      <div className="row-list">{visible.map(r => { const a = r.aggregate; return <Link className="player-row" key={`${a.playerId}:${a.scope.stage}:${a.teamId}`} to={`/NPB/players/${a.playerId}/seasons?season=2026&competition=postseason&stage=${a.scope.stage}&role=${role}`}><strong>{data.players.find(p => p.playerId === a.playerId)!.name}</strong><span>{name(a.teamId)} · {npbCompetitionLabels[a.scope.stage as "npb_cs_first" | "npb_cs_final"]} · 該当表 {r.gameIds.length}試合 →</span></Link>; })}</div>
      <nav aria-label="CS収録選手のページ"><button disabled={page <= 1} onClick={() => change("page", String(page - 1))}>前へ</button><span>{page}ページ</span><button disabled={page * 30 >= matching.length} onClick={() => change("page", String(page + 1))}>次へ</button></nav>
      <CsCredits data={data} />
    </>}
  </div>;
}
