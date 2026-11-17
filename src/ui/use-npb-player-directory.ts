import { useEffect, useState } from "react";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";
import { usePublicDataRevalidation } from "./use-public-data-revalidation";

export type DirectoryReader = { findLatestNpb(): Promise<NpbPlayerDirectory> };
export type DirectoryState = "loading" | "ready" | "error";

export function useNpbPlayerDirectory(repository: DirectoryReader, enabled = true) {
  const [result, setResult] = useState<{ directory: NpbPlayerDirectory | null; state: DirectoryState; checkedRevision: number }>({
    directory: null, state: "loading", checkedRevision: 0,
  });
  const revision = usePublicDataRevalidation(enabled);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void repository.findLatestNpb().then(value => {
      if (active) setResult({ directory: value, state: "ready", checkedRevision: revision });
    }).catch(() => { if (active) setResult(previous => ({ ...previous, state: "error" })); });
    return () => { active = false; };
  }, [repository, enabled, revision]);

  return result;
}
