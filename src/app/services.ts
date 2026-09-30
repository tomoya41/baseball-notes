import { Favorites } from "../application/favorites";
import { PreferenceStore } from "../infrastructure/storage";
import { StaticStandingsRepository } from "../infrastructure/providers/static-standings-repository";
import { StaticHotRepository } from "../infrastructure/providers/static-hot-repository";
import { StaticPlayerDirectoryRepository } from "../infrastructure/providers/static-player-directory-repository";
import { HttpPlayerRecentRepository } from "../infrastructure/providers/http-player-recent-repository";
import { HttpPlayerGameLogRepository } from "../infrastructure/providers/http-player-game-log-repository";
import { HttpNpbGameDetailRepository } from "../infrastructure/providers/http-npb-game-detail-repository";
import { HttpPlayerPeriodComparisonRepository } from "../infrastructure/providers/http-player-period-comparison-repository";
import { HttpPlayerHomeAwayRepository } from "../infrastructure/providers/http-player-home-away-repository";
import { HttpPlayerOpponentRepository } from "../infrastructure/providers/http-player-opponent-repository";
import { HttpPlayerAnalysisBundleRepository } from "../infrastructure/providers/http-player-analysis-bundle-repository";
import { publicAssetBase } from "./platform";
import { StaticGameSurfaceRepository } from "../infrastructure/providers/static-game-surface-repository";
import { StaticLeagueAvailabilityRepository } from "../infrastructure/providers/static-league-availability-repository";
import { StaticNpbProductRepository } from "../infrastructure/providers/static-npb-product-repository";

// Composition root: replace adapters here, never inside a screen.
const npbDataBaseUrl = import.meta.env.VITE_NPB_DATA_BASE_URL?.trim() ||
  publicAssetBase();

export const services = {
  leagueAvailability: new StaticLeagueAvailabilityRepository(publicAssetBase()),
  standings: new StaticStandingsRepository(import.meta.env.BASE_URL, undefined, npbDataBaseUrl),
  hot: new StaticHotRepository(npbDataBaseUrl),
  directory: new StaticPlayerDirectoryRepository(npbDataBaseUrl),
  product: new StaticNpbProductRepository(npbDataBaseUrl),
  gameSurface: new StaticGameSurfaceRepository(npbDataBaseUrl),
  recent: new HttpPlayerRecentRepository(import.meta.env.VITE_NPB_PLAYER_API_BASE_URL?.trim() || "https://baseball-notes-recent.vercel.app/"),
  gameLog: new HttpPlayerGameLogRepository(import.meta.env.VITE_NPB_PLAYER_API_BASE_URL?.trim() || "https://baseball-notes-recent.vercel.app/"),
  gameDetail: new HttpNpbGameDetailRepository(import.meta.env.VITE_NPB_PLAYER_API_BASE_URL?.trim() || "https://baseball-notes-recent.vercel.app/"),
  periodComparison: new HttpPlayerPeriodComparisonRepository(import.meta.env.VITE_NPB_PLAYER_API_BASE_URL?.trim() || "https://baseball-notes-recent.vercel.app/"),
  homeAway: new HttpPlayerHomeAwayRepository(import.meta.env.VITE_NPB_PLAYER_API_BASE_URL?.trim() || "https://baseball-notes-recent.vercel.app/"),
  opponent: new HttpPlayerOpponentRepository(import.meta.env.VITE_NPB_PLAYER_API_BASE_URL?.trim() || "https://baseball-notes-recent.vercel.app/"),
  analysisBundle: new HttpPlayerAnalysisBundleRepository(import.meta.env.VITE_NPB_PLAYER_API_BASE_URL?.trim() || "https://baseball-notes-recent.vercel.app/"),
  favorites: new Favorites(new PreferenceStore()),
};
export type Services = typeof services;
