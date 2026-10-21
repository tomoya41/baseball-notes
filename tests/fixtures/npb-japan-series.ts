import { seriesFixture } from "./npb-series";
import { buildWikipediaNpbSeries } from "../../src/infrastructure/providers/wikipedia-npb-series";
import { createHash } from "node:crypto";
export function japanFixture(){
  const f=seriesFixture(),cs=buildWikipediaNpbSeries(f.archive,f.cs,"a".repeat(64));
  const make=(pageid:number,title:string,content:string)=>({pageid,title,revisions:[{revid:pageid+100,timestamp:"2026-10-19T00:00:00Z",slots:{main:{content}}}]});
  const article="{{2026年の日本シリーズ}}\n[[横浜DeNAベイスターズ]]対[[福岡ソフトバンクホークス]]。4勝先取。\n{{Linescore\n|RR=0|HR=0|Note2=開始：時分 試合時間：時間分}}";
  const schedule=['{|class="wikitable"','|+試合日程','!日付||試合||ビジター||スコア||ホーム||球場',...[[10,24],[10,25],[10,27],[10,28],[10,29],[10,31],[11,1]].flatMap(([m,d],i)=>['|-',`|${m}月${d}日（土）||第${i+1}戦||${i<2||i>4?"福岡ソフトバンクホークス":"横浜DeNAベイスターズ"}|| - ||${i<2||i>4?"横浜DeNAベイスターズ":"福岡ソフトバンクホークス"}${[0,2,5].includes(i)?`||rowspan="${i===2?3:2}"|${i===2?"[[福岡ドーム|みずほPayPayドーム福岡]]":"[[横浜スタジアム]]"}`:""}`]),'|-','!colspan="6"|優勝：','|}'].join('\n');
  const pages=[make(5306035,"2026年の日本シリーズ",article),make(5307595,"Template:2026年の日本シリーズ",schedule)];
  const admission=pages.map(p=>({pageId:p.pageid,title:p.title,revision:p.revisions[0]!.revid,revisionAt:p.revisions[0]!.timestamp,contentSha256:createHash("sha256").update(p.revisions[0]!.slots.main.content).digest("hex")}));
  return {cs,admission,archive:{observedAt:"2026-10-20T10:00:00Z",response:{query:{pages}}}};
}

/** Synthetic result/source text only; never published as a real Game. */
export function japanResultFixture(homeLast="X",homeRuns=1,awayRuns=0,innings=9){
  const f=japanFixture(),pages=f.archive.response.query.pages;
  const cells=(prefix:string)=>Array.from({length:innings},(_,i)=>`|${prefix}${i+1}=${prefix==="H"&&i===innings-1?homeLast:i===0?prefix==="H"?homeRuns:awayRuns:0}`).join("");
  const block=`{{Linescore\n|Date=10月24日\n|Road=ソフトバンク\n|Home=DeNA\n${cells("R")}\n${cells("H")}\n|RR=${awayRuns}|HR=${homeRuns}\n|WP=架空投手\n|Note2=試合時間：3時間12分\n}}`;
  pages[0]!.revisions[0]!.slots.main.content+="\n"+block;
  pages[1]!.revisions[0]!.slots.main.content=pages[1]!.revisions[0]!.slots.main.content.replace("|| - ||",`|| ${awayRuns} - ${homeRuns} ||`);
  f.archive.observedAt="2026-10-25T00:00:00Z";
  for(const p of pages)f.admission.find(a=>a.pageId===p.pageid)!.contentSha256=createHash("sha256").update(p.revisions[0]!.slots.main.content).digest("hex");
  return {...f,block,now:Date.parse("2026-10-25T00:02:00Z"),review:{reviewedBy:"synthetic fixture",reviewedAt:"2026-10-25T00:01:00Z",games:[{gameId:"npb:game:9f6c547e7852f6c5a928",linescore:block}]}};
}
