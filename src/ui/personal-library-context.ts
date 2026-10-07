import { createContext } from "react";
import type { PersonalLibrary, PersonalState } from "../application/personal-library";
export type LibraryContextValue = { state: PersonalState | null; error: string; run: (operation: () => Promise<PersonalState>) => Promise<boolean>; store: PersonalLibrary };
export const LibraryContext = createContext<LibraryContextValue | null>(null);
