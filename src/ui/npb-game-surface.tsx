import { DailyMvp } from "./daily-mvp";
import { useEffect,useRef,useState } from "react";
import { Link,useSearchParams } from "react-router-dom";
import { z } from "zod";
import { readGameDateForManifest, type GameSurfaceReader } from "../application/game-surface";
import { type GameDateIndex,type GameManifest,type GameIndexRow } from "../domain/npb-game-index";
import { npbScheduleTeam } from "../domain/npb-game-navigation";
import { npbTeamShortName } from "../presentation/npb-team-names";
import { DataState,LoadingSkeleton,PageHeading } from "./components";
import { DateRibbon, ScoreboardRow } from "./design-system";
import { TeamFavorite, type FavoriteActions } from "./team-favorite";
import { InternationalGameEntry } from "./international-game-entry";
import { usePublicDataRevalidation } from "./use-public-data-revalidation";
import "./npb-experience.css";
const statusLabel={final:"試合終了",scheduled:"開始前",postponed:"延期",canceled:"中止",suspended:"中断",unknown:"状態未確認"};
const dateSchema = z.iso.date();
function outsideGameRange(date: string, manifest: GameManifest) {
  return !dateSchema.safeParse(date).success || date < manifest.from || date > manifest.to;
}
function gameDetailLabel(game: GameIndexRow): string {
  if (game.status !== "final") return "試合情報";
  if (!game.detailAvailable || !game.battingAvailable && !game.pitchingAvailable)
    return game.home.score === null && game.away.score === null ? "試合情報のみ収録" : "スコアのみ収録";
  return game.battingAvailable && game.pitchingAvailable && game.completeness === "complete" ? "出場選手・個人成績" : "個人成績は一部収録";
}
export function GameLinks({games,team}:{games:readonly GameIndexRow[];team?:string | undefined}){return <div className="scoreboard-list">{games.map(g=><ScoreboardRow key={g.gameId}
  to={`/NPB/games/${encodeURIComponent(g.gameId)}?${new URLSearchParams({date:g.date,...(team?{team}:{})})}`} away={g.away.name} home={g.home.name} awayId={g.away.id} homeId={g.home.id} awayScore={g.away.score} homeScore={g.home.score}
  date={g.date.slice(5).replace("-","/")} status={g.status === "scheduled" && g.scheduledTime ? `${g.scheduledTime} JST` : statusLabel[g.status]}
  gameNumber={g.gameNumber > 1 ? g.gameNumber : undefined} partial={g.status === "final" && g.completeness !== "complete"}
  detailLabel={gameDetailLabel(g)} />)}</div>;}
export function GameDateView({payload,team}:{payload:GameDateIndex;team?:string | undefined}){
  const games = team ? payload.games.filter(g => g.home.id === team || g.away.id === team) : payload.games;
  const failed = payload.coverage === "failed";
  const emptyTitle = payload.coverage === "no_games" ? "試合なし"
    : failed ? "この日の試合データを取得できませんでした"
    : team && payload.coverage === "complete" ? "この球団の収録試合はありません"
    : team ? "この球団の試合を確認できていません" : "この日の試合を確認できていません";
  return <>
  {games.length > 0 && (payload.coverage === "partial" || failed) && <p role="status">
    {failed ? "一部データを取得できなかったため、保存済みの試合を表示します。" : "この日の試合データは一部収録です。"}
  </p>}
  {games.length ? <GameLinks games={games} team={team}/>
    : <DataState kind={failed ? "source-unavailable" : "no-data"} title={emptyTitle}/>}
  {!team&&<DailyMvp key={payload.date} date={payload.date} index={payload}/>}
</>;}
export function NpbScheduleScreen({repository,favorites=[],toggle,saving=false}:{repository:GameSurfaceReader;favorites?:FavoriteActions["favorites"];toggle?:FavoriteActions["toggle"];saving?:boolean}){
  const [params,setParams]=useSearchParams(),dateParam=params.get("date");
  const team = npbScheduleTeam(params);
  const unfiltered = new URLSearchParams(params);
  unfiltered.delete("team");
  const [snapshot, setSnapshot] = useState<{ manifest: GameManifest; day: GameDateIndex | null } | null>(null);
  const [failure, setFailure] = useState<{ selection: string | null } | null>(null);
  const [attempt,setAttempt]=useState(0),[internationalOpen,setInternationalOpen]=useState(params.get("view")==="international");
  const revision = usePublicDataRevalidation();
  const manifestRequest = useRef<{
    repository: GameSurfaceReader; attempt: number; revision: number;
    value: Promise<{ manifest: GameManifest; remember: (() => Promise<void>) | undefined }>;
  } | null>(null);
  const manifest = snapshot?.manifest;
  const date = dateParam ?? manifest?.effectiveDate;
  const payload = snapshot?.day && snapshot.day.date === date ? snapshot.day : null;
  const outsideRange = Boolean(manifest && date !== undefined && outsideGameRange(date, manifest));
  const failed = failure?.selection === dateParam;
  useEffect(() => {
    let active = true;
    void (async () => {
      let nextManifest: GameManifest | undefined;
      try {
        let request = manifestRequest.current;
        if (!request || request.repository !== repository || request.attempt !== attempt || request.revision !== revision) {
          let remember: (() => Promise<void>) | undefined;
          const value = repository.manifest(save => { remember = save; }).then(manifest => ({ manifest, remember }));
          request = { repository, attempt, revision, value };
          manifestRequest.current = request;
        }
        const staged = await request.value;
        nextManifest = staged.manifest;
        if (!active) return;
        const selectedDate = dateParam ?? nextManifest.effectiveDate;
        let rememberDay: (() => Promise<void>) | undefined;
        const day = outsideGameRange(selectedDate, nextManifest) ? null
          : await readGameDateForManifest(repository, nextManifest, selectedDate, save => { rememberDay = save; });
        if (!active) return;
        if (day) await Promise.all([staged.remember?.(), rememberDay?.()]);
        if (active) {
          setSnapshot({ manifest: nextManifest, day });
          setFailure(null);
        }
      } catch {
        if (!active) return;
        if (nextManifest) {
          const available = nextManifest;
          setSnapshot(previous => previous ?? { manifest: available, day: null });
        }
        setFailure({ selection: dateParam });
      }
    })();
    return () => { active = false; };
  }, [attempt, dateParam, repository, revision]);
  const change=(next:string)=>{if(next===date)return;setParams(previous=>{const nextParams=new URLSearchParams(previous);nextParams.set("date",next);return nextParams;});};
  const retry=()=>setAttempt(value=>value+1);
  return <div className="screen game-schedule"><PageHeading eyebrow="NPB" title="日程・結果"/>
    <nav className="game-competition-nav" aria-label="試合の種類">
      <Link to="/NPB/schedule" aria-current="page">公式戦</Link>
      <Link to="/NPB/postseason">ポストシーズン</Link>
      <button type="button" aria-controls="international-game-entry" aria-expanded={internationalOpen}
        onClick={() => setInternationalOpen(open => !open)}>侍ジャパン</button>
    </nav>
    <InternationalGameEntry expanded={internationalOpen} onToggle={setInternationalOpen}/>
    <p className="game-collection-scope">{manifest ? `${manifest.effectiveDate}までの保存済みデータ` : "保存済みの公式戦を確認"}<Link to="/NPB/preseason">オープン戦 · 未収録</Link></p>
    {manifest&&date&&!outsideRange&&<DateRibbon date={date} min={manifest.from} max={manifest.to} onChange={change} />}
    {team&&<div className="game-collection-scope"><strong>{npbTeamShortName(team)}の試合</strong><Link to={`/NPB/schedule${unfiltered.size?`?${unfiltered}`:""}`}>すべての球団を表示</Link></div>}
    {outsideRange&&manifest?<><DataState kind="unsupported" title="指定日の試合は収録範囲外です"/><button className="button button--secondary" onClick={()=>change(manifest.effectiveDate)}>保存済みの日付へ</button></>:
      failed?<>{payload?<p className="inline-note" role="status">更新を確認できないため、保存済みの日程を表示しています。</p>:<DataState kind="source-unavailable" title="日程を読み込めません"/>}<button className="button button--secondary" onClick={retry}>日程を再読み込み</button></>:
      !payload&&<LoadingSkeleton/>}
    {payload&&<GameDateView payload={payload} team={team}/>}
    {!team&&payload&&toggle&&<details><summary>この日の球団をフォロー</summary><div className="row-list">{[...new Map(payload.games.flatMap(g=>[g.away,g.home]).map(t=>[t.id,t])).values()].map(t=><div className="surface-favorite" key={t.id}><Link className="player-row" to={`/NPB/teams/${encodeURIComponent(t.id)}`}>{t.name}</Link><TeamFavorite league="NPB" teamId={t.id} name={t.name} favorites={favorites} toggle={toggle} saving={saving}/></div>)}</div></details>}
  </div>;
}
