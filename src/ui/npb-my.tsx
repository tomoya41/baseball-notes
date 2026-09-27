import { useEffect,useState } from "react";
import { Link } from "react-router-dom";
import type { Favorite } from "../domain/models";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";
import { positionDefinitions } from "../domain/baseball-terms";
import { DataState,FavoriteButton,LoadingSkeleton,PageHeading } from "./components";
type Target=Pick<Favorite,"entityId"|"kind"|"league">;
export function NpbSavedPlayers({repository,favorites,toggle,saving,compact=false}:{repository:{findLatestNpb():Promise<NpbPlayerDirectory>};
  favorites:Favorite[];toggle:(t:Target)=>void;saving:boolean;compact?:boolean}){
  const [directory,setDirectory]=useState<NpbPlayerDirectory|null>(null),[error,setError]=useState(false);
  useEffect(()=>{let active=true;void repository.findLatestNpb().then(v=>{if(active)setDirectory(v);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[repository]);
  const ids=[...new Set(favorites.filter(f=>f.league==="NPB"&&f.kind==="player").map(f=>f.entityId))];
  const players=ids.map(id=>directory?.players.find(p=>p.playerId===id));const visible=compact?players.slice(0,2):players;
  return <>{!compact&&<PageHeading eyebrow="NPB / My" title="お気に入り選手" detail="この端末に保存しています"/>}
    {error?<DataState kind="source-unavailable" title="お気に入り選手の情報を読み込めません"/>:!directory?<LoadingSkeleton/>:
      !ids.length?<DataState kind="no-data" title="お気に入りはまだありません" action="選手を探す" to="/NPB/search"/>:
        <div className="row-list">{visible.map((p,i)=><div className="surface-favorite" key={ids[i]}>
          {p?<Link className="player-row" to={`/NPB/players/${encodeURIComponent(p.playerId)}`}><span className="player-row__body"><strong>{p.displayName}</strong>
            <small>{directory.teams.find(t=>t.id===p.teamId)?.shortName??"所属球団未登録"}{p.position?` · ${positionDefinitions[p.position]}`:""}</small></span></Link>:
            <span>選手情報を確認できません</span>}
          <FavoriteButton active saving={saving} label={p?.displayName??"登録済み選手"} onClick={()=>toggle({kind:"player",league:"NPB",entityId:ids[i]!})}/>
        </div>)}</div>}
  </>;
}
