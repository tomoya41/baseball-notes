import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import type { Favorite } from "../domain/models";
import type { LeagueAvailability } from "../domain/league-availability";
import type { LeagueAvailabilityRepository } from "../application/league-availability-repository";
import { canonicalEntityRefSchema } from "../domain/cross-league";
import { DataState, FavoriteButton, LoadingSkeleton, PageHeading } from "./components";

type FavoriteTarget = Pick<Favorite, "kind" | "entityId" | "league">;
export function MlbEntityPage({ kind, state, retry }: {
  kind: "player" | "team" | "game"; state: "loading" | "error" | "unavailable"; retry: () => void;
}) {
  const params = useParams();
  const valid = canonicalEntityRefSchema.safeParse({ league: "MLB", kind, id: params[`${kind}Id`] }).success;
  return valid ? <MlbUnavailableSection title={kind === "game" ? "試合データ" : kind === "team" ? "球団データ" : "選手データ"}
    state={state} retry={retry} /> : <div className="screen"><PageHeading eyebrow="MLB" title="ページが見つかりません" />
    <DataState kind="no-data" title="MLBのURLを確認してください" action="MLBホームへ" to="/MLB/home" /></div>;
}
export function MlbUnavailableSection({ title, state, retry, children }: {
  title: string; state: "loading" | "error" | "unavailable"; retry: () => void; children?: ReactNode;
}) {
  return <div className="screen">
    <PageHeading eyebrow="MLB / 2026" title={title} />
    {state === "loading" ? <LoadingSkeleton /> : state === "error" ? <>
      <DataState kind="source-unavailable" title="データの提供状況を読み込めません" />
      <button className="button" type="button" onClick={retry}>再試行</button>
    </> : <DataState kind="unsupported" title="MLBの実データはまだ提供していません"
      detail="データ提供の準備が整い次第、保存済みの成績を表示します。" />}
    {children}
  </div>;
}

export function LeagueSavedPlayers({ favorites, toggle, saving }: {
  favorites: Favorite[]; toggle: (target: FavoriteTarget) => void; saving: boolean;
}) {
  const saved = favorites.filter(item => item.league === "MLB" && item.kind === "player");
  const npbCount = favorites.filter(item => item.league === "NPB" && item.kind === "player").length;
  return <div className="screen">
    <PageHeading eyebrow="MLB / My" title="お気に入り選手" detail="この端末に保存しています" />
    <Link className="button" to="/NPB/my">NPBのお気に入り（{npbCount}）</Link>
    {saved.length ? <div className="row-list">{saved.map((item, index) =>
      <div className="surface-favorite" key={`${item.league}:${item.entityId}`}>
        <span>MLB · 選手情報を確認できません</span>
        <FavoriteButton active saving={saving} label={`MLBの登録済み選手 ${index + 1}`} onClick={() => toggle(item)} />
      </div>)}</div> : <DataState kind="no-data" title="MLBのお気に入りはまだありません" />}
    <p className="inline-note">選手情報が未提供の登録も保持しています。</p>
  </div>;
}

export function MlbLeagueView({ repository, favorites, toggle, saving }: {
  repository: LeagueAvailabilityRepository; favorites: Favorite[];
  toggle: (target: FavoriteTarget) => void; saving: boolean;
}) {
  const [payload, setPayload] = useState<LeagueAvailability | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void repository.find("MLB").then(value => { if (active) setPayload(value); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [repository, attempt]);
  const retry = () => { setError(false); setAttempt(value => value + 1); };
  // No sample fallback, NPB repositories, or client database/provider access.
  const state = error ? "error" : payload ? "unavailable" : "loading";
  const page = (title: string) => <MlbUnavailableSection title={title} state={state} retry={retry} />;
  return <Routes>
    <Route path="home" element={<MlbUnavailableSection title="MLBの野球データ" state={state} retry={retry}>
      <nav aria-label="MLBのデータを探す">
        <Link className="ranking-entry" to="/MLB/schedule">日程・結果</Link>
        <Link className="ranking-entry" to="/MLB/search">選手を探す</Link>
        <Link className="ranking-entry" to="/MLB/my">お気に入り選手</Link>
      </nav>
    </MlbUnavailableSection>} />
    <Route path="search" element={page("選手を探す")} />
    <Route path="schedule" element={page("日程・結果")} />
    <Route path="games/:gameId" element={<MlbEntityPage kind="game" state={state} retry={retry} />} />
    <Route path="players/:playerId/:section?" element={<MlbEntityPage kind="player" state={state} retry={retry} />} />
    <Route path="teams/:teamId" element={<MlbEntityPage kind="team" state={state} retry={retry} />} />
    <Route path="analysis" element={page("選手の分析")} />
    <Route path="records" element={page("シーズン記録を準備中")} />
    <Route path="ranking" element={page("ランキングを準備中")} />
    <Route path="my" element={<LeagueSavedPlayers favorites={favorites} toggle={toggle} saving={saving} />} />
    <Route path="favorites" element={<Navigate to="/MLB/my" replace />} />
    <Route path="players" element={<Navigate to="/MLB/search" replace />} />
    <Route path="*" element={<Navigate to="/MLB/home" replace />} />
  </Routes>;
}
