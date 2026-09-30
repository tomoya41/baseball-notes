import { canonicalEntityRefSchema } from "./cross-league";
import type { Favorite } from "./models";
export function playerNotificationTopic(playerId: string): string {
  canonicalEntityRefSchema.parse({ league: "NPB", kind: "player", id: playerId });
  return `npb-player-${playerId.toLowerCase()}`;
}
export function favoriteNotificationTopics(favorites: Favorite[]) {
  return [...new Set(favorites.filter(f => f.league === "NPB" && f.kind === "player")
    .map(f => { try { return playerNotificationTopic(f.entityId); } catch { return null; } }).filter((t): t is string => t !== null))].sort();
}
export function eodNotification(date: string, playerId: string, name: string) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw Error("Invalid notification date");
  return { id: `npb:notification:eod:${date}:${playerId}`, topic: playerNotificationTopic(playerId),
    title: `${name}の成績が更新されました`, body: `${date}の保存済み成績を確認`,
    deepLink: `baseballnotes://NPB/players/${encodeURIComponent(playerId)}`, date };
}
