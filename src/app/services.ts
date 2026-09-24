import { PlayerRepository } from "../application/player-repository";
import { Favorites } from "../application/favorites";
import { SampleProvider } from "../infrastructure/providers/sample-provider";
import { UnavailableAnalysisProvider } from "../infrastructure/providers/unavailable-analysis-provider";
import { UnavailableWatchProvider } from "../infrastructure/providers/unavailable-watch-provider";
import type { AnalysisProvider } from "../application/ports";
import { foundationAnalysisCapabilities } from "./analysis-policy";
import { IndexedDbCache, PreferenceStore } from "../infrastructure/storage";
import { StaticStandingsRepository } from "../infrastructure/providers/static-standings-repository";

// Composition root: replace adapters here, never inside a screen.
export const services = {
  players: new PlayerRepository(new SampleProvider(), new IndexedDbCache()),
  analysis: new UnavailableAnalysisProvider(foundationAnalysisCapabilities) as AnalysisProvider,
  watch: new UnavailableWatchProvider(),
  standings: new StaticStandingsRepository(import.meta.env.BASE_URL, undefined,
    import.meta.env.VITE_NPB_DATA_BASE_URL?.trim() || import.meta.env.BASE_URL),
  favorites: new Favorites(new PreferenceStore()),
};
export type Services = typeof services;
