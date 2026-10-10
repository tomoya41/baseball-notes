export type CollectedSeasonLine = { playerId: string; batting: Record<string, { value: number | null; status?: string }> | null;
  pitching: Record<string, { value: number | null; status?: string }> | null };
/** Only additive, fully known counting metrics; no rate titles, Career, or cross-scope aggregation. */
export function collectedCountingRecords(lines: readonly CollectedSeasonLine[], names: ReadonlyMap<string, string>) {
  return ([ ["H", "batting"], ["HR", "batting"], ["RBI", "batting"], ["SB", "batting"],
    ["SO", "pitching"], ["W", "pitching"], ["SV", "pitching"] ] as const).map(([metric, role]) => {
    const totals = new Map<string, number | null>();
    for (const line of lines) {
      if (line[role] === null) continue; // No appearance in this role, not an unknown metric.
      const value = line[role]![metric];
      if (!value || value.value === null || !Number.isSafeInteger(value.value) || value.value < 0 ||
        (value.status !== undefined && value.status !== "complete") || totals.get(line.playerId) === null) totals.set(line.playerId, null);
      else totals.set(line.playerId, (totals.get(line.playerId) ?? 0) + value.value);
    }
    const ranked = [...totals].flatMap(([playerId, value]) => value === null || !names.has(playerId) ? [] : [{ playerId, name: names.get(playerId)!, value }])
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "en") || a.playerId.localeCompare(b.playerId));
    return { metric, role, rows: ranked.slice(0, 20).map((row, index) => ({ ...row,
      rank: index && ranked[index - 1]?.value === row.value ? ranked.findIndex(other => other.value === row.value) + 1 : index + 1 })) };
  });
}
