import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { onPersonalRestored } from "../app/personal-events";
import { Link } from "react-router-dom";
import type { PersonalWatch } from "../application/personal-watch";
import type { League } from "../domain/models";
import type { PersonalWatchState } from "../domain/personal-watch";
import { PersonalWatchContext } from "./personal-watch-context";

export function PersonalWatchProvider({ store, children }: { store: PersonalWatch; children: ReactNode }) {
  const [state, setState] = useState<PersonalWatchState | null>(null), [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => { let active = true; const refresh = () => { const v = ++generation.current; void store.read().then(s => { if (active && v === generation.current) { setState(s); setError(""); } }).catch(e => { if (active && v === generation.current) setError(String(e.message)); }); };
    refresh(); const unsubscribe = onPersonalRestored(refresh); return () => { active = false; unsubscribe(); }; }, [store]);
  const run = async (operation: () => Promise<PersonalWatchState>) => { const v = ++generation.current; try { const next = await operation(); if (v === generation.current) { setState(next); setError(""); } return true; } catch (e) { if (v === generation.current) setError(e instanceof Error ? e.message : "Watchを保存できません。"); return false; } };
  return <PersonalWatchContext.Provider value={{ state, error, store, run }}>{children}</PersonalWatchContext.Provider>;
}
export function WatchSummary({ league }: { league: League }) {
  const ctx = useContext(PersonalWatchContext), items = ctx?.state?.alerts.filter(a => !a.dismissed && !a.read && a.observation.league === league) ?? [];
  const weight = { high: 0, normal: 1, low: 2 }, summary = [...items].sort((a,b)=>weight[a.priority]-weight[b.priority] || b.createdAt-a.createdAt);
  return <section className="watch-summary" aria-label="前回確認時からの変化"><div className="list-heading"><Link to={`/${league}/watch-center`}><strong>フォローの変化</strong> <span className="watch-count">{items.length} 未読</span></Link><Link to={`/${league}/watch-center`}>見る →</Link></div>{summary.slice(0,2).map(a => <Link className="watch-summary-item" key={a.id} to={a.observation.path}>{a.observation.name}<small>{a.title} · {a.observation.effectiveDate}</small></Link>)}</section>;
}
