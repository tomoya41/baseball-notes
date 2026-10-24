import { RosterContextLink as Link } from "./roster-navigation";
import { useEffect, useState } from "react";

import type { NpbHistoricalManifest } from "../domain/npb-historical";
import type { NpbCatalog } from "../domain/npb-product-contract";
import { DataState, LoadingSkeleton } from "./components";
import { PlayerLifecycle } from "./npb-lifecycle";
import { NpbPlayerEventHistory } from "./npb-player-event-history";
import type { CohortRepository } from "./npb-historical-cohort";
import {historicalBirthDate} from "../domain/npb-age-season";

/** Explicit expansion only. Metadata and annual observations are never promoted to a complete career. */
export function NpbPlayerStory({ playerId, role, manifest, repository }: { playerId: string; role: "batting" | "pitching"; manifest: NpbHistoricalManifest | null; repository: CohortRepository }) {
  const [result, setResult] = useState<{ playerId: string; catalog: NpbCatalog } | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; void repository.catalog().then(catalog => { if (active) { setResult({ playerId, catalog }); setFailed(false); } }).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, [playerId, repository, attempt]);
  const player = result?.playerId === playerId ? result.catalog.players.find(p => p.playerId === playerId) : null;
  const observed = manifest?.players.find(p => p.playerId === playerId), birthDate=manifest&&result?.playerId===playerId?historicalBirthDate(playerId,result.catalog,manifest).birthDate:player?.profile.birthDate??null, birthYear=birthDate?Number(birthDate.slice(0,4)):null;
  if (failed) return <><DataState kind="source-unavailable" title="選手経歴を取得できません" /><button onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>経歴を再試行</button></>;
  if (result?.playerId !== playerId) return <LoadingSkeleton />;
  return <section aria-label="経歴と収録シーズンのつながり">
    <p className="data-notice">学校・ドラフト・所属履歴と、収録済みの年度成績をたどれます。完全なキャリアや現在の登録・引退状態を示すものではありません。</p>
    {player ? <PlayerLifecycle player={player} effectiveDate={result.catalog.effectiveDate} storyLink={false} /> : <><p>この選手の経歴プロフィールは未収録です。過去年度の成績から生年月日・指名年・在籍期間を推定しません。</p>{birthDate&&<p>生年月日 {birthDate} · 過去成績の確認済みIdentityに基づく情報です。年度ページから出典を確認できます。</p>}</>}
    <NpbPlayerEventHistory playerId={playerId} />
    <h2>収録されたシーズンへ</h2><p className="inline-note">球団・成績は各年度のページで確認できます。抜けている年度は出場なしを意味しません。年齢はその年の12月31日時点です。</p>
    {!manifest ? <p>年度一覧が未確認のため、収録シーズンは表示できません。</p> : observed ? <div className="hub-links">{observed.seasons.slice().sort((a, b) => a - b).map(year => <Link key={year} to={`/NPB/players/${playerId}/seasons?season=${year}&role=${role}&story=1`}>{year}年{birthYear !== null && year >= birthYear ? ` · 年末${year - birthYear}歳` : ""}</Link>)}</div> : <p>この選手の過去年度成績は未収録です。</p>}
    {birthYear !== null && <p><Link to={`/NPB/history?cohort=ageSeason&age=26&role=${role}&recentPlayers=${playerId}`}>同じ年齢のシーズンと見比べる →</Link></p>}
  </section>;
}
