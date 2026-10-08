import { useCallback, useEffect, useState } from "react";
import { publicDataFetch } from "../app/mobile-services";
import { HistoricalProductHttpError, readHistoricalProduct } from "../app/historical-products";
import { useHistoricalCompetition } from "./historical-competition-context";
import { mergeHistoricalDirectory, type HistoricalDirectoryPlayer } from "../domain/historical-directory";
import { hasHistoricalPostseason, usePostseasonAvailability } from "./postseason-availability";

export function useHistoricalStatic<T>(path: string | null) {
  const competition = useHistoricalCompetition();
  const resolvedPath = path && competition === "postseason" && !path.startsWith("postseason/") ? `postseason/${path}` : path;
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const [state, setState] = useState<{ path: string | null; attempt: number; status: "loading" | "ready" | "missing" | "error"; value: T | null }>({
    path: null, attempt: 0, status: "loading", value: null,
  });
  useEffect(() => {
    if (!resolvedPath) return;
    let active = true;
    void readHistoricalProduct<T>(resolvedPath, publicDataFetch).then(value => {
      if (active) setState({ path: resolvedPath, attempt, status: "ready", value });
    }).catch(error => { if (active) setState({ path: resolvedPath, attempt,
      status: error instanceof HistoricalProductHttpError && error.status === 404 ? "missing" : "error", value: null }); });
    return () => { active = false; };
  }, [resolvedPath, attempt]);
  return { ...(state.path === resolvedPath && state.attempt === attempt ? state : { path: resolvedPath, status: "loading" as const, value: null }), retry };
}
export function useHistoricalDirectory() {
  const competition = useHistoricalCompetition();
  const availability = usePostseasonAvailability();
  const regular = useHistoricalStatic<{ players: HistoricalDirectoryPlayer[] }>("players/index.json");
  const postseason = useHistoricalStatic<{ players: HistoricalDirectoryPlayer[] }>(competition === "regular" && hasHistoricalPostseason(availability) ? "postseason/players/index.json" : null);
  if (competition === "postseason") return regular;
  return { ...regular, value: regular.value ? { players: mergeHistoricalDirectory(regular.value.players, postseason.value?.players ?? []) } : null };
}
