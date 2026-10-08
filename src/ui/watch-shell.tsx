import { useContext, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { PersonalWatch } from "../application/personal-watch";
import type { League } from "../domain/models";
import type { PersonalWatchState } from "../domain/personal-watch";
import { PersonalWatchContext } from "./personal-watch-context";

export function PersonalWatchProvider({ store, children }: { store: PersonalWatch; children: ReactNode }) {
  const [state, setState] = useState<PersonalWatchState | null>(null), [error, setError] = useState("");
  useEffect(() => { let active = true; void store.read().then(s => { if (active) setState(s); }).catch(e => { if (active) setError(String(e.message)); }); return () => { active = false; }; }, [store]);
  const run = async (operation: () => Promise<PersonalWatchState>) => { try { setState(await operation()); setError(""); return true; } catch (e) { setError(e instanceof Error ? e.message : "Watchを保存できません。"); return false; } };
  return <PersonalWatchContext.Provider value={{ state, error, store, run }}>{children}</PersonalWatchContext.Provider>;
}
export function WatchSummary({ league }: { league: League }) {
  const ctx = useContext(PersonalWatchContext), items = ctx?.state?.alerts.filter(a => !a.dismissed && !a.read && a.observation.league === league) ?? [];
  const weight = { high: 0, normal: 1, low: 2 }, summary = [...items].sort((a,b)=>weight[a.priority]-weight[b.priority] || b.createdAt-a.createdAt);
  return <section className="watch-summary" aria-label="Watchの確認差分"><div className="list-heading"><Link to={`/${league}/watch-center`}><strong>Watch</strong> <span className="watch-count">{items.length} 未読</span></Link><Link to={`/${league}/watch-center`}>すべて見る →</Link></div>{summary.slice(0,2).map(a => <Link className="watch-summary-item" key={a.id} to={a.observation.path}>{a.observation.name}<small>{a.title} · {a.observation.effectiveDate}</small></Link>)}</section>;
}
