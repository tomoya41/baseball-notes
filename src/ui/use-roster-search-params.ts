import { useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { teamPlayerReturnPath } from "../presentation/team-player-list";
export function useRosterSearchParams() {
  const location = useLocation(), [params, setParams] = useSearchParams();
  const state = teamPlayerReturnPath(location.state) ? location.state : undefined;
  const update: typeof setParams = useCallback((next, options) => setParams(next, {
    ...options, state: options && "state" in options ? options.state : state,
  }), [setParams, state]);
  return [params, update] as const;
}
