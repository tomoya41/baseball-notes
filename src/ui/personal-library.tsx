import { useContext, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { activityPath, savedViewPath, type LibraryPlayer } from "../application/personal-library";
import type { League } from "../domain/models";
import { services } from "../app/services";
import { readHistoricalProduct } from "../app/historical-products";
import { PageHeading, LoadingSkeleton, DataState } from "./components";
import { useHistoricalStatic } from "./use-mlb-historical";
import { ShareLink } from "./product-sharing";

import { LibraryContext } from "./personal-library-context";
import { WatchSummary } from "./watch-shell";
import { AppDialog } from "./app-dialog";
export function LibraryShortcuts({ league }: { league: League }) {
  return <nav className="library-shortcuts" aria-label="自分の保存・履歴"><Link to={`/${league}/library?tab=collections`}>コレクション</Link><Link to={`/${league}/library?tab=views`}>保存した条件</Link><Link to={`/${league}/library?tab=activity`}>最近見た履歴</Link></nav>;
}
export function SaveViewButton({ league, kind = "data", params, placeholder = "例：阪神・直近14日" }: { league: League; kind?: "data" | "history"; params: URLSearchParams; placeholder?: string }) {
  const ctx = useContext(LibraryContext), [name, setName] = useState(""), [open, setOpen] = useState(false), [saved, setSaved] = useState(false);
  if (!ctx) return null;
  return <div className="library-save"><button className="text-button" onClick={() => { setOpen(!open); setSaved(false); }} aria-expanded={open}>この条件を保存</button>{saved && <span role="status">保存しました。<Link to={`/${league}/library?tab=views`}>保存一覧 →</Link></span>}{open && <form onSubmit={e => { e.preventDefault(); if (name.trim()) void ctx.run(() => ctx.store.saveView(name, league, kind, params)).then(ok => { if (ok) { setOpen(false); setSaved(true); setName(""); } }); }}><label>条件の名前<input maxLength={60} value={name} onChange={e => setName(e.target.value)} required placeholder={placeholder} /></label><button type="submit">保存</button><Link to={`/${league}/library?tab=views`}>保存一覧</Link>{ctx.error && <p role="alert">{ctx.error}</p>}</form>}</div>;
}
export function CollectionButton({ league, playerId, name }: LibraryPlayer & { name: string }) {
  const ctx = useContext(LibraryContext), [open, setOpen] = useState(false), [newName, setNewName] = useState("");
  if (!ctx) return null;
  return <div className="collection-control"><button className="text-button" aria-label={`${name}をコレクションに整理`} aria-haspopup="dialog" onClick={() => setOpen(true)}>整理</button>{open && <AppDialog label={`${name}のコレクション`} onClose={() => setOpen(false)}><div className="library-picker-content"><strong>{name}</strong>{ctx.state?.collections.map(c => <label key={c.id}><input type="checkbox" checked={c.players.some(p => p.league === league && p.playerId === playerId)} onChange={e => { const checked = e.target.checked; void ctx.run(() => ctx.store.setPlayer(c.id, { league, playerId }, checked)); }} />{c.name}</label>)}<form onSubmit={e => { e.preventDefault(); if (newName.trim()) void ctx.run(() => ctx.store.createCollection(newName)).then(ok => { if (ok) setNewName(""); }); }}><label>新しいコレクション<input maxLength={60} value={newName} onChange={e => setNewName(e.target.value)} required /></label><button>作成</button></form>{ctx.error && <p role="alert">{ctx.error}</p>}<Link to={`/${league}/library?tab=collections`} onClick={() => setOpen(false)}>一覧を開く</Link></div></AppDialog>}</div>;
}
export function MyLibrary({ league, showWatch = true }: { league: League; showWatch?: boolean }) {
  const ctx = useContext(LibraryContext);
  return <section className="my-library"><h2>保存・整理</h2><nav className="personal-destinations" aria-label="保存・整理"><Link to={`/${league}/library?tab=collections`}><span><strong>コレクション</strong><small>選手をグループで追う</small></span><b>{ctx?.state?.collections.length ?? "—"}</b></Link><Link to={`/${league}/library?tab=views`}><span><strong>保存した条件</strong><small>探索を再開</small></span><b>{ctx?.state?.views.length ?? "—"}</b></Link><Link to={`/${league}/library?tab=activity`}><span><strong>最近見た履歴</strong><small>前に見た記録へ</small></span><b>{ctx?.state?.activity.length ?? "—"}</b></Link></nav>{showWatch && <WatchSummary league={league} />}<Link className="text-link" to={`/${league}/team-compare`}>お気に入り球団を比較 →</Link>{ctx?.error && <p role="alert">{ctx.error}</p>}</section>;
}

export function NpbAnalysisResume() {
  const { state } = useContext(LibraryContext) ?? {};
  if (!state) return null;
  const views = state.views.filter(view => view.league === "NPB").sort((a, b) => b.savedAt - a.savedAt).slice(0, 2);
  const recent = state.activity.find(item => item.league === "NPB" && item.kind === "players" && item.entityId);
  if (!views.length && !recent) return null;
  return <section className="my-content-section my-analysis-resume" aria-label="分析を再開">
    <div className="personal-section-heading"><h2>分析を再開</h2>{views.length > 0 && <Link to="/NPB/library?tab=views">保存一覧 →</Link>}</div>
    <ul className="row-list">{views.map(view => {
      const params = new URLSearchParams(view.conditions);
      const cohort = params.get("cohort"), clubYears = params.get("clubYears");
      const annualComparison = params.get("seasonCompare") === "1";
      const kind = annualComparison ? "年度別の成績比較" : cohort === "ageSeason" ? params.get("ageMode") === "collected" ? "同年齢までの収録分" : "同年齢比較" :
        cohort === "schoolYear" ? "同学年比較" : cohort === "birthYear" ? "同じ生年の比較" :
        cohort === "draftYear" ? "ドラフト同期比較" : clubYears ? "球団が異なる年度の比較" : view.kind === "history" ? "年度成績" : "データ探索";
      const year = annualComparison ? params.get("years")?.split(",").join("年・") : clubYears?.replace(",", "年 → ") ?? params.get("season");
      const age = params.get("age");
      return <li key={view.id}><Link className="player-row" to={savedViewPath(view)}>
        <span className="player-row__body"><small>{kind}{year && ` · ${year}年`}{cohort === "ageSeason" && age && ` · 年末${age}歳`}</small><strong>{view.name}</strong></span>
        <span aria-hidden="true">›</span>
      </Link></li>;
    })}
    {recent && <li><Link className="player-row" to={activityPath(recent)}><span className="player-row__body"><small>この端末の履歴</small><strong>最近見た選手</strong></span><span aria-hidden="true">›</span></Link></li>}</ul>
  </section>;
}
type Name = { name: string; team: string | null; postseasonOnly?: boolean };
export function PersonalLibraryScreen({ league }: { league: League }) {
  const ctx = useContext(LibraryContext), [params, setParams] = useSearchParams(), tab = ["activity", "views"].includes(params.get("tab") ?? "") ? params.get("tab")! : "collections";
  const [names, setNames] = useState<Map<string, Name>>(new Map()), [teamNames, setTeamNames] = useState<Map<string, string>>(new Map());
  const [metadataError, setMetadataError] = useState(false), [create, setCreate] = useState(""), [rename, setRename] = useState(""), [editing, setEditing] = useState("");
  const [selected, setSelected] = useState<LibraryPlayer[]>([]), [reset, setReset] = useState(false);
  const [compareSeason, setCompareSeason] = useState("2025"), [compareScope, setCompareScope] = useState("regular");
  const compareManifest = useHistoricalStatic<{ seasons: { season: number }[] }>(selected.length >= 2 && selected[0]?.league === "MLB" ? `${compareScope === "postseason" ? "postseason/" : ""}manifest.json` : null);
  const compareYears = compareManifest.value?.seasons.map(s => s.season) ?? [];
  useEffect(() => { let active = true;
    void Promise.allSettled([services.directory.findLatestNpb(), readHistoricalProduct<{ players: { id: string; name: string }[] }>("players/index.json"), readHistoricalProduct<{ players: { id: string; name: string }[] }>("postseason/players/index.json")]).then(results => {
      if (!active) return; const next = new Map<string, Name>(), teams = new Map<string, string>();
      if (results[0]!.status === "fulfilled") { const d = results[0]!.value; for (const t of d.teams) teams.set(t.id, t.name); for (const p of d.players) next.set(`NPB:${p.playerId}`, { name: p.displayName, team: d.teams.find(t => t.id === p.teamId)?.shortName ?? null }); }
      if (results[1]!.status === "fulfilled") for (const p of results[1]!.value.players) next.set(`MLB:${p.id}`, { name: p.name, team: null });
      if (results[2]!.status === "fulfilled") for (const p of results[2]!.value.players) if (!next.has(`MLB:${p.id}`)) next.set(`MLB:${p.id}`, { name: p.name, team: null, postseasonOnly: true });
      setNames(next); setTeamNames(teams); setMetadataError(results.some(r => r.status === "rejected"));
    }); return () => { active = false; };
  }, []);
  if (!ctx) return null;
  const label = (p: LibraryPlayer) => names.get(`${p.league}:${p.playerId}`)?.name ?? p.playerId;
  return <div className="screen personal-library"><PageHeading eyebrow={`${league} / My`} title="保存・履歴" /><Link className="back-link" to={`/${league}/my`}>← My</Link><nav className="segmented" aria-label="保存の種類">{[["collections", "コレクション"], ["views", "保存した条件"], ["activity", "最近見た履歴"]].map(([key, text]) => <button key={key} aria-pressed={tab === key} onClick={() => { setSelected([]); setParams({ tab: key! }); }}>{text}</button>)}</nav>
    {ctx.error && <p className="data-notice" role="alert">{ctx.error}</p>}{metadataError && <p className="inline-note">一部の表示名を取得できません。保存内容は保持しています。</p>}{!ctx.state && !ctx.error && <LoadingSkeleton />}
    {tab === "views" && <><p className="inline-note">保存した条件を開いて、利用できるデータで比較や検索を再開できます。</p>{!ctx.state?.views.length && <p>保存した条件はまだありません。</p>}<div className="row-list">{ctx.state?.views.map(v => { const path = savedViewPath(v), [route = path, search = ""] = path.split("?"); return <article key={v.id} className="library-row"><Link to={path}><strong>{v.name}</strong><small>{v.league} · {route === "/NPB/season-compare" ? "年度別の成績比較" : v.kind === "data" ? "データ探索" : "年度成績"}</small></Link><ShareLink path={route} search={search} /><button aria-label={`${v.name}の保存条件を削除`} onClick={() => void ctx.run(() => ctx.store.removeView(v.id))}>削除</button></article>; })}</div><Link to={`/${league}/data`}>データ探索で条件を保存 →</Link></>}
    {tab === "activity" && <><div className="list-heading"><span>直近60件・90日間。この端末のみ</span><button onClick={() => void ctx.run(() => ctx.store.clearActivity())}>履歴を消去</button></div>{!ctx.state?.activity.length && <p>最近見た履歴はありません。</p>}<div className="row-list">{ctx.state?.activity.map((a, i) => <Link className="library-row" key={i} to={activityPath(a)}><span><strong>{a.kind === "players" ? label({ league: a.league, playerId: a.entityId! }) : a.kind === "teams" ? teamNames.get(a.entityId!) ?? a.entityId : a.kind === "data" ? "データ探索" : a.kind === "history" ? "保存済みシーズン履歴" : a.kind === "series" ? `Series · ${a.entityId}` : `試合 · ${a.entityId}`}</strong><small>{a.league} · {new URLSearchParams(a.conditions).get("season") ?? ""} {new URLSearchParams(a.conditions).get("competition") === "postseason" ? "Postseason" : ""}</small></span></Link>)}</div></>}
    {tab === "collections" && <><form className="library-create" onSubmit={e => { e.preventDefault(); void ctx.run(() => ctx.store.createCollection(create)).then(ok => { if (ok) setCreate(""); }); }}><label>コレクション名<input maxLength={60} required value={create} onChange={e => setCreate(e.target.value)} placeholder="例：注目若手" /></label><button>作成</button></form><p className="inline-note">お気に入りとは別に選手を分類します。最大20組・各100人。成績の全件取得は行いません。</p>{ctx.state?.collections.map(c => <section className="library-collection" key={c.id}><div className="list-heading"><h2><Link to={`/${league}/library/collections/${encodeURIComponent(c.id)}`}>{c.name}</Link> <small>{c.players.length}人</small></h2><Link className="text-link" to={`/${league}/library/collections/${encodeURIComponent(c.id)}`}>成績を見る →</Link><button onClick={() => { setEditing(c.id); setRename(c.name); }}>名前変更</button><button onClick={() => { if (window.confirm(`「${c.name}」を削除しますか？`)) void ctx.run(() => ctx.store.removeCollection(c.id)); }}>削除</button></div>{editing === c.id && <form onSubmit={e => { e.preventDefault(); void ctx.run(() => ctx.store.renameCollection(c.id, rename)).then(ok => { if (ok) setEditing(""); }); }}><label>新しい名前<input required maxLength={60} value={rename} onChange={e => setRename(e.target.value)} /></label><button>変更</button></form>}{!c.players.length && <p>選手検索やプロフィールの「整理」から追加できます。</p>}<div className="row-list">{c.players.map(p => { const checked = selected.some(x => x.league === p.league && x.playerId === p.playerId), otherLeague = selected.length > 0 && selected[0]!.league !== p.league; return <div className="library-row" key={`${p.league}:${p.playerId}`}><label className="compare-pick"><input type="checkbox" aria-label={`${label(p)}を比較候補に選ぶ`} checked={checked} disabled={!checked && (selected.length >= 4 || otherLeague)} onChange={() => setSelected(checked ? selected.filter(x => x.league !== p.league || x.playerId !== p.playerId) : [...selected, p])} /></label><Link to={`/${p.league}/players/${encodeURIComponent(p.playerId)}${names.get(`${p.league}:${p.playerId}`)?.postseasonOnly ? "?competition=postseason" : ""}`}><strong>{label(p)}</strong><small>{p.league}{names.get(`${p.league}:${p.playerId}`)?.team ? ` · ${names.get(`${p.league}:${p.playerId}`)!.team}` : ""}</small></Link><button aria-label={`${label(p)}を${c.name}から外す`} onClick={() => { setSelected(selected.filter(x => x.league !== p.league || x.playerId !== p.playerId)); void ctx.run(() => ctx.store.setPlayer(c.id, p, false)); }}>外す</button></div>; })}</div></section>)}{selected.length >= 2 && <div>{selected[0]!.league === "MLB" && <div className="explorer-filter-grid"><label>比較シーズン<select value={compareSeason} onChange={e => setCompareSeason(e.target.value)}>{compareYears.map(y => <option key={y}>{y}</option>)}</select></label><label>試合区分<select value={compareScope} onChange={e => setCompareScope(e.target.value)}><option value="regular">レギュラーシーズン</option><option value="postseason">ポストシーズン</option></select></label></div>}{selected[0]!.league === "MLB" && !compareYears.includes(Number(compareSeason)) ? <DataState kind="unsupported" title="収録済みシーズンを選んでください" /> : <Link className="button" to={`/${selected[0]!.league}/compare?players=${selected.map(p => encodeURIComponent(p.playerId)).join("%2C")}${selected[0]!.league === "MLB" ? `&season=${compareSeason}${compareScope === "postseason" ? "&competition=postseason" : ""}` : ""}`}>{selected.length}人を比較 →</Link>}</div>}<Link to={`/${league}/search`}>選手を探して追加 →</Link></>}
    <details className="library-reset"><summary>保存領域の管理</summary><p>Collections・保存した条件・履歴だけをリセットします。Favoritesは維持します。</p><label><input type="checkbox" checked={reset} onChange={e => setReset(e.target.checked)} />リセットを確認</label><button disabled={!reset} onClick={() => { void ctx.run(() => ctx.store.reset()); setReset(false); }}>保存・履歴をリセット</button></details>
  </div>;
}
