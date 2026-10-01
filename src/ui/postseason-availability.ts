import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { postseasonCapabilitiesSchema, postseasonCapabilities } from "../domain/postseason-capabilities";
import { publicAssetBase } from "../app/platform";
import { publicDataFetch, rememberPublicResponse } from "../app/mobile-services";

export type PostseasonAvailability = { status: "loading" | "ready" | "error"; value: typeof postseasonCapabilities; retry: () => void };
export const PostseasonAvailabilityContext = createContext<PostseasonAvailability>({ status: "loading", value: postseasonCapabilities, retry: () => {} });
export const usePostseasonAvailability = () => useContext(PostseasonAvailabilityContext);
export function hasHistoricalPostseason(state: PostseasonAvailability, season?: number) {
  return state.status === "ready" && state.value.leagues.MLB.historical.status === "available" &&
    (season === undefined ? state.value.leagues.MLB.historicalSeasons.length > 0 : state.value.leagues.MLB.historicalSeasons.includes(season));
}
export function usePublishedPostseasonCapabilities(): PostseasonAvailability {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(n => n + 1), [setAttempt]);
  const [state, setState] = useState<{ attempt: number; status: PostseasonAvailability["status"]; value: typeof postseasonCapabilities }>({ attempt: 0, status: "loading", value: postseasonCapabilities });
  useEffect(() => {
    let active = true;
    void publicDataFetch(`${publicAssetBase()}data/postseason/capabilities.json`).then(async response => {
      if (!response.ok) throw new Error("Postseason capabilities unavailable");
      const value = postseasonCapabilitiesSchema.parse(await response.json());
      await rememberPublicResponse(response);
      if (active) setState({ attempt, status: "ready", value });
    }).catch(() => { if (active) setState({ attempt, status: "error", value: postseasonCapabilities }); });
    return () => { active = false; };
  }, [attempt]);
  return { ...state, status: state.attempt === attempt ? state.status : "loading", retry };
}
