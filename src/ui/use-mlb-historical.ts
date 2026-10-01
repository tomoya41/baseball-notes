import { useCallback, useEffect, useState } from "react";
import { validStaticPayload } from "../domain/mlb-historical-public";
import { japaneseHistoricalPayload } from "../domain/mlb-japanese-display";
import { publicAssetBase } from "../app/platform";
import { publicDataFetch, rememberPublicResponse } from "../app/mobile-services";
import { useHistoricalCompetition } from "./historical-competition-context";
import { mergeHistoricalDirectory, type HistoricalDirectoryPlayer } from "../domain/historical-directory";

const base = `${publicAssetBase()}data/mlb/historical/`;
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
    void publicDataFetch(`${base}${resolvedPath}.gz`).then(async response => {
      if (!active) return;
      if (response.status === 404) { setState({ path: resolvedPath, attempt, status: "missing", value: null }); return; }
      if (!response.ok) throw new Error(`MLB payload ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const text = bytes[0] === 0x1f && bytes[1] === 0x8b
        ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text()
        : new TextDecoder().decode(bytes);
      const value = JSON.parse(text) as T;
      if (!validStaticPayload(resolvedPath, value)) throw new Error("Invalid MLB public payload");
      await rememberPublicResponse(response);
      if (active) setState({ path: resolvedPath, attempt, status: "ready", value: japaneseHistoricalPayload(resolvedPath.replace(/^postseason\//, ""), value) });
    }).catch(() => { if (active) setState({ path: resolvedPath, attempt, status: "error", value: null }); });
    return () => { active = false; };
  }, [resolvedPath, attempt]);
  return { ...(state.path === resolvedPath && state.attempt === attempt ? state : { path: resolvedPath, status: "loading" as const, value: null }), retry };
}
export function useHistoricalDirectory() {
  const regular = useHistoricalStatic<{ players: HistoricalDirectoryPlayer[] }>("players/index.json");
  const postseason = useHistoricalStatic<{ players: HistoricalDirectoryPlayer[] }>("postseason/players/index.json");
  return { ...regular, value: regular.value ? { players: mergeHistoricalDirectory(regular.value.players, postseason.value?.players ?? []) } : null };
}
