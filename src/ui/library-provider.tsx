import { useEffect, useRef, useState, type ReactNode } from "react";
import { onPersonalRestored } from "../app/personal-events";
import { useLocation } from "react-router-dom";
import { activityFromRoute, type PersonalLibrary, type PersonalState } from "../application/personal-library";
import { LibraryContext } from "./personal-library-context";

export function PersonalLibraryProvider({ store, children }: { store: PersonalLibrary; children: ReactNode }) {
  const [state, setState] = useState<PersonalState | null>(null), [error, setError] = useState("");
  const location = useLocation();
  const generation = useRef(0);
  useEffect(() => { let active = true; const refresh = () => { const v = ++generation.current; void store.read().then(s => { if (active && v === generation.current) { setState(s); setError(""); } }).catch(e => { if (active && v === generation.current) setError(String(e.message)); }); };
    refresh(); const unsubscribe = onPersonalRestored(refresh); return () => { active = false; unsubscribe(); }; }, [store]);
  useEffect(() => { const item = activityFromRoute(location.pathname, location.search, Date.now()); if (!item) return;
    const v = ++generation.current; let active = true; void store.visit(item).then(s => { if (active && v === generation.current) { setState(s); setError(""); } }).catch(e => { if (active && v === generation.current) setError(String(e.message)); }); return () => { active = false; };
  }, [store, location.pathname, location.search]);
  const run = async (operation: () => Promise<PersonalState>) => { const v = ++generation.current; try { const next = await operation(); if (v === generation.current) { setState(next); setError(""); } return true; } catch (e) { if (v === generation.current) setError(e instanceof Error ? e.message : "端末へ保存できません。保存容量を確認してください。"); return false; } };
  return <LibraryContext.Provider value={{ state, error, run, store }}>{children}</LibraryContext.Provider>;
}
