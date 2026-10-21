import { draftTeams } from "./npb-draft-event";
export function draftEventQuery(params:URLSearchParams){
  const view=params.get("view")??"preview",team=params.get("team")??"all",type=params.get("type")??"all",q=params.get("q")??"",page=Number(params.get("page")??"1");
  const valid=["preview","candidates","results"].includes(view)&&(team==="all"||draftTeams.includes(team))&&["all","regular","developmental"].includes(type)&&q.length<=80&&Number.isInteger(page)&&page>=1&&page<=100;
  return {valid,view,team,type,q,page};
}
