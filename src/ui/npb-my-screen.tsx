import { Link } from "react-router-dom";
import type { Services } from "../app/services";
import type { Favorite } from "../domain/models";
import { NpbPersonalDashboard } from "./daily-dashboard";
import { NpbFollowedEventRecords } from "./npb-followed-event-records";
import { NpbSavedPlayers } from "./npb-my";
import { MyLibrary } from "./personal-library";
import { WatchSummary } from "./watch-shell";
import "./npb-personal-records.css";

type FavoriteTarget = Pick<Favorite, "kind" | "entityId" | "league">;

function jumpTo(id: string) {
  const section = document.getElementById(id);
  section?.scrollIntoView({ block: "start" });
  section?.focus({ preventScroll: true });
}

export function NpbMyScreen({ services, favorites, toggle, saving }: {
  services: Services; favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean;
}) {
  const followed = favorites.filter(item => item.league === "NPB");
  const players = new Set(followed.filter(item => item.kind === "player").map(item => item.entityId));
  const teams = new Set(followed.filter(item => item.kind === "team").map(item => item.entityId));

  return <div className="screen npb-my-screen">
    <header className="personal-records-heading my-heading">
      <div><p className="eyebrow">NPB / My</p><h1>あなたのフォロー</h1><p>応援する選手の成績と歩みを、ここから。</p></div>
      <dl className="my-follow-counts"><div><dt>選手</dt><dd>{players.size}<small>人</small></dd></div><div><dt>球団</dt><dd>{teams.size}<small>球団</small></dd></div></dl>
    </header>
    <nav className="my-section-actions" aria-label="Myで見るもの">
      <button type="button" onClick={() => jumpTo("my-following")}>フォロー</button>
      <button type="button" onClick={() => jumpTo("my-recent")}>最近の記録</button>
      <button type="button" onClick={() => jumpTo("my-library")}>保存・整理</button>
    </nav>
    <WatchSummary league="NPB" />
    {followed.length ? <>
      <section className="my-content-section" id="my-following" tabIndex={-1} aria-label="フォロー中の選手">
        <div className="personal-section-heading"><h2>フォロー中の選手</h2><Link to="/NPB/search">追加する →</Link></div>
        <NpbSavedPlayers heading={false} repository={services.directory} favorites={favorites} toggle={toggle} saving={saving} />
      </section>
      <section className="my-content-section" id="my-recent" tabIndex={-1} aria-label="フォロー中の最近の記録">
        <div className="personal-section-heading"><h2>保存済みの成績と試合</h2></div>
        <NpbPersonalDashboard services={services} favorites={favorites} toggle={toggle} saving={saving} />
        <NpbFollowedEventRecords favorites={favorites} />
      </section>
    </> : <section className="my-start my-content-section" id="my-following" tabIndex={-1}>
      <h2>気になる選手・球団から始める</h2>
      <p>プロフィールの★を押すと、成績や最近の記事記録をMyからたどれます。</p>
      <div className="my-start-links"><Link to="/NPB/search">選手を探す →</Link><Link to="/NPB/teams">球団を探す →</Link></div>
      <div id="my-recent" tabIndex={-1}><Link className="text-link" to="/NPB/moves">収録済みの選手の動きを見る →</Link></div>
    </section>}
    <section className="my-content-section" id="my-library" tabIndex={-1} aria-label="保存した情報">
      <MyLibrary league="NPB" showWatch={false} />
    </section>
  </div>;
}
