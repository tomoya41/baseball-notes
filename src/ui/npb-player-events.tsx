import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Favorite } from "../domain/models";
import { playerEventKinds, playerEventLabels, type NpbPlayerEvents, type PlayerEvent } from "../domain/npb-player-events";
import { readNpbPlayerEvents } from "../application/npb-player-events-reader";
import { npbEventQuery } from "../domain/npb-event-query";
import { normalizePlayerSearch } from "../domain/npb-player-directory";
import { DataState, LoadingSkeleton, PageHeading } from "./components";

const names: Record<string, string> = { giants: "巨人", tigers: "阪神", dragons: "中日", carp: "広島", swallows: "ヤクルト", baystars: "DeNA", hawks: "ソフトバンク", fighters: "日本ハム", lions: "西武", marines: "ロッテ", eagles: "楽天", buffaloes: "オリックス" };
const clubName = (id: string) => names[id.split(":").at(-1)!] ?? "球団未確認";
function EventEvidence({ event: e, dataset }: { event: PlayerEvent; dataset: NpbPlayerEvents }) {
  const p = dataset.players.find(p => p.playerId === e.playerId)!;
  return <details><summary>記載内容・出典</summary><p>{e.excerpt}</p><p className="inline-note">原記事からの変更：該当文の抜粋・分類とリンク・脚注の省略。実施日・契約期間・現在の状態を示すものではありません。</p>
    <a href={`https://ja.wikipedia.org/w/index.php?curid=${dataset.source.pageId}&oldid=${e.sourceRevision}`} target="_blank" rel="noreferrer">元記事のこの版・執筆者</a><span> · </span><a href={`https://ja.wikipedia.org/w/index.php?title=${encodeURIComponent(p.article)}&oldid=${p.identityRevision}`} target="_blank" rel="noreferrer">選手ID照合の記事</a>
    <p className="inline-note"><a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · 記載文・分類データにも同じ条件が適用されます。</p></details>;
}

/** Loaded only when the player-context disclosure is opened. No profile/roster mutation. */
export function NpbPlayerEventHistoryBody({ playerId }: { playerId: string }) {
  const [dataset, setDataset] = useState<NpbPlayerEvents | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; void readNpbPlayerEvents().then(d => { if (active) { setDataset(d); setFailed(false); } }).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, [attempt]);
  if (failed) return <><DataState kind="source-unavailable" title="選手の動きを読み込めません" /><button onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>選手の動きを再試行</button></>;
  if (!dataset) return <LoadingSkeleton />;
  const records = dataset.events.filter(e => e.playerId === playerId).slice().sort((a, b) => b.recordedDate.localeCompare(a.recordedDate) || a.id.localeCompare(b.id));
  return <><p className="inline-note">2026年のWikipedia記事の一部です。日付は記事記載で、公式発表の直接確認・現在の所属や登録の認定ではありません。</p>
    {!records.length ? <p>この選手の出来事は未収録です。契約・移籍・引退がなかったという意味ではありません。</p> : <><p>{records.length}件 · 新しい記載から表示</p><ol className="lifecycle-timeline">{records.slice(0, 5).map(e => <li key={e.id}><h3>{e.recordedDate} · {playerEventLabels[e.kind]}</h3><p>{e.kind === "trade" ? `${clubName(e.fromTeamId!)} → ${clubName(e.toTeamId!)}` : e.relatedTeamIds.map(clubName).join("・")}</p><EventEvidence event={e} dataset={dataset} /></li>)}</ol></>}
    <p className="inline-note">戦力外通告・自由契約・引退発表は別の出来事です。一つから別の状態を推定しません。</p><Link to={`/NPB/moves?player=${playerId}`}>この選手の動きを一覧で見る →</Link></>;
}

export function NpbPlayerEventsScreen({ favorites = [] }: { favorites?: Favorite[] }) {
  const [params, setParams] = useSearchParams(), [dataset, setDataset] = useState<NpbPlayerEvents | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const { valid, kind, team, player, query, follow, requestedPage } = npbEventQuery(params);
  useEffect(() => { if (!valid) return; let active = true; void readNpbPlayerEvents().then(d => { if (active) { setDataset(d); setFailed(false); } }).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, [attempt, valid]);
  const change = (key: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); if (key !== "page") next.delete("page"); return next; });
  const matching = dataset?.events.filter(e => (!kind || e.kind === kind) && (!team || e.relatedTeamIds.includes(team)) && (!player || e.playerId === player) && (!query || normalizePlayerSearch(dataset.players.find(p => p.playerId === e.playerId)!.name).includes(normalizePlayerSearch(query))) && (!follow || favorites.some(f => f.league === "NPB" && (f.kind === "player" ? f.entityId === e.playerId : e.relatedTeamIds.includes(f.entityId))))) ?? [];
  const page = Math.min(Number(requestedPage), Math.max(1, Math.ceil(matching.length / 15))), visible = matching.slice((page - 1) * 15, page * 15);
  return <div className="screen"><PageHeading eyebrow="NPB · 2026年の記事記載" title="選手の動き" detail="契約・移籍・戦力外・自由契約・引退発表を出典から。" />
    <p className="data-notice">Wikipedia記事の一部収録です。公式発表の直接確認・現在の所属や登録の認定ではありません。</p>
    {!valid ? <DataState kind="unsupported" title="年度・選手・球団・絞り込み条件を確認してください" /> : failed ? <><DataState kind="source-unavailable" title="選手の動きを読み込めません" /><button type="button" onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>再試行</button></> : !dataset ? <LoadingSkeleton /> : <>
      <p className="inline-note">{dataset.events.length}件・{dataset.players.length}選手 · 原記事取得 {new Date(dataset.observedAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>
      <label className="search-field">選手名から探す<input type="search" value={query} maxLength={100} onChange={e => change("q", e.target.value)} /></label>
      <details className="explorer-filters"><summary>絞り込み{kind ? ` · ${playerEventLabels[kind as typeof playerEventKinds[number]]}` : ""}{team ? ` · ${clubName(team)}` : ""}{follow ? " · フォロー" : ""}{matching.length !== dataset.events.length ? ` · ${matching.length}件` : ""}</summary><div className="explorer-filter-grid">
        <label>話題<select value={kind ?? ""} onChange={e => change("kind", e.target.value)}><option value="">すべて</option>{playerEventKinds.map(k => <option key={k} value={k}>{playerEventLabels[k]}{!dataset.events.some(e => e.kind === k) ? "（未収録）" : ""}</option>)}</select></label>
        <label>記事に出てくる球団<select value={team ?? ""} onChange={e => change("team", e.target.value)}><option value="">すべて</option>{Object.entries(names).map(([id, label]) => <option key={id} value={`npb:team:${id}`}>{label}</option>)}</select></label>
        <label><input type="checkbox" checked={follow} onChange={e => change("follow", e.target.checked ? "1" : "")} />フォローに関連する情報</label>
        {player && <p>指定した選手の記事記載に絞っています。<button type="button" onClick={() => change("player", "")}>選手の指定を解除</button></p>}
      </div></details>
      {!matching.length ? <DataState kind="no-data" title={follow ? "フォローに関連する記事記載は未収録です" : "この条件の記事記載は未収録です"} detail="出来事がなかった、移籍していない、という意味ではありません。" /> : <><p role="status">{matching.length}件 · {page}ページ</p><div className="row-list">{visible.map(e => { const p = dataset.players.find(p => p.playerId === e.playerId)!; return <article className="explorer-result" key={e.id}>
        <p className="inline-note">{e.recordedDate} · 出来事の日付（記事記載）</p><h2><Link to={`/NPB/players/${e.playerId}`}>{p.name}</Link> · {playerEventLabels[e.kind]}</h2>
        <p>{e.kind === "trade" ? `${clubName(e.fromTeamId!)} → ${clubName(e.toTeamId!)}（金銭トレードの記載）` : `${e.relatedTeamIds.map(clubName).join("・")}に関する記事記載`}</p>
        <EventEvidence event={e} dataset={dataset} />
        <div className="hub-links"><Link to={`/NPB/players/${e.playerId}`}>選手ページ →</Link>{e.relatedTeamIds.map(t => <Link key={t} to={`/NPB/teams/${t}`}>{clubName(t)} →</Link>)}</div>
      </article>; })}</div><nav className="explorer-pagination" aria-label="選手の動きのページ"><button disabled={page <= 1} onClick={() => change("page", String(page - 1))}>前へ</button><span>{page} / {Math.ceil(matching.length / 15)}</span><button disabled={page * 15 >= matching.length} onClick={() => change("page", String(page + 1))}>次へ</button></nav></>}
      <details className="source-note"><summary>収録範囲・更新について</summary><p>原記事の版：{new Date(dataset.source.revisionAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}／取得：{new Date(dataset.observedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（日本時間）。日付は記事の年表に記載された出来事の日で、発表日・実施日を独立に確認したものではありません。</p><p>一部の選手・出来事のみ収録しています。戦力外通告・自由契約・引退はそれぞれ異なる出来事です。FA・ポスティング・今年のドラフト指名結果は未収録です。退団・登録・契約の全件一覧、速報、公式のIN／OUT一覧ではありません。</p></details>
    </>}
  </div>;
}
