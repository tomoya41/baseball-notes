import { lazy, Suspense, useState } from "react";
import type { Favorite } from "../domain/models";
import { LoadingSkeleton } from "./components";

const RecordsBody = lazy(() => import("./npb-player-events").then(m => ({ default: m.NpbFollowedEventRecordsBody })));

export function NpbFollowedEventRecords({ favorites }: { favorites: readonly Favorite[] }) {
  return favorites.some(f => f.league === "NPB") ? <FollowedRecordsDisclosure favorites={favorites} /> : null;
}

function FollowedRecordsDisclosure({ favorites }: { favorites: readonly Favorite[] }) {
  const [opened, setOpened] = useState(false);
  return <details className="advanced-disclosure npb-followed-event-records" onToggle={e => { if (e.currentTarget.open) setOpened(true); }}>
    <summary>フォロー中の選手・球団の記事記録</summary>
    {opened && <Suspense fallback={<LoadingSkeleton />}><RecordsBody favorites={favorites} /></Suspense>}
  </details>;
}
