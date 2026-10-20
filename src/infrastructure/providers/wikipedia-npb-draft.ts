import { createHash } from "node:crypto";
import { z } from "zod";
import { draftEventSchema,draftSourceSchema,type DraftEvent } from "../../domain/npb-draft-event";

export const draftHash=(value:string|Uint8Array)=>createHash("sha256").update(value).digest("hex");
export const draftCandidateId=(article:string,affiliation:string)=>`npb:draft:2026:${draftHash(JSON.stringify([article,affiliation])).slice(0,24)}`;
const plain=(s:string)=>s.replace(/\{\{left\}\}/g,"").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,a:string,b?:string)=>b??a).trim();
const archiveSchema=z.object({observedAt:z.iso.datetime(),response:z.object({query:z.object({pages:z.array(z.object({pageid:z.number().int().positive(),title:z.string(),revisions:z.array(z.object({revid:z.number().int().positive(),timestamp:z.iso.datetime(),slots:z.object({main:z.object({content:z.string().max(150000)})})})).length(1)}))})})});
export function admittedDraftArchive(raw:unknown,admitted:readonly z.infer<typeof draftSourceSchema>[]){
  const a=archiveSchema.parse(raw);const pages=a.response.query.pages.map(p=>{
    const r=p.revisions[0]!,content=r.slots.main.content;
    const source=draftSourceSchema.parse({provider:"Wikipedia",pageId:p.pageid,title:p.title,revision:r.revid,revisionAt:r.timestamp,contentSha256:draftHash(content),license:"CC-BY-SA-4.0"});
    if(!admitted.some(s=>Object.entries(source).every(([key,value])=>s[key as keyof typeof source]===value)))throw Error("Unadmitted draft revision");
    if(Date.parse(r.timestamp)>Date.parse(a.observedAt))throw Error("Future source revision");
    return {source,content};
  });return {observedAt:a.observedAt,pages};
}
/** Exact reviewed university roster, four-year students only; eligibility is deliberately not inferred. */
export function draftRosterCandidates(content:string){
  const section=content.split("=== 大学 ===\n")[1]?.split("=== U-18 ===")[0];
  if(!section||!section.includes("!!!#!!氏名!!英語表記!!所属大学!!学年!!投!!打!!備考"))throw Error("Unsupported university roster");
  let position="";const candidates:DraftEvent["candidates"]=[];
  for(const block of section.split("|-\n")){
    const role=block.match(/^\|rowspan="\d+"\|(投手|捕手|内野手|外野手)\n/);if(role)position=role[1]!;
    const row=block.split("\n").find(line=>/^\|\d+\|\|/.test(line));if(!row)continue;
    const cells=row.slice(1).split("||");if(!position)continue;if(cells.length!==8)throw Error("Unsupported roster cells");
    if(cells[4]!=="4")continue;
    const article=cells[1]!.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/)?.[1];
    if(!article||!['右','左','両'].includes(cells[5]!)||!['右','左','両'].includes(cells[6]!))throw Error("Unverified roster identity");
    const affiliation=plain(cells[3]!);
    candidates.push({id:draftCandidateId(article,affiliation),name:plain(cells[1]!),article,affiliation,position:position as DraftEvent["candidates"][number]["position"],throws:cells[5] as "右"|"左"|"両",bats:cells[6] as "右"|"左"|"両",context:"2026年大学代表名簿・4年生（所属・守備位置は大会当時）",eligibility:"unverified",sourcePageId:5209342,evidenceSha256:draftHash(row)});
  }
  return candidates;
}

const proof=z.strictObject({pageId:z.literal(5282993),row:z.string().min(1).max(2000)});
const reviewedSelection=z.strictObject({teamId:z.string(),type:z.enum(["regular","developmental"]),round:z.number().int().positive(),name:z.string(),article:z.string(),affiliation:z.string(),proof});
const reviewedLottery=z.strictObject({attempt:z.number().int().positive(),candidateId:z.string(),teamIds:z.array(z.string()),winnerId:z.string().nullable(),proof});
const reviewSchema=z.strictObject({reviewedBy:z.string().min(1).max(80),reviewedAt:z.iso.datetime(),eventState:z.enum(["in_progress","ended"]),eventProof:proof,selections:z.array(reviewedSelection),lotteries:z.array(reviewedLottery)});
const teamNames:Record<string,string>={giants:"読売ジャイアンツ",tigers:"阪神タイガース",dragons:"中日ドラゴンズ",carp:"広島東洋カープ",swallows:"東京ヤクルトスワローズ",baystars:"横浜DeNAベイスターズ",hawks:"福岡ソフトバンクホークス",fighters:"北海道日本ハムファイターズ",lions:"埼玉西武ライオンズ",marines:"千葉ロッテマリーンズ",eagles:"東北楽天ゴールデンイーグルス",buffaloes:"オリックス・バファローズ"};
const teamName=(id:string)=>{const value=teamNames[id.replace(/^npb:team:/,"")];if(!value)throw Error("Unknown team");return value;};
/** A deliberately narrow reviewed-row adapter. Unsupported/matrix tables require an independently tested adapter, never broad token matching. */
export function applyReviewedDraftResults(base:DraftEvent,content:string,raw:unknown,observedAt:string){
  const review=reviewSchema.parse(raw),d=structuredClone(base);
  if(Date.parse(review.reviewedAt)<Date.parse(base.scheduledAt)||Date.parse(review.reviewedAt)>Date.parse(observedAt))throw Error("Invalid review time");
  function evidence(p:z.infer<typeof proof>){if(p.row.includes("\n")||!content.split("\n").includes(p.row)||content.split(p.row).length!==2)throw Error("Evidence must be one unique source line");return plain(p.row).split(/\|\|/).map(s=>s.replace(/^\|/,"").trim());}
  evidence(review.eventProof);if(!new RegExp(review.eventState==="ended"?"終了した。$":"(?:開始|開催)した。$").test(plain(review.eventProof.row)))throw Error("Missing actual event evidence");
  d.observedAt=observedAt;d.eventState=review.eventState;d.coverage="partial";d.selections=[];d.lotteries=[];
  for(const r of review.selections){
    const cells=evidence(r.proof),type=r.type==="regular"?"支配下":"育成";
    const link=r.article===r.name?`[[${r.article}]]`:`[[${r.article}|${r.name}]]`;
    if(cells.length!==5||cells[0]!==teamName(r.teamId)||cells[1]!==`${r.round}位`||cells[2]!==r.name||cells[3]!==r.affiliation||cells[4]!==type||!r.proof.row.includes(link))throw Error("Unsupported selection row/identity");
    const id=draftCandidateId(r.article,r.affiliation),existing=d.candidates.find(c=>c.id===id);
    if(existing&&existing.name!==r.name)throw Error("Conflicting candidate identity");
    if(!existing)d.candidates.push({id,name:r.name,article:r.article,affiliation:r.affiliation,position:"未確認",throws:"未確認",bats:"未確認",context:"指名結果表の所属（入団・現在所属の認定ではありません）",eligibility:"unverified",sourcePageId:5282993,evidenceSha256:draftHash(r.proof.row)});
    d.selections.push({teamId:r.teamId,candidateId:id,type:r.type,round:r.round,status:"confirmed",sourcePageId:5282993,evidenceSha256:draftHash(r.proof.row)});
  }
  for(const r of review.lotteries){
    const cells=evidence(r.proof),c=d.candidates.find(c=>c.id===r.candidateId);
    if(!c||cells.length!==4||cells[0]!==`第${r.attempt}回抽選`||cells[1]!==c.name||cells[2]!==r.teamIds.map(teamName).join("・")||cells[3]!== (r.winnerId?`当選：${teamName(r.winnerId)}`:"当選未確認"))throw Error("Unsupported lottery evidence");
    d.lotteries.push({attempt:r.attempt,candidateId:r.candidateId,teamIds:r.teamIds,winnerId:r.winnerId,sourcePageId:5282993,evidenceSha256:draftHash(r.proof.row)});
  }
  return draftEventSchema.parse(d);
}
