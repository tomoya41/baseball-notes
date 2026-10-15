import { useEffect,useState } from "react";
import { Link } from "react-router-dom";
import type { Favorite } from "../domain/models";
import type { NpbPlayerDirectory } from "../domain/npb-player-directory";
import { positionDefinitions } from "../domain/baseball-terms";
import { DataState,FavoriteButton,LoadingSkeleton,PageHeading } from "./components";
import { Monogram } from "./design-system";
import { historicalOnlyPlayers, historicalPlayerRoute } from "../data/npb-historical-identity-index";
type Target=Pick<Favorite,"entityId"|"kind"|"league">;
export function NpbSavedPlayers({repository,favorites,toggle,saving,compact=false,heading=true}:{repository:{findLatestNpb():Promise<NpbPlayerDirectory>};
  favorites:Favorite[];toggle:(t:Target)=>void;saving:boolean;compact?:boolean;heading?:boolean}){
  const [directory,setDirectory]=useState<NpbPlayerDirectory|null>(null),[error,setError]=useState(false);
  useEffect(()=>{let active=true;void repository.findLatestNpb().then(v=>{if(active)setDirectory(v);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[repository]);
  const ids=[...new Set(favorites.filter(f=>f.league==="NPB"&&f.kind==="player").map(f=>f.entityId))];
  const visible=compact?ids.slice(0,2):ids;
  return <>{!compact&&(heading?<PageHeading eyebrow="NPB / My" title="お気に入り選手" detail="この端末に保存しています"/>:<h2>お気に入り選手</h2>)}
    {!ids.length?<DataState kind="no-data" title="お気に入りはまだありません" action="選手を探す" to="/NPB/search"/>:
      <div className="row-list">{visible.map(id=>{const p=directory?.players.find(p=>p.playerId===id),historical=historicalOnlyPlayers.get(id);return <div className="surface-favorite" key={id}>
          {historical?<Link className="player-row" to={historicalPlayerRoute(id)}><span className="player-row__body"><strong>{historical.article}</strong><small>過去年度の成績 · 所属は年度別に表示</small></span></Link>:p?<Link className="player-row" to={`/NPB/players/${encodeURIComponent(p.playerId)}`}><Monogram name={p.displayName} /><span className="player-row__body"><strong>{p.displayName}</strong>
            <small>{directory?.teams.find(t=>t.id===p.teamId)?.shortName??"所属球団未登録"}{p.position?` · ${positionDefinitions[p.position]}`:""}</small></span></Link>:
            !directory&&!error?<LoadingSkeleton/>:<span>{error?"選手情報を読み込めません。保存したお気に入りは保持しています。":"選手情報を確認できません"}</span>}
          <FavoriteButton active saving={saving} label={p?.displayName??historical?.article??"登録済み選手"} onClick={()=>toggle({kind:"player",league:"NPB",entityId:id})}/>
        </div>;})}</div>}
  </>;
}
