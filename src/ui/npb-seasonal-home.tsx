import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { npbSeasonalHome } from "../domain/npb-seasonal-home";

export function NpbSeasonalHome(){
  const [params,setParams]=useSearchParams(),[now,setNow]=useState(Date.now);
  useEffect(()=>{const tick=()=>setNow(Date.now());window.addEventListener("focus",tick);const timer=window.setInterval(tick,60000);return()=>{window.removeEventListener("focus",tick);window.clearInterval(timer);};},[]);
  const context=npbSeasonalHome(now,params.get("homeSeason"));
  const labels: Record<string,string> = {
    "/NPB/cs?season=2026":"クライマックスシリーズ",
    "/NPB/talent/2026?view=results&forecast=final":"ドラフト結果",
    "/NPB/postseason?stage=japan_series&season=2026":"日本シリーズ",
  };
  return <section className={`seasonal-feature seasonal-feature--${context.mode}`} aria-label="季節に合わせた野球の楽しみ方"><div className="seasonal-feature-heading"><span className="eyebrow">今の見どころ</span><span>{context.mode==="autumn" ? "2026" : context.date.slice(0,4)}</span></div>
    <div className="seasonal-stories">{context.links.map((link,index)=><Link key={link.to} to={link.to} className={index===0?"seasonal-story--lead":""}><span><strong>{labels[link.to]??link.label}</strong>{index===0&&<small>{context.mode==="autumn"?"試合結果・選手成績 · 一部収録":context.title}</small>}</span><ChevronRight size={20} aria-hidden="true" /></Link>)}</div>
    <details className="source-note"><summary>収録範囲・季節を変更</summary><p>{context.description}</p><label>楽しみ方<select value={context.manual?context.mode:"auto"} onChange={e=>setParams(previous=>{const next=new URLSearchParams(previous);if(e.target.value==="auto")next.delete("homeSeason");else next.set("homeSeason",e.target.value);return next;})}><option value="auto">季節に合わせる</option><option value="spring">春・開幕前</option><option value="regular">公式戦の時期</option><option value="autumn">秋・CSとドラフト</option><option value="winter">冬・選手の歩み</option></select></label><p>{context.unavailable}</p><p className="inline-note">{context.date}（日本時間）の暦を使った案内です。実際の開催状況・公式日程・データ更新の証拠ではありません。</p><Link to="/NPB/moves">契約・移籍・引退の記事記載 →</Link></details>
  </section>;
}
