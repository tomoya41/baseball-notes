import type { CSSProperties } from "react";
import type { League, Team } from "../domain/models";
import { formatTeamName } from "../presentation/formatters";

type BrandMark =
  | { kind: "official-logo"; src: string; alt: string; licenseRecord: string }
  | { kind: "custom-badge" | "text-mark" | "monogram"; text: string };

interface BrandIdentity {
  accent: string;
  mark: BrandMark;
}

// Only synthetic teams are registered. Real logos require a reviewed license record.
const teamBrands: Record<string, BrandIdentity> = {
  "sample:NPB:team:aoba": { accent: "#13849a", mark: { kind: "monogram", text: "青" } },
  "sample:MLB:team:harbor": { accent: "#4676b0", mark: { kind: "monogram", text: "H" } },
};

const leagueBrands: Record<League, BrandIdentity> = {
  NPB: { accent: "#246884", mark: { kind: "text-mark", text: "NPB" } },
  MLB: { accent: "#344f8d", mark: { kind: "text-mark", text: "MLB" } },
};

function mark(identity: BrandIdentity, label: string) {
  if (identity.mark.kind === "official-logo") {
    return <img src={identity.mark.src} alt={identity.mark.alt} />;
  }
  return <span aria-hidden="true">{identity.mark.text || label.slice(0, 1)}</span>;
}

export function TeamBrand({ team, size = "sm" }: { team: Team | null | undefined; size?: "xs" | "sm" | "md" | "lg" }) {
  const label = formatTeamName(team, "short");
  const identity = team ? teamBrands[team.id] : undefined;
  const fallback: BrandIdentity = {
    accent: "var(--brand)",
    mark: { kind: "monogram", text: team?.names.abbreviation?.slice(0, 1) ?? label.slice(0, 1) },
  };
  const chosen = identity ?? fallback;
  return (
    <span className={`team-brand team-brand--${size}`} role="img" aria-label={`${label}の識別マーク`}
      style={{ "--team-accent": chosen.accent } as CSSProperties}>
      {mark(chosen, label)}
    </span>
  );
}

export function LeagueBadge({ league }: { league: League }) {
  const identity = leagueBrands[league];
  return <span className="league-badge" style={{ "--team-accent": identity.accent } as CSSProperties}>
    {mark(identity, league)}
  </span>;
}
