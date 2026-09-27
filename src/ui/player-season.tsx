import type { PlayerRecentResponse } from "../domain/player-recent";
import { formatDate } from "../presentation/formatters";
import { DataState, LoadingSkeleton, SectionHeader } from "./components";
import { StatTiles, CoverageNote } from "./player-recent";

export function PlayerSeasonView({payload,state}:{payload:PlayerRecentResponse|null;state:"loading"|"ready"|"missing"|"error"}) {
  const batting=payload?.batting,pitching=payload?.pitching;
  return <section className="stats-section player-season" aria-label="2026シーズン成績">
    <SectionHeader title="2026シーズン成績" />
    <p className="recent-dates">保存済み成績{payload && ` · ${formatDate(payload.asOfDate,true)}終了時点`}</p>
    {state==="loading" && <div aria-live="polite"><LoadingSkeleton /></div>}
    {state==="error" && <DataState kind="source-unavailable" title="シーズン成績を読み込めません" />}
    {(state==="missing" || (state==="ready" && !batting && !pitching)) &&
      <DataState kind="no-data" title="保存済みシーズン成績はありません" />}
    {state==="ready" && batting && <div className="recent-group"><h3>打撃</h3>
      <StatTiles stats={batting} keys={["OPS","AVG","HR","RBI","PA"]} />
      <CoverageNote stats={batting} period="season" />
      <details className="advanced-disclosure"><summary>打撃の詳細成績</summary>
        <StatTiles stats={batting} keys={["G","AB","R","H","2B","3B","BB","HBP","SH","SF","SO","SB","CS","OBP","SLG"]} /></details>
    </div>}
    {state==="ready" && pitching && <div className="recent-group"><h3>投球</h3>
      <StatTiles stats={pitching} keys={["ERA","K9","outsRecorded","SO","G","GS"]} />
      <CoverageNote stats={pitching} period="season" />
      <details className="advanced-disclosure"><summary>投球の詳細成績</summary>
        <StatTiles stats={pitching} keys={["BF","H","HR","R","ER","pitchCount","W","L","HLD","SV"]} /></details>
    </div>}
  </section>;
}
