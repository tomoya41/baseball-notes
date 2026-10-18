import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { npbSeasonalHome } from "../domain/npb-seasonal-home";

export function NpbSeasonalHome(){
  const [params,setParams]=useSearchParams(),[now,setNow]=useState(Date.now);
  useEffect(()=>{const tick=()=>setNow(Date.now());window.addEventListener("focus",tick);const timer=window.setInterval(tick,60000);return()=>{window.removeEventListener("focus",tick);window.clearInterval(timer);};},[]);
  const context=npbSeasonalHome(now,params.get("homeSeason"));
  return <section className="home-section" aria-label="季節に合わせた野球の楽しみ方"><p className="eyebrow">季節の楽しみ方</p><h2>{context.title}</h2><p>{context.description}</p>
    <div className="discovery-paths">{context.links.map(link=><Link key={link.to} to={link.to}><strong>{link.label}</strong><span aria-hidden="true">→</span></Link>)}</div>
    <Link className="section-action" to="/NPB/moves">契約・トレード・引退発表の記事記載 →</Link>
    <details className="source-note"><summary>季節の切り替え・収録状況</summary><label>楽しみ方<select value={context.manual?context.mode:"auto"} onChange={e=>setParams(previous=>{const next=new URLSearchParams(previous);if(e.target.value==="auto")next.delete("homeSeason");else next.set("homeSeason",e.target.value);return next;})}><option value="auto">季節に合わせる</option><option value="spring">春・開幕前</option><option value="regular">公式戦の時期</option><option value="autumn">秋・CSとドラフト</option><option value="winter">冬・選手の歩み</option></select></label><p>{context.unavailable}</p><p className="inline-note">{context.date}（日本時間）の暦を使った案内です。実際の開催状況・公式日程・データ更新の証拠ではありません。</p></details>
  </section>;
}
