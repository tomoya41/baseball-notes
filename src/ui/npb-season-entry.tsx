import { Link,useLocation,useSearchParams } from "react-router-dom";
import { npbSeasonChoices,npbSeasonEntry,savedNpbSnapshotRoute } from "../domain/npb-season-entry";
import { PageHeading,DataState } from "./components";

export function NpbSeasonEntry() {
  const location=useLocation(),[params,setParams]=useSearchParams(),season=Number(params.get("season")??2027),entry=npbSeasonEntry(season);
  return <div className="screen"><PageHeading eyebrow="NPB" title={`${Number.isSafeInteger(season)?season:"未指定"}年シーズン`}/>
    <label className="weekly-stage">年度 <select aria-label="年度" value={npbSeasonChoices.some(y=>y===season)?season:""} onChange={e=>{const next=new URLSearchParams(params);next.set("season",e.target.value);for(const key of ["date","week","month","asOfDate"])next.delete(key);setParams(next);}}>{!npbSeasonChoices.some(y=>y===season)&&<option value="">未対応年度</option>}{npbSeasonChoices.map(y=><option key={y} value={y}>{y}年</option>)}</select></label>
    {entry.status==="awaiting_verified_dataset"&&<section className="weekly-section" aria-labelledby="npb-official-schedule">
      <h2 id="npb-official-schedule">2027年の日程発表</h2>
      <p>公式発表済み。セ・パ公式戦は2027年3月26日開幕予定です。</p>
      <p>セ・リーグ公式戦と交流戦の日程は2026年11月4日発表。最新の日程・開始時刻は公式サイトで確認できます。</p>
      <div className="hub-links">
        <a href="https://npb.jp/games/2027/" target="_blank" rel="noopener noreferrer">2027年の公式日程 ↗</a>
        <a href="https://npb.jp/news/detail/20261104_03.html" target="_blank" rel="noopener noreferrer">セ・リーグの発表 ↗</a>
        <a href="https://npb.jp/news/detail/20261104_02.html" target="_blank" rel="noopener noreferrer">交流戦の発表 ↗</a>
      </div>
    </section>}
    {entry.status==="saved_snapshot"?<><p>2026年の保存済みデータ</p><div className="hub-links"><Link to="/NPB/home?season=2026">ホーム</Link><Link to="/NPB/schedule?season=2026">試合結果</Link><Link to="/NPB/postseason?season=2026">CS・日本シリーズ</Link></div></>:<><DataState kind="no-data" title={entry.status==="unsupported"?"この年度は未対応です":"2027年のデータは未収録です"} detail={entry.status==="unsupported"?"":"アプリに日程は未登録です。試合結果・選手成績も未取得です。"}/>
      <div className="hub-links"><Link to={location.pathname==="/NPB/season"?"/NPB/home?season=2026":savedNpbSnapshotRoute(location.pathname,params)}>2026年の保存データを見る →</Link><Link to="/NPB/history">過去年度の選手成績 →</Link></div></>}
    <section className="weekly-section"><h2>オフシーズンを追う</h2><div className="hub-links"><Link to="/NPB/talent/2026?view=results">2026年ドラフト</Link><Link to="/NPB/moves">出典付きの選手の動き</Link><Link to="/NPB/my">フォロー中の選手・球団</Link></div></section>
  </div>;
}
