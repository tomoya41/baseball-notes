import { parseNf3PitchingLogs, npbTeams, type NpbGame } from "./npb-nf3";
import { nf3ProfileParameter, parseNf3PitchingRoster, type Nf3Participant } from "./npb-game-source";

// nf3's published 全表示/全投球成績 routes, cached for this backfill only.
// Daily's rolling two-week discovery remains independent.
export function createHistoricalPitcherDiscovery(request: (url: string) => Promise<string>, onParse?: (ms:number)=>void) {
  const teams = new Map<string, Promise<{ participant:Nf3Participant; dates:Set<string> }[]>>();
  return async (game: NpbGame, teamId: string): Promise<Nf3Participant[]> => {
    const team = npbTeams.find(t=>t.id===teamId);
    if (!team) throw new Error("Unknown historical canonical team");
    if (!teams.has(teamId)) teams.set(teamId,(async()=>{
      const leg=team.group==="Central"?0:1;
      const rosterUrl=`https://nf3.sakura.ne.jp/php/stat_disp/stat_disp.php?y=0&leg=${leg}&tm=${team.code}&fp=1&dn=1&dk=0`;
      const rosterHtml=await request(rosterUrl),rosterStart=performance.now();
      const roster=parseNf3PitchingRoster(rosterHtml,team.code);
      onParse?.(performance.now()-rosterStart);
      const result: {participant:Nf3Participant;dates:Set<string>}[]=[];
      for (const participant of roster) {
        const number=nf3ProfileParameter(participant.profileUrl,team.code,participant.number);
        const url=`https://nf3.sakura.ne.jp/php/stat_disp/stat_disp.php?y=0&leg=${leg}&pcnum=${number}&tm=${team.code}&mon=0&vst=all`;
        const html=await request(url),start=performance.now();
        const rows=parseNf3PitchingLogs(html,2026,team.code,"discovery",url,new Date().toISOString());
        onParse?.(performance.now()-start);
        // Identity key includes opponent/time, never totals, decisions or pitch count.
        result.push({participant,dates:new Set(rows.map(r=>`${r.date}|${r.opponentTeamId}|${r.scheduledTime ?? ""}`))});
      }
      return result;
    })());
    const opponent=game.homeTeamId===teamId?game.awayTeamId:game.awayTeamId===teamId?game.homeTeamId:null;
    if (!opponent) throw new Error("Historical game/team mismatch");
    const key=`${game.date}|${opponent}|${game.scheduledTime ?? ""}`;
    const participants=(await teams.get(teamId)!).filter(p=>p.dates.has(key)).map(p=>p.participant);
    if (!participants.length) throw new Error(`Historical pitcher participants unavailable: ${team.code} ${game.date}`);
    return participants;
  };
}

export function historicalReasonCodes(issues: readonly string[]): string[] {
  return [...new Set(issues.map(issue=>
    /Unresolved.*player|identity mismatch|identity changed|Conflicting.*identity/i.test(issue)?"identity_unresolved":
    /Check failed/i.test(issue)?"validation_failure":
    /pitcher participants unavailable|pitch usage date missing/i.test(issue)?"participant_source_path_unavailable":
    /lineup|roster/i.test(issue)?"participants_unknown":
    /Network failure|HTTP \d|Timeout/i.test(issue)?"source_unavailable":
    /schedule|games page|non-final/i.test(issue)?"schedule_enumeration_failure":
    /schema|column|Invalid|Unknown nf3|Unknown PA|Unsupported PA|Missing\/ambiguous/i.test(issue)?"source_response_invalid":"other"))];
}
