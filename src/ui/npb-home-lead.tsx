import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Favorite } from "../domain/models";
import type { NpbJapanSeries } from "../domain/npb-japan-series";
import { playerEventLabels, type NpbPlayerEvents } from "../domain/npb-player-events";
import { readNpbJapanSeries } from "../application/npb-japan-series-reader";
import { readNpbPlayerEvents } from "../application/npb-player-events-reader";
import { npbHomeContext, relevantJapanSeries } from "../presentation/npb-home-context";
import { SectionHeader } from "./components";
import { JapanSeriesHomeContent } from "./npb-japan-series-home";
import { NpbSeasonalHome } from "./npb-seasonal-home";

export function NpbHomeLead({ now, requested, favorites, visible }: { now: number; requested: string | null; favorites: readonly Favorite[]; visible: boolean }) {
  const [series, setSeries] = useState<NpbJapanSeries | null>(null), [events, setEvents] = useState<NpbPlayerEvents | null>(null);
  const [failed, setFailed] = useState(false), [retry, setRetry] = useState(0), [archive, setArchive] = useState(false);
  const context = npbHomeContext(now, requested, series, events, favorites);
  const { wantsSeries, wantsMovements } = context;
  // Pins are immutable. Re-evaluate dates/follows without polling providers or DB.
  // This component stays mounted across Home tabs, retaining verified responses.
  useEffect(() => {
    if (!visible) return;
    let active = true;
    void (async () => {
      let candidate = series;
      if (wantsSeries && !candidate) {
        try { candidate = await readNpbJapanSeries(); if (active) setSeries(candidate); }
        catch { if (active) setFailed(true); }
      }
      if (!active) return;
      if (wantsMovements && (!candidate || !wantsSeries || !relevantJapanSeries(candidate, now)) && !events) {
        try { const value = await readNpbPlayerEvents(); if (active) { setEvents(value); setFailed(false); } }
        catch { if (active) setFailed(true); }
      }
    })();
    return () => { active = false; };
    // Immutable responses are deliberately retained, not effect dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsSeries, wantsMovements, context.season.date, retry, visible]);
  if (!visible || context.focus === "scores") return null;
  return <div className="home-seasonal-lead" data-home-focus={context.focus}>
    {context.focus === "series" && series ? <JapanSeriesHomeContent data={series} now={now} embedded /> : context.focus === "moves" && events ? <section className="home-section" aria-label="注目の選手の動き">
      <SectionHeader title="選手の動き" action="すべて" to="/NPB/moves" />
      <ol className="row-list">{context.movements.map(({ event, player, followed }) => <li key={event.id}><Link className="player-row" to={`/NPB/moves?player=${event.playerId}`}><span className="player-row__body"><strong>{player.name}</strong><small>{playerEventLabels[event.kind]}{followed && " · フォロー"}</small></span><time dateTime={event.recordedDate}>{event.recordedDate.slice(5).replace("-", "/")}</time></Link></li>)}</ol>
      <p className="inline-note">記事記録 · 一部収録 · <a href={events.source.url}>Wikipediaの執筆者</a> · <a href={events.source.licenseUrl}>CC BY-SA 4.0</a></p>
      <nav className="home-context-links" aria-label="移籍と契約更改"><Link to="/NPB/moves?kind=trade"><strong>移籍・トレード</strong><small>収録された記載へ</small></Link><Link to="/NPB/moves?kind=contract_renewal"><strong>契約更改</strong><small>{events.events.some(e => e.kind === "contract_renewal") ? "収録された記載へ" : "未収録"}</small></Link></nav>
      <details className="home-tools"><summary>季節の特集</summary><NpbSeasonalHome supporting now={now}/></details>
    </section> : <><NpbSeasonalHome now={now}/>{failed && <p role="status" className="inline-note">選手の動きを読み込めません。<button onClick={() => { setFailed(false); setRetry(n => n + 1); }}>再試行</button></p>}</>}
    {context.focus !== "series" && wantsSeries && series && <details className="home-tools" data-japan-home-archive onToggle={e => setArchive(e.currentTarget.open)}><summary>日本シリーズの収録情報</summary>{archive && <JapanSeriesHomeContent data={series} now={now} embedded/>}</details>}
  </div>;
}
