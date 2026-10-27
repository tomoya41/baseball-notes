import {useEffect,useState} from "react";
import {contextReader} from "../application/baseball-context-reader";
import type {InningScore} from "../domain/inning-score";
import {InningScoreboard,type ScoreboardTeam} from "./inning-scoreboard";
type Props={gameId:string;league:"NPB"|"MLB";date:string;competition:"regular"|"postseason";away:ScoreboardTeam&{id:string};home:ScoreboardTeam&{id:string}};
/** Supplemental linescores never replace or disagree with the admitted Game. */
export function ContextScoreboard({gameId,league,date,competition,away,home}:Props){
 const[data,setData]=useState<InningScore|null>(null),[sources,setSources]=useState<{url:string;name:string;license:string}[]>([]);
 useEffect(()=>{let active=true;void contextReader.scoreboards(league,date,competition).then(page=>{const g=page?.games.find(g=>g.gameId===gameId&&g.league===league&&g.date===date&&g.competition===competition&&g.away.id===away.id&&g.home.id===home.id&&g.away.runs===away.runs&&g.home.runs===home.runs);if(active&&g){setData(g);setSources(page!.sources.filter(s=>s.id===g.sourceId));}}).catch(()=>{});return()=>{active=false;};},[gameId,league,date,competition,away.id,away.runs,home.id,home.runs]);
 const valid=data?.gameId===gameId&&data.league===league&&data.competition===competition&&data.date===date&&data.away.id===away.id&&data.home.id===home.id&&data.away.runs===away.runs&&data.home.runs===home.runs?data:null;
 return <><InningScoreboard {...(valid?{completedInnings:Math.max(valid.away.innings.length,valid.home.innings.length)}:{})} away={{...away,...(valid?valid.away:{})}} home={{...home,...(valid?valid.home:{})}}/>{valid&&<details className="inline-note"><summary>イニング得点の出典</summary>{sources.map(s=><p key={s.url}><a href={s.url}>{s.name}</a> · {s.license}</p>)}{league==="MLB"?<p>The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at <a href="https://www.retrosheet.org/">www.retrosheet.org</a>.</p>:<p><a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · 原記事からの変更：イニング得点・安打・失策の抜粋。</p>}</details>}</>;
}
