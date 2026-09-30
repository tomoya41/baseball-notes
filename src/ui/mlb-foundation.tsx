import type { Favorite } from "../domain/models";
import { MlbHistoricalRoutes } from "./mlb-historical";

type FavoriteTarget = Pick<Favorite, "kind" | "entityId" | "league">;

export function MlbLeagueView({ favorites, toggle, saving }: {
  favorites: Favorite[];
  toggle: (target: FavoriteTarget) => void;
  saving: boolean;
}) {
  return <MlbHistoricalRoutes favorites={favorites} toggle={toggle} saving={saving} />;
}
