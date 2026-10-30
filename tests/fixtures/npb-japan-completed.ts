import { createHash } from "node:crypto";
import { japanFixture } from "./npb-japan-series";
import { japanGameId, buildWikipediaJapanSeries } from "../../src/infrastructure/providers/wikipedia-npb-japan-series";

/** Synthetic compact championship table; never a production source. */
export function japanCompletedFixture(compact = true, finals = 4) {
  const f=japanFixture(), pages=f.archive.response.query.pages;
  const blocks=Array.from({length:finals},(_,i)=>{
    const away=i<2?1:i===3?2:0,home=i<2?0:i===3?4:1;
    const runs=(p:string)=>Array.from({length:9},(_,n)=>`|${p}${n+1}=${p==="H"&&i>=2&&n===8?"X":p==="H"&&i===3?(n===3?3:n===5?1:0):n===0?(p==="R"?away:home):0}`).join("");
    return `{{Linescore\n|Date=10月${[24,25,27,28][i]}日\n|Road=${i<2?"ソフトバンク":"DeNA"}\n|Home=${i<2?"DeNA":"ソフトバンク"}\n${runs("R")}\n${runs("H")}\n|RR=${away}|HR=${home}\n|WP=架空投手\n|Note2=試合時間：2時間33分\n}}`;
  });
  pages[0]!.revisions[0]!.slots.main.content+="\n"+blocks.join("\n");
  let table=pages[1]!.revisions[0]!.slots.main.content;
  for(let i=0;i<finals;i++)table=table.replace("|| - ||",`|| ${i<2?"1 - 0":i===3?"2 - 4":"0 - 1"} ||`);
  if(compact)table=table.split("\n|-\n").slice(0,5).join("\n|-\n").replace('rowspan="3"','rowspan="2"')+'\n|-\n!colspan="6"|優勝：福岡ソフトバンクホークス（2年連続13回目）\n|}';
  pages[1]!.revisions[0]!.slots.main.content=table;
  f.archive.observedAt="2026-10-31T00:00:00Z";
  for(const p of pages){p.revisions[0]!.revid+=compact?2:1;p.revisions[0]!.timestamp="2026-10-30T12:00:00Z";}
  const refresh=()=>{for(const p of pages){const v=p.revisions[0]!,a=f.admission.find(s=>s.pageId===p.pageid)!;a.revision=v.revid;a.revisionAt=v.timestamp;a.contentSha256=createHash("sha256").update(v.slots.main.content).digest("hex");}};
  refresh();
  const review={reviewedBy:"synthetic fixture",reviewedAt:"2026-10-31T00:01:00Z",games:blocks.map((linescore,i)=>({gameId:japanGameId(i+1),linescore}))};
  const build=()=>buildWikipediaJapanSeries(f.archive,f.cs,"b".repeat(64),f.admission,review,Date.parse("2026-10-31T00:02:00Z"));
  return {...f,review,build,refresh};
}
