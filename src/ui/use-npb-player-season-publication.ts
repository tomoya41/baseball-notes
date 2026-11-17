import { useEffect, useState } from "react";
import { readPublishedPlayerStatsForDirectory, type PublishedPlayerStats } from "../application/npb-published-player";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";

export function useNpbPlayerSeasonPublication(playerId: string | undefined, directory: NpbPlayerDirectory | null,
  checkedRevision: number, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<{
    playerId: string; directoryDate: string; data: PublishedPlayerStats | null; failed: boolean;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!playerId || !directory || !enabled) return;
    let active = true;
    void readPublishedPlayerStatsForDirectory(playerId, "season", directory).then(data => {
      if (active) setSnapshot({ playerId, directoryDate: directory.effectiveDate, data, failed: false });
    }).catch(() => {
      if (active) setSnapshot(previous => ({ playerId, directoryDate: directory.effectiveDate,
        data: previous?.playerId === playerId ? previous.data : null, failed: true }));
    });
    return () => { active = false; };
  }, [playerId, directory, checkedRevision, enabled, attempt]);

  const selected = snapshot?.playerId === playerId ? snapshot : null;
  const isCurrentCheck = selected && selected.directoryDate === directory?.effectiveDate;
  return {
    data: selected?.data ?? null,
    failed: isCurrentCheck ? selected.failed : false,
    pending: enabled && !isCurrentCheck,
    retry: () => setAttempt(value => value + 1),
  };
}
