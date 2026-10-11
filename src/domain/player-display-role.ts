/** Display policy only. Never changes Facts, qualification or official record ranks. */
export type BattingDisplayRole = "fielder" | "dh" | "pitcher" | "unknown";
export type BattingView = "standard" | "pitchers" | "all";
export function battingDisplayRole(positions: readonly string[]): BattingDisplayRole {
  const known = positions.map(p => p.toUpperCase());
  if (known.includes("DH")) return "dh";
  if (known.some(p => ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "IF", "FIELDER"].includes(p))) return "fielder";
  return known.includes("P") || known.includes("PITCHER") ? "pitcher" : "unknown";
}
export function battingView(params: URLSearchParams): BattingView {
  return params.get("battingView") === "pitchers" ? "pitchers" : params.get("battingView") === "all" ? "all" : "standard";
}
export function includesBattingRole(role: BattingDisplayRole | undefined, view: BattingView): boolean {
  // Missing season evidence stays visible; never infer pitcher from a single outing.
  return view === "all" || (view === "pitchers" ? role === "pitcher" : role !== "pitcher");
}
