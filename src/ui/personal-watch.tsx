import { useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Services } from "../app/services";
import type { Favorite, League } from "../domain/models";
import { readWatchObservations, watchSources, type WatchCheck } from "../application/watch-observations";
import { watchFresh, WATCH_LIMITS, type WatchPreferences } from "../domain/personal-watch";
import { PersonalWatchContext } from "./personal-watch-context";
import { LibraryContext } from "./personal-library-context";
import { publicFallbackRevision, publicNetworkOnline } from "../app/mobile-services";
import { LoadingSkeleton, PageHeading, MetricLabel } from "./components";

const labels: [keyof WatchPreferences, string][] = [["players","お気に入り選手の試合記録"],["teams","お気に入り球団の試合記録・保存済み次戦"],["recent","Recentの数値変化"],["streaks","確認できる連続記録"],["milestones","保存済みSeasonの節目"],["postseason","Historical Seriesの保存状態"],["collections","Collections内の選手"],["savedViews","保存した全選手Recent条件への新規一致"]];
export function WatchCenter({ league, services, favorites, ready }: { league: League; services: Services; favorites: Favorite[]; ready: boolean }) {
  const ctx = useContext(PersonalWatchContext), library = useContext(LibraryContext), [busy,setBusy] = useState(false), [check,setCheck] = useState<WatchCheck | null>(null), [message,setMessage] = useState(""), [filter,setFilter] = useState("all"), [reset,setReset] = useState(false);
  const initial = useRef(false), active = useRef(true);
  const [displayNow] = useState(() => Date.now());
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const evaluate = async () => {
    if (!ctx?.state || !library?.state || !ready || busy) return;
    if (!publicNetworkOnline()) { setMessage("オフラインです。保存済みWatchを表示します。確認状態は更新しません。"); return; }
    setBusy(true); setMessage("");
    const revision = publicFallbackRevision();
    try {
      const result = await readWatchObservations(league, favorites, library.state, ctx.state.preferences, watchSources(services));
      if (!active.current) return;
      setCheck(result);
      if (!publicNetworkOnline() || publicFallbackRevision() !== revision) { setMessage("保存済みデータが含まれるため差分判定を保留しました。オンラインで再確認してください。"); return; }
      const ok = await ctx.run(() => ctx.store.observe(result.observations, league, result.activeEntities));
      if (ok && active.current) setMessage("確認しました。初回の対象は基準値のみ保存します。");
    } catch (e) { if (active.current) setMessage(e instanceof Error ? e.message : "データを確認できません。"); }
    finally { if (active.current) setBusy(false); }
  };
  useEffect(() => { if (!initial.current && ready && ctx?.state && library?.state) { initial.current = true; void evaluate(); } });
  if (!ctx) return null;
  const alerts = ctx.state?.alerts.filter(a=>a.observation.league===league && !a.dismissed) ?? [], unread = alerts.filter(a=>!a.read).length;
  const visible = alerts.filter(a=>filter !== "unread" || !a.read);
  return <div className="screen watch-center"><PageHeading eyebrow={`${league} · ${league === "MLB" ? "HISTORICAL DATA" : "SAVED CURRENT DATA"}`} title="Watch Center" /><Link className="back-link" to={`/${league}/my`}>← My</Link>
    <p className="inline-note">前回確認時からデータ上変化。アプリで取得した際に検出します。リアルタイム・バックグラウンド通知ではありません。</p>
    <div className="list-heading"><strong>{unread} 未読</strong><button onClick={() => void evaluate()} disabled={busy || !ctx.state || !library?.state || !ready}>{busy ? "確認中…" : "データを確認"}</button><button disabled={!unread || busy} onClick={()=>void ctx.run(()=>ctx.store.markRead(undefined,league))}>すべて既読</button></div>
    {message && <p role="status" className="data-notice">{message}</p>}{ctx.error && <p role="alert" className="data-notice">{ctx.error}</p>}{library?.error && <p role="alert">保存条件・Collectionsを読み込めません。{library.error}</p>}
    {!ctx.state && !ctx.error && <LoadingSkeleton />}
    <details className="watch-preferences"><summary>追跡・Alert設定</summary><p className="inline-note">設定の変更後は新しい基準値から確認します。通知許可は不要です。Recentは両回のサンプル20 PA以上でOPS差0.050、3回以上でERA差1.00以上。Collectionのみの選手はOPS差0.100、ERA差1.50以上。</p>{labels.map(([key,label])=><label key={key}><input type="checkbox" checked={ctx.state?.preferences[key] ?? false} disabled={!ctx.state || busy} onChange={e=>{ const value=e.target.checked; if (ctx.state) void ctx.run(()=>ctx.store.preference(key,value)); }} />{label}</label>)}<p className="inline-note">最大12選手・4球団・6保存条件。お気に入り選手から優先。NPB Postseasonは未対応。次戦は公開済み予定のみ確認し、MLBはHistorical確認差分です。</p></details>
    <nav className="segmented" aria-label="Watch表示"><button aria-pressed={filter==="all"} onClick={()=>setFilter("all")}>すべて</button><button aria-pressed={filter==="unread"} onClick={()=>setFilter("unread")}>未読</button></nav>
    {ctx.state && !visible.length && <div className="data-notice"><strong>確認差分はありません</strong><p>初回は基準値を保存します。FavoritesやCollectionsを追跡し、データ更新後に再確認してください。</p><Link to={`/${league}/my`}>追う対象を管理 →</Link></div>}
    <div className="row-list">{visible.map(a=><article className={`watch-alert${a.read ? " is-read" : ""}`} key={a.id}><div className="list-heading"><strong>{a.priority === "high" ? "節目・Series" : a.priority === "low" ? "数値・条件" : "記録更新"}</strong><span>{a.read ? "既読" : "未読"}</span></div><Link to={a.observation.path} onClick={()=>void ctx.run(()=>ctx.store.markRead(a.id))}><h2>{a.observation.name}</h2><p>{a.title}</p></Link><dl className="watch-values">{Object.entries(a.observation.values).filter(([k])=>!["gameId","gameNumber","atLeast","step","winner","date"].includes(k)).map(([k,v])=><div key={k}><dt><MetricLabel metric={k === "value" ? a.observation.metric : k} label={k === "value" ? a.observation.metric : k === "sample" ? "サンプル" : k} /></dt><dd>{v === null ? "—" : typeof v === "number" && !Number.isInteger(v) ? v.toFixed(3) : String(v)}{typeof a.previous[k] === "number" && a.previous[k] !== v && <small> 前回 {a.previous[k]}</small>}</dd></div>)}</dl><small>{a.observation.league === "MLB" ? "Historical · " : ""}{a.observation.season} {a.observation.competition === "regular" ? "Regular" : "Postseason"} · {a.observation.effectiveDate}まで{a.observation.eventDate ? ` · 試合日 ${a.observation.eventDate}` : ""} · Coverage {a.observation.coverage}{!watchFresh(a.observation,displayNow) ? " · 古い確認データ" : ""}</small><small>確認 {new Date(a.createdAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</small><div className="watch-actions"><button disabled={a.read} onClick={()=>void ctx.run(()=>ctx.store.markRead(a.id))}>既読にする</button><button onClick={()=>void ctx.run(()=>ctx.store.dismiss(a.id))}>非表示</button></div></article>)}</div>
    {check && <details className="watch-diagnostics"><summary>確認範囲・利用できない判定</summary><p>{check.targets}対象 · {check.fetches}読み込み · {Math.round(check.elapsedMs)} ms · 保存 {new TextEncoder().encode(JSON.stringify(ctx.state)).length.toLocaleString()} bytes · Alert上限{WATCH_LIMITS.alerts}</p><ul>{check.notes.map(n=><li key={n}>{n}</li>)}</ul></details>}
    <details className="library-reset"><summary>Watchの保存領域</summary><p>確認状態・Alert・設定だけをリセットします。Favorites、Collections、保存条件は維持します。最大100件・90日間、端末のみ。</p><label><input type="checkbox" checked={reset} onChange={e=>setReset(e.target.checked)} />Watchのリセットを確認</label><button disabled={!reset || busy} onClick={()=>void ctx.run(()=>ctx.store.reset()).then(ok=>{if(ok){setReset(false);setCheck(null);setMessage("Watchをリセットしました。次回は基準値のみ保存します。");}})}>Watchのみリセット</button></details>
  </div>;
}
