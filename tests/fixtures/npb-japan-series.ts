import { seriesFixture } from "./npb-series";
import { buildWikipediaNpbSeries } from "../../src/infrastructure/providers/wikipedia-npb-series";
export function japanFixture(){
  const f=seriesFixture(),cs=buildWikipediaNpbSeries(f.archive,f.cs,"a".repeat(64));
  const make=(pageid:number,title:string,content:string)=>({pageid,title,revisions:[{revid:pageid+100,timestamp:"2026-10-19T00:00:00Z",slots:{main:{content}}}]});
  const article="{{2026年の日本シリーズ}}\n[[横浜DeNAベイスターズ]]対[[福岡ソフトバンクホークス]]。4勝先取。\n{{Linescore\n|RR=0|HR=0|Note2=開始：時分 試合時間：時間分}}";
  const schedule=['{|class="wikitable"','|+試合日程','!日付||試合||ビジター||スコア||ホーム||球場',...[[10,24],[10,25],[10,27],[10,28],[10,29],[10,31],[11,1]].flatMap(([m,d],i)=>['|-',`|${m}月${d}日（土）||第${i+1}戦||${i<2||i>4?"福岡ソフトバンクホークス":"横浜DeNAベイスターズ"}|| - ||${i<2||i>4?"横浜DeNAベイスターズ":"福岡ソフトバンクホークス"}${[0,2,5].includes(i)?`||rowspan="${i===2?3:2}"|${i===2?"[[福岡ドーム|みずほPayPayドーム福岡]]":"[[横浜スタジアム]]"}`:""}`]),'|-','!colspan="6"|優勝：','|}'].join('\n');
  return {cs,archive:{observedAt:"2026-10-20T10:00:00Z",response:{query:{pages:[make(5306035,"2026年の日本シリーズ",article),make(5307595,"Template:2026年の日本シリーズ",schedule)]}}}};
}
