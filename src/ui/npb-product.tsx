import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Services } from "../app/services";
import type { Favorite } from "../domain/models";
import type { NpbCatalog, NpbTeamSeason } from "../domain/npb-product-contract";
import type { NpbLatestStandings } from "../domain/standings";
import { positionDefinitions } from "../domain/baseball-terms";
import { formatDate, formatGamesBehind, formatWinningPercentage } from "../presentation/formatters";
import { DataState, LoadingSkeleton, SectionHeader } from "./components";
import { CompetitionHeader, HomeModeNav, Monogram } from "./design-system";
import { NpbRecentGames } from "./npb-game-surface";
import { NpbSavedPlayers } from "./npb-my";
import { NpbHotSection } from "./npb-hot";

type Target = Pick<Favorite, "kind" | "entityId" | "league">;
export function NpbStandings({ services, onEffectiveDate }: { services: Services; onEffectiveDate?: (date: string) => void }) {
  const [payload, setPayload] = useState<NpbLatestStandings | null>(null);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [division, setDivision] = useState<"Central" | "Pacific">("Central");
  useEffect(() => { let active = true; void services.standings.findLatestNpb().then(value => { if (active) { setPayload(value); setLoaded(true); if (value) onEffectiveDate?.(value.effectiveDate); } }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [services, onEffectiveDate]);
  return <section className="home-section standings-section"><SectionHeader title="ペナントレース" />
    <div className="segmented" role="group" aria-label="順位表のリーグ">{(["Central", "Pacific"] as const).map(value => <button key={value} aria-pressed={division === value} onClick={() => setDivision(value)}>{value === "Central" ? "セ・リーグ" : "パ・リーグ"}</button>)}</div>
    {error ? <DataState kind="source-unavailable" title="順位表を読み込めません" /> : !payload ? loaded ? <DataState kind="no-data" title="保存済みの順位表はありません" /> : <LoadingSkeleton /> : <>
      <p className="standings-asof">{formatDate(payload.throughDate, true)}終了時点</p>
      <div className="standings-scroll"><table className="standings-table"><thead><tr><th>順位</th><th>球団</th><th>勝–敗–分</th><th>勝率</th><th>差</th></tr></thead><tbody>
        {payload.standings.filter(row => row.competitionGroup === division).map(row => <tr key={row.teamId}><td>{row.rank}</td><th scope="row"><Link to={`/NPB/teams/${row.teamId}`}>{payload.teams[row.teamId]?.short ?? "球団"}</Link></th><td>{row.wins}–{row.losses}–{row.ties}</td><td>{formatWinningPercentage(row.pct)}</td><td>{formatGamesBehind(row.gamesBehindLeader, row.rank)}</td></tr>)}
      </tbody></table></div><details className="source-note"><summary>データ更新・出典</summary><p>{payload.attribution}</p></details>
    </>}
  </section>;
}
export function NpbHome({ services, favorites, toggle, saving }: { services: Services; favorites: Favorite[]; toggle: (target: Target) => void; saving: boolean }) {
  const [view,setView] = useState("scores");
  const [effectiveDate, setEffectiveDate] = useState<string | null>(null);
  const changeView = (next: string) => {
    if (next !== view) setEffectiveDate(null);
    setView(next);
  };
  return <div className="screen home-screen home-hub"><CompetitionHeader league="NPB" context={effectiveDate ? `${effectiveDate.slice(0, 4)}年 · 公式戦` : "公式戦"} />
    <HomeModeNav active={view} onChange={changeView} modes={[{id:"scores",label:"スコア"},{id:"standings",label:"順位表"},{id:"follow",label:"フォロー"}]} />
    {view === "scores" && <NpbRecentGames repository={services.gameSurface} onEffectiveDate={setEffectiveDate} />}
    {view === "standings" && <NpbStandings services={services} onEffectiveDate={setEffectiveDate} />}
    {view === "follow" && <section className="home-section"><SectionHeader title="お気に入り選手" action="My" to="/NPB/my" /><NpbSavedPlayers repository={services.directory} favorites={favorites} toggle={toggle} saving={saving} compact /></section>}
    <div className="hub-links"><Link to="/NPB/search">選手を探す <span>→</span></Link><Link to="/NPB/records">個人成績 <span>→</span></Link><Link to="/NPB/postseason">Postseason <span>→</span></Link></div>
    <div className="hub-readiness"><NpbHotSection repository={services.hot} /></div>
  </div>;
}
export function NpbProfileDetails({ player }: { player: NpbCatalog["players"][number] }) {
  const p = player.profile;
  const hand = { right: "右", left: "左", switch: "両" };
  const facts = [p.position && ["守備位置", positionDefinitions[p.position]], p.bats && ["打席", `${hand[p.bats]}打`], p.throws && ["投球", `${hand[p.throws]}投`], p.birthDate && ["生年月日", p.birthDate], p.ageYears !== null && ["年齢", `${p.ageYears}歳（${p.ageAsOfDate}時点）`], p.birthPlace && ["出身", p.birthPlace], p.heightCm !== null && ["身長", `${p.heightCm} cm`], p.weightKg !== null && ["体重", `${p.weightKg} kg`], player.membership.uniformNumber !== null && ["背番号", player.membership.uniformNumber], p.draftYear && ["ドラフト", `${p.draftYear}年 ${p.draftRound ?? ""}`]].filter((value): value is string[] => Boolean(value));
  return <section className="surface-card"><h2>プロフィール</h2>{facts.length ? <dl className="profile-definition">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p className="muted">詳しいプロフィールはまだ登録されていません。</p>}
    <p className="inline-note">確認できた項目のみ表示しています。所属は保存済み情報です。</p>
    {player.visual.photo.usage === "allowed" && <p className="inline-note">写真: <a href={player.visual.photo.licenseUrl!}>{player.visual.photo.attribution}</a></p>}
  </section>;
}
export function NpbTeam({ services }: { services: Services }) {
  const { teamId } = useParams();
  const [catalog, setCatalog] = useState<NpbCatalog | null>(null), [season, setSeason] = useState<NpbTeamSeason | null>(null), [error, setError] = useState(false);
  const [seasonState, setSeasonState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    void services.product.catalog().then(value => {
      if (!active) return;
      setCatalog(value); setSeason(null); setSeasonState("loading");
      return services.product.teamSeason(Number(value.effectiveDate.slice(0, 4)))
        .then(stats => { if (active) { setSeason(stats); setSeasonState("ready"); } })
        .catch(() => { if (active) setSeasonState("error"); });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [services]);
  if (!catalog) return error ? <DataState kind="source-unavailable" title="球団情報を読み込めません" /> : <LoadingSkeleton />;
  const team = catalog.teams.find(t => t.teamId === teamId), stats = season?.teams.find(t => t.teamId === teamId);
  if (!team) return <DataState kind="no-data" title="球団が見つかりません" />;
  return <div className="screen"><Link className="back-link" to="/NPB/home">← ホーム</Link><header className="profile-header"><Monogram name={team.abbreviation} large /><div><p className="eyebrow">NPB · {team.division === "Central" ? "セ・リーグ" : "パ・リーグ"}</p><h1>{team.name}</h1></div></header>
    <section className="surface-card"><h2>{season ? `${season.season}シーズン` : "シーズン成績"}</h2>
      {seasonState === "loading" ? <LoadingSkeleton /> : seasonState === "error" ?
        <DataState kind="source-unavailable" title="シーズン成績を読み込めません" /> : season && stats ? <>
        <p className="inline-note">{season.effectiveDate}までの保存済み試合 · {season.coverage.status === "complete" ? "確認済み" : "一部データ確認中"}</p>
        <div className="metric-grid">{[["試合", stats.G], ["勝", stats.W], ["敗", stats.L], ["引分", stats.T], ["得点", stats.runsFor], ["失点", stats.runsAgainst]].map(([label, value]) => <div className="metric-tile" key={label}><span className="metric-tile__label">{label}</span><strong className="metric-tile__value">{value ?? "—"}</strong></div>)}</div>
      </> : <DataState kind="no-data" title="保存済みのシーズン成績はありません" />}
    </section>
    <section className="surface-card"><h2>所属選手</h2><p className="inline-note">保存済みの所属情報。現在の登録公示を示すものではありません。</p><div className="row-list">{catalog.players.filter(p => p.membership.teamId === teamId).map(p => <Link className="player-row" key={p.playerId} to={`/NPB/players/${p.playerId}`}><Monogram name={p.displayName} /><span className="player-row__body"><strong>{p.displayName}</strong>{p.profile.position && <small>{positionDefinitions[p.profile.position]}</small>}</span><span aria-hidden="true">↗</span></Link>)}</div></section>
  </div>;
}
