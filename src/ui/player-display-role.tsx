import { battingView } from "../domain/player-display-role";
import { useSearchParams } from "react-router-dom";

export function BattingViewControl() {
  const [params,setParams]=useSearchParams(),active=battingView(params);
  return <label className="batting-view-control">打撃の表示<select value={active} onChange={e=>{const next=new URLSearchParams(params);next.set("battingView",e.target.value);next.delete("page");setParams(next);}}><option value="standard">野手・DH</option><option value="pitchers">投手の打撃</option><option value="all">全選手の打撃</option></select></label>;
}
