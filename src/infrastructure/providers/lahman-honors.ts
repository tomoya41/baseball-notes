import { createHash } from "node:crypto";
import type { Honor, HonorRecipient } from "../../domain/player-honors";
export type CsvRecord=Record<string,string>;
export const annualMlbHonors:Record<string,[string,string]>={
 "Most Valuable Player":["mlb_mvp","MVP（最優秀選手）"],"Cy Young Award":["mlb_cy_young","サイ・ヤング賞"],"Rookie of the Year":["mlb_rookie","新人王"],"Gold Glove":["mlb_gold_glove","ゴールドグラブ賞"],"Silver Slugger":["mlb_silver_slugger","シルバースラッガー賞"],"Hank Aaron Award":["mlb_hank_aaron","ハンク・アーロン賞"],"World Series MVP":["mlb_ws_mvp","ワールドシリーズMVP"],"ALCS MVP":["mlb_alcs_mvp","ア・リーグ優勝決定シリーズMVP"],"NLCS MVP":["mlb_nlcs_mvp","ナ・リーグ優勝決定シリーズMVP"],"All-Star Game MVP":["mlb_allstar_mvp","オールスターゲームMVP"],"Roberto Clemente Award":["mlb_clemente","ロベルト・クレメンテ賞"],"Comeback Player of the Year":["mlb_comeback","カムバック賞"],"Reliever of the Year Award":["mlb_reliever","リリーバー・オブ・ザ・イヤー賞"],"All-MLB Team - First Team":["mlb_first_team","オールMLB・ファーストチーム"],"All-MLB Team - Second Team":["mlb_second_team","オールMLB・セカンドチーム"],"Platinum Glove":["mlb_platinum","プラチナグラブ賞"]};
export const evidenceDigest=(s:string)=>createHash("sha256").update(s).digest("hex");
/** Stable external IDs must converge on exactly one registry UUID; names are not evidence. */
export function matchLahmanIdentity(person:CsvRecord,identities:readonly CsvRecord[]){
 const matches=identities.filter(r=>person.bbrefID&&r.key_bbref===person.bbrefID||person.retroID&&r.key_retro===person.retroID);
 if(new Set(matches.map(r=>r.key_uuid)).size!==1)return null;const identity=matches[0]!;
 if(!identity.key_uuid||(person.bbrefID&&identity.key_bbref!==person.bbrefID)||(person.retroID&&identity.key_retro!==person.retroID)||[["birthYear","birth_year"],["birthMonth","birth_month"],["birthDay","birth_day"]].some(([a,b])=>person[a!]&&identity[b!]&&Number(person[a!])!==Number(identity[b!])))return null;
 return identity;
}
/** AwardsPlayers winners only. Votes, statistical maxima and candidates are not inputs. */
export function parseLahmanHonors(rows:readonly CsvRecord[],recipients:ReadonlyMap<string,HonorRecipient>,teams:ReadonlyMap<string,Honor["seasonTeams"]>,sourceId:string){
 const records:Honor[]=[],held:{reason:string;evidenceSha256:string}[]=[];
 for(const r of rows){const def=annualMlbHonors[r.awardID??""];if(!def)continue;const proof=evidenceDigest(JSON.stringify(r));
  const year=Number(r.yearID),p=recipients.get(r.playerID??"");
  if(!p||!/^\d{4}$/.test(r.yearID??"")||year>2025||year<1871||!["AL","NL","ML"].includes(r.lgID??"")||r.awardID==="Most Valuable Player"&&year<1931){held.push({reason:!p?"missing_person_identity":"year_or_historical_institution_unsupported",evidenceSha256:proof});continue;}
  const position=r.notes?.trim()||null,id=evidenceDigest(`lahman:${r.playerID}:${r.awardID}:${year}:${r.lgID}:${position??""}`);
  if(records.some(a=>a.id===id))throw Error("Duplicate Lahman winner identity");
  records.push({id,recipientId:p.id,league:"MLB",year,division:r.lgID!,awardId:def[0],name:def[1],sourceName:r.awardID!,kind:"award",position,seasonTeams:teams.get(`${r.playerID}:${year}:${r.lgID}`)??[],joint:r.tie==="Y"?true:r.tie==="N"?false:null,sourceId,evidenceSha256:proof,reportedCareerWins:null});
 }
 return{records,held};
}
