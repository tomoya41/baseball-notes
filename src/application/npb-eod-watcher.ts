import type { NpbGame } from "../data/npb-nf3";

export const EOD_TIMEZONE = "Asia/Tokyo";
export function monitorAfter(game: Pick<NpbGame,"date"|"scheduledTime">, offsetMinutes=120): Date | null {
  if(!Number.isInteger(offsetMinutes)||offsetMinutes<0||offsetMinutes>1440)throw Error("Invalid monitoring offset");
  if(!game.scheduledTime||!/^\d{1,2}:\d{2}$/.test(game.scheduledTime))return null;
  const [h,m]=game.scheduledTime.split(":").map(Number);
  if(h!>23||m!>59)return null;
  return new Date(Date.parse(`${game.date}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00+09:00`)+offsetMinutes*60_000);
}
export const isTerminalGame = (game:NpbGame)=>["final","postponed","canceled"].includes(game.status);
export interface EodWatcherPort {
  games(): Promise<NpbGame[]>;
  scheduleConfirmed(): Promise<boolean>;
  published(): Promise<boolean>;
  // Validates CURRENT Facts, not just the saved completeness marker.
  complete(game:NpbGame): Promise<boolean>;
  checkStatus(games:readonly NpbGame[]): Promise<NpbGame[]>;
  canCollect?(game:NpbGame):Promise<boolean>;
  collect(game:NpbGame): Promise<boolean>;
  finalize(games:readonly NpbGame[]): Promise<boolean>;
}
export async function watchNpbEod(port:EodWatcherPort,now:Date,offsetMinutes=120) {
  const started=performance.now();
  const report={mode:"no-op",reason:"",scheduledGames:0,monitoredGames:0,terminalGames:0,
    newFinalGames:0,fullCollectionGames:0,failedCollectionGames:0,deferredFinalGames:0,publishRequired:false,publishPerformed:false,elapsedMs:0};
  const end=(reason:string)=>({...report,reason,elapsedMs:performance.now()-started});
  if(!await port.scheduleConfirmed())return end("schedule_not_confirmed");
  const games=await port.games();report.scheduledGames=games.length;
  if(await port.published())return end("already_published");
  if(!games.length)return end("confirmed_no_games");
  const completed=new Set<string>();
  for(const game of games.filter(g=>g.status==="final"))if(await port.complete(game))completed.add(game.id);
  const due=games.filter(g=>!completed.has(g.id)&&!["postponed","canceled"].includes(g.status)&&
    (g.status==="final" || (monitorAfter(g,offsetMinutes)?.getTime()??Infinity)<=now.getTime()));
  const allAlreadyTerminal=games.every(g=>isTerminalGame(g)&&(g.status!=="final"||completed.has(g.id)));
  if(!due.length&&!allAlreadyTerminal)return end("before_monitor_after_or_start_unknown");
  report.mode="active";report.monitoredGames=due.length;
  const checked=due.length?await port.checkStatus(due):[];
  // Source failure/omission/duplicate cannot erase a scheduled Game.
  if(checked.length!==due.length||new Set(checked.map(g=>g.id)).size!==due.length||
    due.some(g=>!checked.some(n=>n.id===g.id&&n.homeTeamId===g.homeTeamId&&n.awayTeamId===g.awayTeamId)))
    throw Error("Incomplete status confirmation");
  const current=games.map(g=>checked.find(n=>n.id===g.id)??g);
  for(const game of checked.filter(g=>g.status==="final"&&!completed.has(g.id))) {
    if(games.find(g=>g.id===game.id)?.status!=="final")report.newFinalGames++;
    if(port.canCollect&&!await port.canCollect(game)){report.deferredFinalGames++;continue;}
    report.fullCollectionGames++;
    try {if(await port.collect(game))completed.add(game.id);else report.failedCollectionGames++;}
    catch {report.failedCollectionGames++;} // Other completed Games remain usable; never publish this partial Day.
  }
  report.terminalGames=current.filter(isTerminalGame).length;
  if(current.every(g=>isTerminalGame(g)&&(g.status!=="final"||completed.has(g.id))))
    report.publishRequired=await port.finalize(current);
  return end(report.publishRequired?"newly_complete_day":"awaiting_terminal_or_valid_facts");
}
