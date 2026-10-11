import type { Favorite } from "../domain/models";
import type { FormCategory, FormEntry, FormIndex } from "../domain/historical-form";
import type { WatchObservation } from "../domain/personal-watch";

/** User-triggered Historical observation. First check is baseline; no background delivery. */
export function formWatchObservations(index:FormIndex,asOf:string,days:7|14|30,mode:"hot"|"monthly",category:FormCategory,entries:FormEntry[],favorites:Favorite[],now:number):WatchObservation[] {
  if(index.coverage!=="complete"||asOf<index.firstDate||asOf>index.lastDate||mode==="monthly"&&index.competitionType!=="regular")return [];
  return favorites.filter(f=>f.league==="MLB"&&f.kind==="player"&&index.roles.some(p=>p.playerId===f.entityId)).slice(0,12).map(f=>{
    const entry=entries.find(e=>e.playerId===f.entityId),member=!!entry&&entry.rank<=10;
    const scope=mode==="monthly"?asOf.slice(0,7):String(days);
    return {key:`MLB:form:${index.season}:${index.competitionType}:${mode}:${scope}:${category}:${f.entityId}`,league:"MLB",kind:"player",entityId:f.entityId,name:entry?.name??f.entityId,rule:"form",season:index.season,competition:index.competitionType,effectiveDate:asOf,generatedAt:null,eventDate:null,coverage:"complete",path:`/MLB/form?season=${index.season}&asOfDate=${asOf}&mode=${mode}&period=${days}&category=${category}${index.competitionType==="postseason"?"&competition=postseason":""}`,metric:mode==="monthly"?"月間候補":"HOT",values:{member:member?"true":"false",rank:member?entry!.rank:null,value:member?entry!.metrics[category==="batting"?"OPS":"ERA"]?.value??null:null,sample:member?entry!.metrics[category==="batting"?"PA":"outsRecorded"]?.value??null:null},collectionOnly:false,observedAt:now};
  });
}
