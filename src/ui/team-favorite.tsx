import type { Favorite, League } from "../domain/models";
import { FavoriteButton } from "./components";
export type FavoriteTarget = Pick<Favorite, "league" | "kind" | "entityId">;
export type FavoriteActions = { favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean };
export function TeamFavorite({ league, teamId, name, favorites, toggle, saving }: FavoriteActions & { league: League; teamId: string; name: string }) {
  return <FavoriteButton label={name} saving={saving} active={favorites.some(f => f.league === league && f.kind === "team" && f.entityId === teamId)} onClick={() => toggle({ league, kind: "team", entityId: teamId })} />;
}
