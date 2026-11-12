import { z } from "zod";
import { canonicalEntityRefSchema } from "./cross-league";
import { npbCompetitionLabels } from "./npb-competition";
import { npbScheduleTeam } from "./npb-game-navigation";

type GameStage = "regular" | "npb_cs_first" | "npb_cs_final" | "japan_series";
export type NpbGamePlayerContext = {
  gameId: string;
  date: string;
  side: "away" | "home";
  stage: GameStage;
  role: "batting" | "pitching";
  scheduleTeam?: string | undefined;
};

export function npbGamePlayerContext(params: URLSearchParams): NpbGamePlayerContext | null {
  const gameId = params.get("game"), date = params.get("date"), season = params.get("season");
  const role = params.get("role"), side = params.get("boxSide"), competition = params.get("competition");
  const stage = params.get("stage");
  if (!gameId || !canonicalEntityRefSchema.safeParse({ league: "NPB", kind: "game", id: gameId }).success ||
    !date || !z.iso.date().safeParse(date).success || season !== date.slice(0, 4) ||
    (side !== "home" && side !== "away") || (role !== "batting" && role !== "pitching") ||
    ["game", "date", "season", "role", "boxSide", "competition", "stage"].some(key => params.getAll(key).length > 1)) return null;
  if (competition === "regular" && stage === null) {
    const scheduleTeam = npbScheduleTeam(params);
    return { gameId, date, side, role, stage: "regular", ...(scheduleTeam ? { scheduleTeam } : {}) };
  }
  if (competition === "postseason" && (stage === "npb_cs_first" || stage === "npb_cs_final" || stage === "japan_series")) return { gameId, date, side, role, stage };
  return null;
}

export function npbGamePlayerSearch(context: NpbGamePlayerContext) {
  const params = new URLSearchParams({ game: context.gameId, date: context.date, season: context.date.slice(0, 4),
    role: context.role, boxSide: context.side, competition: context.stage === "regular" ? "regular" : "postseason" });
  if (context.stage !== "regular") params.set("stage", context.stage);
  else if (context.scheduleTeam) params.set("team", context.scheduleTeam);
  return params;
}

export function npbGamePlayerLinks(playerId: string, context: NpbGamePlayerContext) {
  const search = npbGamePlayerSearch(context), game = new URLSearchParams({ date: context.date, boxSide: context.side });
  if (context.stage !== "regular") {
    game.set("competition", "postseason");
    game.set("stage", context.stage);
    game.set("season", context.date.slice(0, 4));
  } else if (context.scheduleTeam) game.set("team", context.scheduleTeam);
  const base = `/NPB/players/${encodeURIComponent(playerId)}`;
  return {
    scope: `${context.date.slice(0, 4)}年 · ${npbCompetitionLabels[context.stage]} · ${context.role === "pitching" ? "投球" : "打撃"}`,
    search: `?${search}`,
    profile: `${base}?${search}`,
    annual: `${base}/seasons?${search}`,
    compare: context.stage === "regular" ? `/NPB/compare?${new URLSearchParams({ ...Object.fromEntries(search), players: playerId, player: playerId })}` : null,
    game: `/NPB/games/${encodeURIComponent(context.gameId)}?${game}`,
  };
}
