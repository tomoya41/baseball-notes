import { createContext, useContext } from "react";
import type { CompetitionType } from "../domain/competition";
export const HistoricalCompetitionContext = createContext<CompetitionType>("regular");
export const useHistoricalCompetition = () => useContext(HistoricalCompetitionContext);
