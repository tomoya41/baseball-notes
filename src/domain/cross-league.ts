import { z } from "zod";
import { leagueSchema } from "./models";
import type { Favorite, League } from "./models";

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const canonicalEntityRefSchema = z.object({
  league: leagueSchema,
  kind: z.enum(["player", "team", "game"]),
  id: z.string(),
}).superRefine((ref, ctx) => {
  const pattern = ref.league === "MLB" ? new RegExp(`^mlb:${ref.kind}:${uuid}$`, "i")
    : ref.kind === "player" ? new RegExp(`^${uuid}$`, "i")
    : ref.kind === "game" ? /^npb:game:[0-9a-f]{20}$/i : /^npb:team:[a-z][a-z0-9-]*$/;
  if (!pattern.test(ref.id)) ctx.addIssue({ code: "custom", message: "Canonical league/entity mismatch" });
});
export type CanonicalEntityRef = z.infer<typeof canonicalEntityRefSchema>;

export function canonicalEntityPath(ref: CanonicalEntityRef): string {
  const value = canonicalEntityRefSchema.parse(ref);
  return `/${value.league}/${value.kind}s/${encodeURIComponent(value.id)}`;
}

export function favoriteMatches(item: Favorite, target: Pick<Favorite, "kind" | "league" | "entityId">): boolean {
  return item.league === target.league && item.kind === target.kind && item.entityId === target.entityId;
}

export function leagueSwitchPath(pathname: string, search: string, next: League): string {
  leagueSchema.parse(next);
  if (pathname.split("/")[1] === next) return `${pathname}${search}`;
  const section = pathname.split("/")[2] ?? "home";
  const destination = ["home", "search", "analysis", "records", "my", "ranking", "schedule"].includes(section)
    ? section : "search";
  // IDs and date/season context never cross leagues: NPB Current and MLB
  // Historical have different available calendars. The target selects its own.
  return `/${next}/${destination}`;
}

export function normalizePlayerSearch(value: string): string {
  return value.normalize("NFKC").normalize("NFD").replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-US").trim().replace(/\s+/g, " ");
}
