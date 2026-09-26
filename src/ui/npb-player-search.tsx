import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { searchNpbPlayers, type NpbPlayerDirectory } from "../domain/npb-player-directory";
import { positionDefinitions } from "../domain/baseball-terms";
import { DataState, LoadingSkeleton, PageHeading } from "./components";

type SearchState = "loading" | "ready" | "error";
type Role = "all" | "batter" | "pitcher";
type DirectoryReader = { findLatestNpb(): Promise<NpbPlayerDirectory> };

export function NpbPlayerSearchView({ directory, state, query, onQueryChange, teamId, onTeamChange,
  role, onRoleChange }: { directory: NpbPlayerDirectory | null; state: SearchState;
  query: string; onQueryChange: (value: string) => void; teamId: string; onTeamChange: (value: string) => void;
  role: Role; onRoleChange: (value: Role) => void }) {
  const players = useMemo(() => directory ? searchNpbPlayers(directory.players, query,
    { teamId, role }) : [], [directory, query, teamId, role]);
  const teams = useMemo(() => new Map(directory?.teams.map((team) => [team.id, team.shortName]) ?? []), [directory]);
  return <div className="screen npb-player-search">
    <PageHeading eyebrow="NPB / 選手" title="選手を探す" detail="球団や名前から選手を探せます" />
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
      {players.length ? <div className="row-list">{players.map((player) =>
        <Link className="player-row npb-directory-row" key={player.playerId}
          to={`/NPB/players/${encodeURIComponent(player.playerId)}`}>
          <span className="npb-directory-avatar" aria-hidden="true">{player.displayName.slice(0, 1)}</span>
          <span className="player-row__body"><strong>{player.displayName}</strong>
            <small>{player.teamId ? teams.get(player.teamId) : "所属球団未登録"}
              {player.position ? ` · ${positionDefinitions[player.position]}` : ""}
              {player.battingAvailable || player.pitchingAvailable ?
                ` · ${[player.battingAvailable && "打撃", player.pitchingAvailable && "投球"].filter(Boolean).join("・")}データあり` :
                " · 最近の成績なし"}</small>
          </span><ChevronRight className="row-chevron" size={19} aria-hidden="true" />
        </Link>)}</div> : <DataState kind="no-data" title="該当する選手が見つかりません" />}
      <p className="npb-directory-note">保存済み選手情報から表示しています。守備位置が未登録の選手は表示を省略します。</p>
    </>}
  </div>;
}

export function NpbPlayerSearch({ repository }: { repository: DirectoryReader }) {
  const [directory, setDirectory] = useState<NpbPlayerDirectory | null>(null);
  const [state, setState] = useState<SearchState>("loading");
  const [query, setQuery] = useState("");
  const [teamId, setTeamId] = useState("");
  const [role, setRole] = useState<Role>("all");
  useEffect(() => {
    let active = true;
    void repository.findLatestNpb().then((value) => { if (active) { setDirectory(value); setState("ready"); } })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [repository]);
  return <NpbPlayerSearchView directory={directory} state={state} query={query} onQueryChange={setQuery}
    teamId={teamId} onTeamChange={setTeamId} role={role} onRoleChange={setRole} />;
}
