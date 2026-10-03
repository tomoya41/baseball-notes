import { createContext, useContext } from "react";
import type { CompetitionType } from "../domain/competition";
import { competitionFromSearch } from "../domain/competition";
export const HistoricalCompetitionContext = createContext<CompetitionType>("regular");
export const useHistoricalCompetition = () => useContext(HistoricalCompetitionContext);
export function historicalRouteCompetition(pathname: string, search: string): CompetitionType {
  return ["players", "search", "schedule", "records", "games", "teams", "compare"].includes(pathname.split("/")[2] ?? "")
    ? competitionFromSearch(new URLSearchParams(search)) : "regular";
}
export const historicalSearchPath = (search: string) => `/MLB/search${search}`;
