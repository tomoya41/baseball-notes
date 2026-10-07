import { createContext } from "react";
import type { PersonalWatch } from "../application/personal-watch";
import type { PersonalWatchState } from "../domain/personal-watch";
export const PersonalWatchContext = createContext<{ state: PersonalWatchState | null; error: string; store: PersonalWatch; run: (operation: () => Promise<PersonalWatchState>) => Promise<boolean> } | null>(null);
