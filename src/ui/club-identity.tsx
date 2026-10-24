import type { ReactNode } from "react";
import { clubStyle } from "../presentation/club-style";
export function ClubIdentity({ teamId, children }: { teamId?: string | undefined; children: ReactNode }) {
  return <span className={`club-identity${teamId ? " club-identity--known" : ""}`} style={clubStyle(teamId)}>{children}</span>;
}
