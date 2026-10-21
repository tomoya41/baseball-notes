import type { DraftEvent } from "../../domain/npb-draft-event";
import { draftCandidateId, draftHash } from "./wikipedia-npb-draft";

type Candidate = DraftEvent["candidates"][number];
export type Group = "high_school" | "university" | "corporate" | "independent";
const link = (value:string) => value.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
const label = (value:string) => value.replace(/\{\{left\}\}/g, "").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_,a:string,b?:string) => b??a).trim();
function candidate(article:string,name:string,affiliation:string,position:Candidate["position"],throws:string,bats:string,pageId:number,row:string,context:string):Candidate{
  if(!affiliation||/[<>{}]/.test(affiliation)||affiliation.includes("[")||affiliation.includes("]")||!['右','左','両'].includes(throws)||!['右','左','両'].includes(bats))throw Error("Unsupported amateur identity/handedness");
  return {id:draftCandidateId(article,affiliation),article,name,affiliation,position,throws:throws as Candidate["throws"],bats:bats as Candidate["bats"],sourcePageId:pageId,evidenceSha256:draftHash(row),context,eligibility:"unverified"};
}

/** Only the reviewed 2026 national-team roster layout. No grade or draft eligibility is inferred. */
export function draftAdditionalAmateurs(content:string){
  const roster=content.split("== 招集選手 ==\n")[1]?.split("== 試合結果 ==")[0];
  if(!roster)throw Error("Missing national-team roster scope");
  const result:{candidate:Candidate;group:Group}[]=[];
  for(const [heading,group] of [["社会人","corporate"],["U-18","high_school"]] as const){
    const section=roster.split(`=== ${heading} ===\n`)[1]?.split("\n=== ")[0]?.split("; 選出後の辞退選手")[0];
    if(!section?.includes("!!!#!!氏名!!英語表記!!所属!!投!!打!!備考"))throw Error("Unsupported amateur roster header");
    let position:Candidate["position"]|null=null;
    for(const block of section.split("|-\n")){
      const roleHeading=block.match(/^\|rowspan="\d+"\|([^\n]+)\n/);
      if(roleHeading){if(roleHeading[1]==="コーチ")position=null;else if(["投手","捕手","内野手","外野手"].includes(roleHeading[1]!))position=roleHeading[1] as Candidate["position"];else throw Error("Unsupported amateur role");}
      const row=block.split("\n").find(r=>/^\|\d+\|\|/.test(r));if(!row||!position)continue;
      const cells=row.slice(1).split("||"),person=link(cells[1]??"");
      if(cells.length!==7||!person)throw Error("Unsupported amateur roster row");
      // Not a full prospect universe. This overseas-path player is deliberately outside this scenario.
      if(person[1]==="織田翔希")continue;
      result.push({candidate:candidate(person[1]!,person[2]??person[1]!,label(cells[3]!),position,cells[4]!,cells[5]!,5209342,row,`2026年${heading}代表名簿（所属・役割は大会当時、指名資格未確認）`),group});
    }
  }
  return result;
}

/** Explicit linked pitcher row in a reviewed club roster; a red link remains a source-local prospect, never a canonical Player. */
export function draftIndependentPitcher(content:string,pageId:number,article:string){
  const settings:Record<number,{club:string;header:string;numberFirst:boolean}>={
    3859496:{club:"茨城アストロプラネッツ",header:"!背番号!!選手名!!投!!打!!備考",numberFirst:true},
    528913:{club:"徳島インディゴソックス",header:"!名前!!背番号!!投打!!備考",numberFirst:false},
    565473:{club:"高知ファイティングドッグス",header:"!名前!!背番号!!投打!!備考",numberFirst:false},
  };
  const setting=settings[pageId];if(!setting)throw Error("Unreviewed independent source");
  const current=content.split(pageId===3859496?"== 所属選手 ==":"== 現役選手・スタッフ ==")[1]?.split("== 過去")[0];
  const pitchers=current?.split("=== 投手 ===\n")[1]?.split("\n=== ")[0];
  if(!pitchers?.includes(setting.header))throw Error("Unsupported independent roster");
  const found:Candidate[]=[];
  for(const block of pitchers.split("|-\n")){
    const lines=block.trim().replace(/\n\|\}$/,""),row=setting.numberFirst?lines.match(/^!\d+\n(\|[^\n]+)$/)?.[1]:lines.match(/^(\|[^\n]+)$/)?.[1];
    if(!row)continue;
    const cells=row.slice(1).split("||"),person=link(cells[0]??"");if(person?.[1]!==article)continue;
    if(cells.length!==4||/元・|監督|コーチ/.test(cells.at(-1)!))throw Error("Unverified draft candidate context");
    const hands=setting.numberFirst?[cells[1]!,cells[2]!]:[...cells[2]!];if(hands.length!==2)throw Error("Unsupported independent handedness");
    found.push(candidate(article,person[2]??article,setting.club,"投手",hands[0]!,hands[1]!,pageId,lines,"記事の所属選手表に記載（契約・練習生の区別、指名資格は未確認）"));
  }
  if(found.length!==1)throw Error("Independent candidate needs one exact linked roster row");
  return found[0]!;
}
