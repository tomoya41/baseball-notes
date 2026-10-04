import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { searchNpbPlayers, type NpbPlayerDirectory } from "../domain/npb-player-directory";
import { positionDefinitions } from "../domain/baseball-terms";
import type { Favorite } from "../domain/models";
import { DataState, FavoriteButton, LoadingSkeleton, PageHeading } from "./components";
import { DiscoveryNavigation } from "./discovery";
import { Monogram } from "./design-system";

type SearchState = "loading" | "ready" | "error";
type Role = "all" | "batter" | "pitcher";
type DirectoryReader = { findLatestNpb(): Promise<NpbPlayerDirectory> };

export function NpbPlayerSearchView({ directory, state, query, onQueryChange, teamId, onTeamChange,
  role, onRoleChange, favorites=[],toggle,saving=false }: { directory: NpbPlayerDirectory | null; state: SearchState;
  favorites?:Favorite[]|undefined;toggle?:((target:Pick<Favorite,"kind"|"entityId"|"league">)=>void)|undefined;saving?:boolean|undefined;
  query: string; onQueryChange: (value: string) => void; teamId: string; onTeamChange: (value: string) => void;
  role: Role; onRoleChange: (value: Role) => void }) {
  const players = useMemo(() => directory ? searchNpbPlayers(directory.players, query,
    { teamId, role }) : [], [directory, query, teamId, role]);
  const teams = useMemo(() => new Map(directory?.teams.map((team) => [team.id, team.shortName]) ?? []), [directory]);
  const [limit, setLimit] = useState(80);
  const filterKey = `${query}:${teamId}:${role}`;
  const [expandedKey, setExpandedKey] = useState(filterKey);
  const visibleLimit = expandedKey === filterKey ? limit : 80;
  return <div className="screen npb-player-search">
    <PageHeading eyebrow="NPB" title="選手" />
    <DiscoveryNavigation league="NPB" />
    <Link className="text-link" to="/NPB/compare">選手比較 →</Link>
    {state === "loading" && <LoadingSkeleton />}
    {state === "error" && <DataState kind="source-unavailable" title="選手一覧を取得できませんでした" />}
    {state === "ready" && directory && <>
      <label className="search-field"><Search size={20} aria-hidden="true" />
        <span className="sr-only">選手名を検索</span>
        <input type="search" placeholder="選手名を入力" value={query}
          onChange={(event) => onQueryChange(event.target.value)} />
      </label>
      <div className="npb-directory-filter">
        <label htmlFor="npb-directory-team">球団</label>
        <select id="npb-directory-team" value={teamId} onChange={(event) => onTeamChange(event.target.value)}>
          <option value="">すべての球団</option>
          {directory.teams.map((team) => <option key={team.id} value={team.id}>{team.shortName}</option>)}
        </select>
      </div>
      <div className="chip-list npb-directory-roles" role="group" aria-label="記録の種類">
        {([{ id: "all", label: "すべて" }, { id: "batter", label: "打撃データあり" },
          { id: "pitcher", label: "投球データあり" }] as const).map((item) =>
          <button key={item.id} type="button" className="filter-chip" aria-pressed={role === item.id}
            onClick={() => onRoleChange(item.id)}>{item.label}</button>)}
      </div>
      <div className="list-heading"><strong>{query || teamId || role !== "all" ? "検索結果" : "選手一覧"}</strong><span>{players.length}人</span></div>
      {players.length ? <div className="row-list">{players.slice(0, visibleLimit).map((player) =>
        <div className="surface-favorite" key={player.playerId}><Link className="player-row npb-directory-row"
          to={`/NPB/players/${encodeURIComponent(player.playerId)}`}>
          <Monogram name={player.displayName} />
          <span className="player-row__body"><strong>{player.displayName}</strong>
            <small>{player.teamId ? teams.get(player.teamId) : "所属球団未登録"}
              {player.position ? ` · ${positionDefinitions[player.position]}` : ""}
              {player.battingAvailable || player.pitchingAvailable ?
                ` · ${[player.battingAvailable && "打撃", player.pitchingAvailable && "投球"].filter(Boolean).join("・")}データあり` :
                " · 最近の成績なし"}</small>
          </span><ChevronRight className="row-chevron" size={19} aria-hidden="true" />
        </Link><Link className="compare-add" aria-label={`${player.displayName}を比較に追加`} to={`/NPB/compare?players=${encodeURIComponent(player.playerId)}&role=${player.pitchingAvailable && !player.battingAvailable ? "pitching" : "batting"}`}>比較</Link>{toggle&&<FavoriteButton active={favorites.some(f=>f.league==="NPB"&&f.kind==="player"&&f.entityId===player.playerId)}
          saving={saving} label={player.displayName} onClick={()=>toggle({kind:"player",league:"NPB",entityId:player.playerId})}/>}</div>)}</div> : <DataState kind="no-data" title="該当する選手が見つかりません" />}
      {players.length > visibleLimit && <button className="button button--secondary" onClick={() => { setExpandedKey(filterKey); setLimit(visibleLimit + 80); }}>さらに80人を表示</button>}
      <p className="npb-directory-note">保存済み選手情報から表示しています。守備位置が未登録の選手は表示を省略します。</p>
    </>}
  </div>;
}

export function NpbPlayerSearch({ repository,favorites,toggle,saving }: { repository: DirectoryReader;
  favorites?:Favorite[]|undefined;toggle?:((target:Pick<Favorite,"kind"|"entityId"|"league">)=>void)|undefined;saving?:boolean|undefined }) {
  const [directory, setDirectory] = useState<NpbPlayerDirectory | null>(null);
  const [state, setState] = useState<SearchState>("loading");
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "", teamId = params.get("team") ?? "";
  const role: Role = params.get("role") === "batter" ? "batter" : params.get("role") === "pitcher" ? "pitcher" : "all";
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  useEffect(() => {
    let active = true;
    void repository.findLatestNpb().then((value) => { if (active) { setDirectory(value); setState("ready"); } })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [repository]);
  return <NpbPlayerSearchView directory={directory} state={state} query={query} onQueryChange={value => update("q", value)}
    teamId={teamId} onTeamChange={value => update("team", value)} role={role} onRoleChange={value => update("role", value)} favorites={favorites} toggle={toggle} saving={saving} />;
}
