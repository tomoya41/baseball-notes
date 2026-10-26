import { Link,useLocation,useSearchParams } from "react-router-dom";
import { npbSeasonChoices,npbSeasonEntry,savedNpbSnapshotRoute } from "../domain/npb-season-entry";
import { PageHeading,DataState } from "./components";

export function NpbSeasonEntry() {
  const location=useLocation(),[params,setParams]=useSearchParams(),season=Number(params.get("season")??2027),entry=npbSeasonEntry(season);
  return <div className="screen"><PageHeading eyebrow="NPB" title={`${Number.isSafeInteger(season)?season:"未指定"}年シーズン`}/>
    <label className="weekly-stage">年度 <select aria-label="年度" value={npbSeasonChoices.some(y=>y===season)?season:""} onChange={e=>{const next=new URLSearchParams(params);next.set("season",e.target.value);for(const key of ["date","week","month","asOfDate"])next.delete(key);setParams(next);}}>{!npbSeasonChoices.some(y=>y===season)&&<option value="">未対応年度</option>}{npbSeasonChoices.map(y=><option key={y} value={y}>{y}年</option>)}</select></label>
    {entry.status==="saved_snapshot"?<><p>2026年の保存済みデータ</p><div className="hub-links"><Link to="/NPB/home?season=2026">ホーム</Link><Link to="/NPB/schedule?season=2026">試合結果</Link><Link to="/NPB/postseason?season=2026">CS・日本シリーズ</Link></div></>:<><DataState kind="no-data" title={entry.status==="unsupported"?"この年度は未対応です":"2027年のデータは未収録です"} detail={entry.status==="unsupported"?"":"日程は未登録、試合結果・選手成績は未収録です。試合なし・成績0を意味しません。"}/>
      <div className="hub-links"><Link to={location.pathname==="/NPB/season"?"/NPB/home?season=2026":savedNpbSnapshotRoute(location.pathname,params)}>2026年の保存データを見る →</Link><Link to="/NPB/history">過去年度の選手成績 →</Link></div></>}
    <section className="weekly-section"><h2>オフシーズンを追う</h2><div className="hub-links"><Link to="/NPB/talent/2026?view=results">2026年ドラフト</Link><Link to="/NPB/moves">出典付きの選手の動き</Link><Link to="/NPB/my">フォロー中の選手・球団</Link></div></section>
  </div>;
}
