import { PlayerRepository } from "../application/player-repository";
import { Favorites } from "../application/favorites";
import { SampleProvider } from "../infrastructure/providers/sample-provider";
import { IndexedDbCache, PreferenceStore } from "../infrastructure/storage";

// Composition root: replace adapters here, never inside a screen.
export const services = {
  players: new PlayerRepository(new SampleProvider(), new IndexedDbCache()),
  favorites: new Favorites(new PreferenceStore()),
};
export type Services = typeof services;
