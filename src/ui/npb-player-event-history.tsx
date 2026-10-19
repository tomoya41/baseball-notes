import { lazy, Suspense, useState } from "react";
import { npbEventQuery } from "../domain/npb-event-query";
import { LoadingSkeleton } from "./components";

const HistoryBody = lazy(() => import("./npb-player-events").then(m => ({ default: m.NpbPlayerEventHistoryBody })));

export function NpbPlayerEventHistory({ playerId }: { playerId: string }) {
  if (!playerId || !npbEventQuery(new URLSearchParams({ player: playerId })).valid) return null;
  return <HistoryDisclosure key={playerId} playerId={playerId} />;
}
function HistoryDisclosure({ playerId }: { playerId: string }) {
  const [activated, setActivated] = useState(false);
  return <section aria-label="記事でたどる選手の動き"><h2>選手の動き</h2><details className="advanced-disclosure" onToggle={e => { if (e.currentTarget.open) setActivated(true); }}><summary>2026年の契約・移籍・戦力外・引退発表</summary>
    {activated && <Suspense fallback={<LoadingSkeleton />}><HistoryBody playerId={playerId} /></Suspense>}
  </details></section>;
}
