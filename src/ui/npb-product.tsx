import { formatThrowBat } from "../presentation/baseball-language";
import { clubStyle } from "../presentation/club-style";
import { currentTeamPlayers, sortTeamPlayers } from "../presentation/team-player-list";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { Services } from "../app/services";
import type { Favorite } from "../domain/models";
import type { NpbCatalog, NpbTeamSeason } from "../domain/npb-product-contract";
import type { NpbLatestStandings } from "../domain/standings";
import { positionDefinitions } from "../domain/baseball-terms";
import { formatDate, formatGamesBehind, formatWinningPercentage } from "../presentation/formatters";
import { DataState, LoadingSkeleton, SectionHeader } from "./components";
import { CompetitionHeader, HomeModeNav } from "./design-system";
import { NpbSavedPlayers } from "./npb-my";
import { NpbHotSection } from "./npb-hot";
import { NpbTeamActivity, TeamMetrics } from "./team-hub";
import { NpbToday, NpbSavedGames, NpbPersonalDashboard } from "./daily-dashboard";
import { TeamFavorite } from "./team-favorite";
import { ExplorerLinks } from "./data-explorer";
import { LifecycleLinks } from "./npb-lifecycle";
import { HomeDiscover, HomeSearchEntry, TeamRecord } from "./signature";
import { NpbHomeLead } from "./npb-home-lead";
import { npbSeasonalHome } from "../domain/npb-seasonal-home";

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
  const [now,setNow] = useState(Date.now);
  useEffect(()=>{const tick=()=>setNow(Date.now());window.addEventListener("focus",tick);const timer=window.setInterval(tick,60000);return()=>{window.removeEventListener("focus",tick);window.clearInterval(timer);};},[]);
  const [params, setParams] = useSearchParams();
  const context = npbSeasonalHome(now, params.get("homeSeason"));
  const [savedOpen, setSavedOpen] = useState(false);
  const [view,setView] = useState("scores");
  const [effectiveDate, setEffectiveDate] = useState<string | null>(null);
  const changeView = (next: string) => {
    if (next !== view) setEffectiveDate(null);
    setView(next);
  };
  const savedResults = <div className="home-main"><NpbSavedGames services={services} onEffectiveDate={setEffectiveDate} />{favorites.some(f=>f.league==="NPB"&&f.kind==="player")&&<div className="home-follow"><NpbPersonalDashboard services={services} favorites={favorites} toggle={toggle} saving={saving} compact /></div>}<Link className="section-action" to="/NPB/weekly?stage=regular">公式戦の週間レポート →</Link></div>;
  return <div className="screen home-screen home-hub"><div className="home-controls home-controls--contextual"><CompetitionHeader league="NPB" context={view !== "scores" || context.mode === "regular" ? effectiveDate ? `${effectiveDate.slice(0,4)}年 · 公式戦` : "公式戦" : "野球のいまを探す"}>
      <label className="competition-season"><span className="sr-only">ホームの表示内容</span><select aria-label="ホームの表示内容" value={context.manual ? context.mode : "auto"} onChange={e => { const next = new URLSearchParams(params); if(e.target.value === "auto")next.delete("homeSeason");else next.set("homeSeason", e.target.value);setParams(next); }}><option value="auto">自動</option><option value="spring">春・開幕前</option><option value="regular">公式戦</option><option value="autumn">CS・ドラフト</option><option value="winter">移籍・契約更改</option></select></label>
    </CompetitionHeader><HomeModeNav active={view} onChange={changeView} modes={[{id:"scores",label:"トップ"},{id:"standings",label:"順位表"},{id:"follow",label:"フォロー"}]} /></div>
    <NpbHomeLead now={now} requested={params.get("homeSeason")} favorites={favorites} visible={view === "scores"}/>
    {view === "scores" && <>{context.mode === "regular" ? savedResults : <details className="home-tools" onToggle={e=>setSavedOpen(e.currentTarget.open)}><summary>公式戦の保存済み結果</summary>{savedOpen && savedResults}</details>}<HomeSearchEntry league="NPB" /></>}
    {view === "standings" && <NpbStandings services={services} onEffectiveDate={setEffectiveDate} />}
    {view === "follow" && <><NpbToday services={services} favorites={favorites} toggle={toggle} saving={saving} personal /><NpbPersonalDashboard services={services} favorites={favorites} toggle={toggle} saving={saving} compact /><section className="home-section"><SectionHeader title="お気に入り選手" action="My" to="/NPB/my" /><NpbSavedPlayers repository={services.directory} favorites={favorites} toggle={toggle} saving={saving} compact /></section></>}
    <HomeDiscover league="NPB" />
    <details className="home-availability"><summary>HOT · 公開状況を確認</summary><NpbHotSection repository={services.hot} /></details>
    <details className="home-tools"><summary>記録・ポストシーズン・その他の機能</summary><div className="hub-links"><Link to="/NPB/records">個人成績 →</Link><Link to="/NPB/postseason">ポストシーズン →</Link></div><ExplorerLinks league="NPB" /></details>
  </div>;
}
export function NpbProfileDetails({ player }: { player: NpbCatalog["players"][number] }) {
  const p = player.profile;
  const schools = [...new Set([...(p.schools ?? []), ...(p.amateurHistory ?? []).map(v => v.name)])];
  const facts = [(p.position || p.knownPositions?.length) && ["守備位置", p.position ? positionDefinitions[p.position] : p.knownPositions!.join("・")], ["投打", formatThrowBat(p.throws, p.bats)], p.birthDate && ["生年月日", p.birthDate], p.ageYears !== null && ["年齢", `${p.ageYears}歳（${p.ageAsOfDate}時点）`], p.originPlace && ["出身", p.originPlace], p.birthPlace && ["出生地", p.birthPlace], p.nationality && ["国籍", p.nationality], p.heightCm !== null && ["身長", `${p.heightCm} cm`], p.weightKg !== null && ["体重", `${p.weightKg} kg`], player.membership.uniformNumber !== null && ["背番号", player.membership.uniformNumber], (p.draftYear || p.draftRound) && ["ドラフト", `${p.draftYear ? `${p.draftYear}年 ` : ""}${p.draftRound ?? ""}`], p.draftTeamName && ["指名球団", p.draftTeamName], schools.length > 0 && ["出身校・在籍校", schools.join("・")], p.joinedYear != null && ["入団年", `${p.joinedYear}年`], p.debutYear != null && ["プロ初出場", `${p.debutYear}年`], p.npbDebutYear != null && ["NPB初出場", `${p.npbDebutYear}年`]].filter((value): value is string[] => Boolean(value));
  return <section className="surface-card"><h2>プロフィール</h2>{facts.length ? <dl className="profile-definition">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p className="muted">詳しいプロフィールはまだ登録されていません。</p>}
    <p className="inline-note">確認できた項目のみ表示しています。所属は保存済み情報です。</p>
    {!!p.affiliations?.length && <details className="source-note"><summary>確認済みの球歴・所属情報（一部）</summary><ul>{p.affiliations.map((a, i) => <li key={i}>{a.name}{a.from || a.to ? `（${a.from ?? "開始未確認"}〜${a.to ?? "終了未確認"}）` : "（期間未確認）"}{a.uniformNumber !== null && ` · 背番号 ${a.uniformNumber}`}</li>)}</ul><p className="inline-note">全所属歴・現在の登録状況を示すものではありません。</p></details>}
    {!!p.credits?.length && <details className="source-note"><summary>プロフィールの出典・利用条件</summary>{p.credits.map(c => <p key={c.url}><a href={c.url}>{c.name}</a> · <a href={c.licenseUrl}>{c.licenseUrl.includes("opendatacommons") ? "ODC-BY 1.0" : c.licenseUrl.includes("by-sa") ? "CC BY-SA 4.0" : "CC BY 4.0"}</a> · 原記事からの変更：項目の抜粋・表記整理。</p>)}</details>}
    {player.visual.photo.usage === "allowed" && <p className="inline-note">写真: <a href={player.visual.photo.licenseUrl!}>{player.visual.photo.attribution}</a></p>}
  </section>;
}
export function NpbTeam({ services, hub = false, favorites = [], toggle, saving = false }: { services: Services; hub?: boolean; favorites?: Favorite[]; toggle?: (target: Target) => void; saving?: boolean }) {
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
  return <div className="screen team-hub"><Link className="back-link" to="/NPB/teams">← 球団一覧</Link><header className="profile-header club-profile" style={clubStyle(team.teamId)}><div><p className="eyebrow">NPB · {team.division === "Central" ? "セ・リーグ" : "パ・リーグ"}</p><h1>{team.name}</h1></div></header>

    <Link className="button button--secondary" to={`/NPB/teams/${encodeURIComponent(team.teamId)}/players`}>選手一覧 · 背番号・年度で探す →</Link><section className="surface-card"><h2>{season ? `${season.season}シーズン` : "シーズン成績"}</h2>
      {seasonState === "loading" ? <LoadingSkeleton /> : seasonState === "error" ?
        <DataState kind="source-unavailable" title="シーズン成績を読み込めません" /> : season && stats ? <>
        <p className="inline-note">{season.period.to}までの保存済み試合 · {season.coverage.status === "complete" ? "確認済み" : "一部データ確認中"}</p>
        <TeamRecord wins={stats.W} losses={stats.L} ties={stats.T} /><div className="metric-grid team-secondary-stats">{[["試合", stats.G], ["得点", stats.runsFor], ["失点", stats.runsAgainst]].map(([label, value]) => <div className="metric-tile" key={label}><span className="metric-tile__label">{label}</span><strong className="metric-tile__value">{value ?? "—"}</strong></div>)}</div>
      </> : <DataState kind="no-data" title="保存済みのシーズン成績はありません" />}
    </section>
    <div className="hub-links"><Link to={`/NPB/team-compare?teams=${encodeURIComponent(team.teamId)}`}>球団比較へ追加 →</Link><Link to={`/NPB/season-compare?kind=team&entity=${encodeURIComponent(team.teamId)}`}>保存済み年度を比較 →</Link></div>{toggle && <div className="team-follow-action"><TeamFavorite league="NPB" teamId={team.teamId} name={team.name} favorites={favorites} toggle={toggle} saving={saving} /><span>球団をフォロー</span></div>}
    {hub && <>{stats && <details className="team-stat-details"><summary>チーム打撃・投球成績</summary><TeamMetrics batting={stats.batting} pitching={stats.pitching} /></details>}<NpbTeamActivity key={team.teamId} services={services} teamId={team.teamId} /><div className="hub-links"><Link to="/NPB/compare">選手比較 →</Link><Link to="/NPB/my">お気に入り →</Link></div></>}
    <LifecycleLinks teamId={team.teamId} />
    <Link className="section-action" to={`/NPB/moves?team=${encodeURIComponent(team.teamId)}`}>この球団に関する選手の動き →</Link>
    <details className="team-roster"><summary>保存済み所属のみ表示</summary><p className="inline-note">保存済みの所属情報。現在の登録公示を示すものではありません。</p><div className="row-list">{sortTeamPlayers(currentTeamPlayers(catalog,null,team.teamId),"all","number").map(p=><Link className="player-row" key={p.id} to={`/NPB/players/${p.id}`}><span className="player-row__body"><strong>{favorites.some(f=>f.league==="NPB"&&f.kind==="player"&&f.entityId===p.id)&&"★ "}{p.name}</strong>{p.position&&<small>{positionDefinitions[p.position as keyof typeof positionDefinitions]}</small>}</span><span aria-hidden="true">›</span></Link>)}</div></details>
  </div>;
}
