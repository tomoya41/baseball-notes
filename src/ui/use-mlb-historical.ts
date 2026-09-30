import { useCallback, useEffect, useState } from "react";
import { validStaticPayload } from "../domain/mlb-historical-public";
import { japaneseHistoricalPayload } from "../domain/mlb-japanese-display";
import { publicAssetBase } from "../app/platform";
import { publicDataFetch, rememberPublicResponse } from "../app/mobile-services";

const base = `${publicAssetBase()}data/mlb/historical/`;
export function useHistoricalStatic<T>(path: string | null) {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const [state, setState] = useState<{ path: string | null; attempt: number; status: "loading" | "ready" | "missing" | "error"; value: T | null }>({
    path: null, attempt: 0, status: "loading", value: null,
  });
  useEffect(() => {
    if (!path) return;
    let active = true;
    void publicDataFetch(`${base}${path}.gz`).then(async response => {
      if (!active) return;
      if (response.status === 404) { setState({ path, attempt, status: "missing", value: null }); return; }
      if (!response.ok) throw new Error(`MLB payload ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const text = bytes[0] === 0x1f && bytes[1] === 0x8b
        ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text()
        : new TextDecoder().decode(bytes);
      const value = JSON.parse(text) as T;
      if (!validStaticPayload(path, value)) throw new Error("Invalid MLB public payload");
      await rememberPublicResponse(response);
      if (active) setState({ path, attempt, status: "ready", value: japaneseHistoricalPayload(path, value) });
    }).catch(() => { if (active) setState({ path, attempt, status: "error", value: null }); });
    return () => { active = false; };
  }, [path, attempt]);
  return { ...(state.path === path && state.attempt === attempt ? state : { path, status: "loading" as const, value: null }), retry };
}
