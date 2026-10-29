import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { npbSeasonalHome } from "../domain/npb-seasonal-home";
import { EditorialCover } from "./editorial-cover";

export function NpbSeasonalHome({supporting=false}:{supporting?:boolean}){
  const [params,setParams]=useSearchParams(),[now,setNow]=useState(Date.now);
  useEffect(()=>{const tick=()=>setNow(Date.now());window.addEventListener("focus",tick);const timer=window.setInterval(tick,60000);return()=>{window.removeEventListener("focus",tick);window.clearInterval(timer);};},[]);
  const context=npbSeasonalHome(now,params.get("homeSeason"));
  const labels: Record<string,string> = {
    "/NPB/cs?season=2026":"クライマックスシリーズ",
    "/NPB/talent/2026?view=results&forecast=final":"ドラフト結果",
    "/NPB/postseason?stage=japan_series&season=2026":"日本シリーズ",
  };
  return <section className={`seasonal-feature seasonal-feature--${context.mode}${supporting?" seasonal-feature--supporting":""}`} aria-label="季節に合わせた野球の楽しみ方">
    <div className="seasonal-stories">{context.links.map((link,index)=>{
      const kind=link.to.includes("talent")?"draft":link.to.includes("postseason")||link.to.includes("/cs")?"postseason":"archive";
      const series=link.to.includes("japan_series"),draft=link.to.includes("/2026?");
      return <Link key={link.to} to={link.to} aria-label={link.label} className={index===0?"seasonal-story--lead":"seasonal-story--secondary"}>
        <EditorialCover level={2} compact={supporting||index>0} kind={kind} eyebrow={series?"JAPAN SERIES · 2026":draft?"DRAFT · 2026":context.mode==="autumn"?"POSTSEASON · 2026":"BASEBALL NOTES"} title={index>0&&link.to.includes("/cs?")?"CSの試合・成績":labels[link.to]??link.label}>
          {index===0&&!supporting&&<small>{series?"日程・試合詳細へ":draft?"指名結果と予想を見比べる":context.mode==="autumn"?"収録試合・選手成績へ":context.title}<span aria-hidden="true"> →</span></small>}
        </EditorialCover>
      </Link>;
    })}</div>
    <nav className="offseason-home-links" aria-label="オフシーズンの選手情報"><Link to="/NPB/moves">移籍・退団・引退 <span aria-hidden="true">→</span></Link><Link to="/NPB/moves?kind=contract_renewal">契約更改 <span aria-hidden="true">→</span></Link></nav>
    <details className="source-note seasonal-options"><summary>収録範囲・季節を変更</summary><p>{context.description}</p><label>楽しみ方<select value={context.manual?context.mode:"auto"} onChange={e=>setParams(previous=>{const next=new URLSearchParams(previous);if(e.target.value==="auto")next.delete("homeSeason");else next.set("homeSeason",e.target.value);return next;})}><option value="auto">季節に合わせる</option><option value="spring">春・開幕前</option><option value="regular">公式戦の時期</option><option value="autumn">秋・CSとドラフト</option><option value="winter">オフシーズン</option></select></label><p>{context.unavailable}</p><p className="inline-note">{context.date}（日本時間）の暦を使った案内です。実際の開催状況・公式日程・データ更新の証拠ではありません。</p><Link to="/NPB/moves">契約・移籍・引退の記事記載 →</Link></details>
  </section>;
}
