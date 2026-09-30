import { useEffect, useState } from "react";
import { validStaticPayload } from "../domain/mlb-historical-public";
import { japaneseHistoricalPayload } from "../domain/mlb-japanese-display";
import { publicAssetBase } from "../app/platform";
import { publicDataFetch, rememberPublicResponse } from "../app/mobile-services";

const base = `${publicAssetBase()}data/mlb/historical/`;
export function useHistoricalStatic<T>(path: string | null) {
  const [state, setState] = useState<{ path: string | null; status: "loading" | "ready" | "missing" | "error"; value: T | null }>({
    path: null, status: "loading", value: null,
  });
  useEffect(() => {
    if (!path) return;
    let active = true;
    void publicDataFetch(`${base}${path}.gz`).then(async response => {
      if (!active) return;
      if (response.status === 404) { setState({ path, status: "missing", value: null }); return; }
      if (!response.ok) throw new Error(`MLB payload ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const text = bytes[0] === 0x1f && bytes[1] === 0x8b
        ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text()
        : new TextDecoder().decode(bytes);
      const value = JSON.parse(text) as T;
      if (!validStaticPayload(path, value)) throw new Error("Invalid MLB public payload");
      await rememberPublicResponse(response);
      if (active) setState({ path, status: "ready", value: japaneseHistoricalPayload(path, value) });
    }).catch(() => { if (active) setState({ path, status: "error", value: null }); });
    return () => { active = false; };
  }, [path]);
  return state.path === path ? state : { path, status: "loading" as const, value: null };
}
