import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { activityFromRoute, type PersonalLibrary, type PersonalState } from "../application/personal-library";
import { LibraryContext } from "./personal-library-context";

export function PersonalLibraryProvider({ store, children }: { store: PersonalLibrary; children: ReactNode }) {
  const [state, setState] = useState<PersonalState | null>(null), [error, setError] = useState("");
  const location = useLocation();
  useEffect(() => { let active = true; void store.read().then(s => { if (active) setState(s); }).catch(e => { if (active) setError(String(e.message)); }); return () => { active = false; }; }, [store]);
  useEffect(() => { const item = activityFromRoute(location.pathname, location.search, Date.now()); if (!item) return;
    let active = true; void store.visit(item).then(s => { if (active) { setState(s); setError(""); } }).catch(e => { if (active) setError(String(e.message)); }); return () => { active = false; };
  }, [store, location.pathname, location.search]);
  const run = async (operation: () => Promise<PersonalState>) => { try { setState(await operation()); setError(""); return true; } catch (e) { setError(e instanceof Error ? e.message : "端末へ保存できません。保存容量を確認してください。"); return false; } };
  return <LibraryContext.Provider value={{ state, error, run, store }}>{children}</LibraryContext.Provider>;
}
