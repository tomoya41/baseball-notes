import { PlayerRepository } from "../application/player-repository";
import { Favorites } from "../application/favorites";
import { SampleProvider } from "../infrastructure/providers/sample-provider";
import { UnavailableAnalysisProvider } from "../infrastructure/providers/unavailable-analysis-provider";
import { UnavailableWatchProvider } from "../infrastructure/providers/unavailable-watch-provider";
import type { AnalysisProvider } from "../application/ports";
import { foundationAnalysisCapabilities } from "./analysis-policy";
import { IndexedDbCache, PreferenceStore } from "../infrastructure/storage";
import { StaticStandingsRepository } from "../infrastructure/providers/static-standings-repository";
import { HttpPlayerRecentRepository } from "../infrastructure/providers/http-player-recent-repository";
import { Capacitor } from "@capacitor/core";

// Composition root: replace adapters here, never inside a screen.
const npbDataBaseUrl = import.meta.env.VITE_NPB_DATA_BASE_URL?.trim() ||
  (Capacitor.isNativePlatform() ? "https://tomoya41.github.io/baseball-notes/" : import.meta.env.BASE_URL);

export const services = {
  players: new PlayerRepository(new SampleProvider(), new IndexedDbCache()),
  analysis: new UnavailableAnalysisProvider(foundationAnalysisCapabilities) as AnalysisProvider,
  watch: new UnavailableWatchProvider(),
  standings: new StaticStandingsRepository(import.meta.env.BASE_URL, undefined, npbDataBaseUrl),
  recent: new HttpPlayerRecentRepository(import.meta.env.VITE_NPB_PLAYER_API_BASE_URL?.trim() || "https://baseball-notes-recent.vercel.app/"),
  favorites: new Favorites(new PreferenceStore()),
};
export type Services = typeof services;
