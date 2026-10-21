import { createHash } from "node:crypto";
import { z } from "zod";
import { draftEventSchema,draftSourceSchema,type DraftEvent } from "../../domain/npb-draft-event";
import admittedSources from "../../data/npb-draft-2026-sources.json";

export const draftHash=(value:string|Uint8Array)=>createHash("sha256").update(value).digest("hex");
export const draftCandidateId=(article:string,affiliation:string)=>`npb:draft:2026:${draftHash(JSON.stringify([article,affiliation])).slice(0,24)}`;
const plain=(s:string)=>s.replace(/\{\{left\}\}/g,"").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,a:string,b?:string)=>b??a).trim();
const archiveSchema=z.object({observedAt:z.iso.datetime(),response:z.object({query:z.object({pages:z.array(z.object({pageid:z.number().int().positive(),title:z.string(),revisions:z.array(z.object({revid:z.number().int().positive(),timestamp:z.iso.datetime(),slots:z.object({main:z.object({content:z.string().max(150000)})})})).length(1)}))})})});
/** One documented API request; new revisions remain private candidates until admission review. */
export async function fetchDraftCandidateArchive(request:typeof fetch=fetch,scope:"core"|"preview"|"research"="core"){
  const allowed=new Map(admittedSources.filter(s=>scope==="research"||scope==="preview"&&s.pageId!==5110570||[5282993,5209342].includes(s.pageId)).map(s=>[s.pageId,s.title]));
  const url=new URL("https://ja.wikipedia.org/w/api.php");
  for(const [key,value] of Object.entries({action:"query",format:"json",formatversion:"2",prop:"revisions",rvprop:"ids|timestamp|content",rvslots:"main",pageids:[...allowed.keys()].join("|"),maxlag:"5"}))url.searchParams.set(key,value);
  const response=await request(url,{headers:{"User-Agent":"BaseballNotes/1.0 (https://github.com/tomoya41/baseball-notes; licensed draft snapshot)"},signal:AbortSignal.timeout(30000)});
  if(!response.ok||!response.body)throw Error(`Draft candidate HTTP ${response.status}`);
  const reader=response.body.getReader(),parts:Uint8Array[]=[];let length=0;
  try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>500000)throw Error("Draft API byte budget exceeded");parts.push(part.value);}}catch(error){await reader.cancel().catch(()=>undefined);throw error;}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  const archive=archiveSchema.parse({observedAt:new Date().toISOString(),response:JSON.parse(new TextDecoder().decode(bytes))});
  if(archive.response.query.pages.length!==allowed.size||new Set(archive.response.query.pages.map(p=>p.pageid)).size!==allowed.size||archive.response.query.pages.some(p=>allowed.get(p.pageid)!==p.title))throw Error("Unexpected draft source identity");
  return archive;
}
export function admittedDraftArchive(raw:unknown,admitted:readonly z.infer<typeof draftSourceSchema>[]){
  const a=archiveSchema.parse(raw);const pages=a.response.query.pages.map(p=>{
    const r=p.revisions[0]!,content=r.slots.main.content;
    const source=draftSourceSchema.parse({provider:"Wikipedia",pageId:p.pageid,title:p.title,revision:r.revid,revisionAt:r.timestamp,contentSha256:draftHash(content),license:"CC-BY-SA-4.0"});
    if(!admitted.some(s=>Object.entries(source).every(([key,value])=>s[key as keyof typeof source]===value)))throw Error("Unadmitted draft revision");
    if(Date.parse(r.timestamp)>Date.parse(a.observedAt))throw Error("Future source revision");
    return {source,content};
  });return {observedAt:a.observedAt,pages};
}

/** Retained predecessors remain reproducible after the active pin advances. */
export function pinnedDraftPredecessor(bytes:Uint8Array,pins:readonly {bodySha256:string;forecastSha256:string}[]){
  const known=pins.find(p=>p.bodySha256===draftHash(bytes));if(!known)throw Error("Unpinned previous Draft snapshot");
  const data=draftEventSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
  if(draftHash(JSON.stringify(data.forecast))!==known.forecastSha256)throw Error("Pinned forecast mismatch");
  return data;
}

/** A new revision may not silently become provenance for a carried row that it no longer contains. */
export function assertCarriedDraftEvidence(previous:DraftEvent,pages:ReturnType<typeof admittedDraftArchive>["pages"]){
  for(const page of pages){
    const prior=previous.sources.find(s=>s.pageId===page.source.pageId);
    if(!prior||JSON.stringify(prior)===JSON.stringify(page.source))continue;
    // Row-only hashes do not prove enclosing role/section/roster membership. Such revisions need a dedicated migration.
    if(page.source.pageId!==5282993&&previous.candidates.some(c=>c.sourcePageId===page.source.pageId))throw Error("Candidate roster revision/context is frozen; separate reviewed migration required");
    const lines=page.content.split("\n"),proofs=new Map<string,number>();
    for(let i=0;i<lines.length;i++)for(const text of [lines[i]!,i?lines[i-1]+"\n"+lines[i]:null])if(text){const h=draftHash(text);proofs.set(h,(proofs.get(h)??0)+1);}
    const rows=[...previous.candidates,...previous.selections,...previous.lotteries].filter(c=>c.sourcePageId===page.source.pageId);
    if(rows.some(c=>proofs.get(c.evidenceSha256)!==1))throw Error("Carried Draft evidence changed or removed; separate source/candidate review required");
  }
}

/** Carry frozen preview context while adding only the university category proven by the strict roster parser. */
export function carryDraftPreview(previous:DraftEvent,incoming:DraftEvent,pages:ReturnType<typeof admittedDraftArchive>["pages"]):DraftEvent{
  assertCarriedDraftEvidence(previous,pages);
  for(const c of incoming.candidates){const prior=previous.candidates.find(p=>p.id===c.id);if(prior&&JSON.stringify(prior)!==JSON.stringify(c))throw Error("Candidate correction requires separate review");}
  return {...incoming,
    candidates:[...previous.candidates,...incoming.candidates.filter(c=>!previous.candidates.some(p=>p.id===c.id))],
    sources:[...incoming.sources,...previous.sources.filter(s=>!incoming.sources.some(p=>p.pageId===s.pageId))],
    expandedForecast:previous.expandedForecast,researchedForecast:previous.researchedForecast,
    candidateGroups:[...previous.candidateGroups??[],...incoming.candidates.filter(c=>!previous.candidateGroups?.some(g=>g.candidateId===c.id)).map(c=>({candidateId:c.id,group:"university" as const}))],
    review:previous.review,
  };
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

const proof=z.strictObject({pageId:z.literal(5282993),row:z.string().min(1).max(2000),mode:z.literal("team_table").optional()});
const reviewedSelection=z.strictObject({teamId:z.string(),type:z.enum(["regular","developmental"]),round:z.number().int().positive(),name:z.string(),article:z.string(),affiliation:z.string(),proof});
const reviewedLottery=z.strictObject({attempt:z.number().int().positive(),candidateId:z.string(),teamIds:z.array(z.string()),winnerId:z.string().nullable(),proof});
const reviewSchema=z.strictObject({reviewedBy:z.string().min(1).max(80),reviewedAt:z.iso.datetime(),eventState:z.enum(["in_progress","ended"]),eventProof:proof,selections:z.array(reviewedSelection),lotteries:z.array(reviewedLottery)});
const teamNames:Record<string,string>={giants:"読売ジャイアンツ",tigers:"阪神タイガース",dragons:"中日ドラゴンズ",carp:"広島東洋カープ",swallows:"東京ヤクルトスワローズ",baystars:"横浜DeNAベイスターズ",hawks:"福岡ソフトバンクホークス",fighters:"北海道日本ハムファイターズ",lions:"埼玉西武ライオンズ",marines:"千葉ロッテマリーンズ",eagles:"東北楽天ゴールデンイーグルス",buffaloes:"オリックス・バファローズ"};
const teamName=(id:string)=>{const value=teamNames[id.replace(/^npb:team:/,"")];if(!value)throw Error("Unknown team");return value;};
/** Reviewed 2025-style team tables. Selection is not evidence of signing or roster membership. */
export function draftTeamTableRows(content:string){
  const section=content.split("== 球団別指名選手一覧 ==\n")[1];if(!section)return [];
  const result:{teamId:string;type:"regular"|"developmental";round:number;name:string;article:string;affiliation:string;row:string}[]=[];
  for(const [key,team] of Object.entries(teamNames)){
    const marker=`=== ${team} ===\n`,parts=section.split(marker);if(parts.length===1)continue;if(parts.length!==2)throw Error("Duplicate team section");
    const table=parts[1]!.split(/\n==+ /)[0]!;let type:"regular"|"developmental"|null=null,header=false;
    for(const raw of table.split("|-\n")){
      const block=raw.trim().replace(/^\{\| class="wikitable"\n/,"");
      const mode=block.match(/^! colspan="5" \|(新人選手選択会議|育成選手選択会議)$/);
      if(mode){type=mode[1]==="新人選手選択会議"?"regular":"developmental";header=false;continue;}
      if(block==="!順位!!選手名!!守備!!所属!!結果"){if(!type)throw Error("Table scope missing");header=true;continue;}
      const row=block.match(/^!([1-9]\d*)位\n(\|[^\n]+)(?:\n\|\})?$/);if(!row){if(/^!\d+位/.test(block))throw Error("Unsupported selection structure");continue;}
      if(/^[|\s\-—]*$/.test(row[2]!))continue;
      if(!type||!header)throw Error("Unverified selection table header");
      const cells=row[2]!.slice(1).split("||");if(cells.length!==4)throw Error("Unsupported selection columns");
      const linked=cells[0]!.replace(/'''/g,"").match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
      if(!linked||!['投手','捕手','内野手','外野手'].includes(cells[1]!)||!plain(cells[2]!))throw Error("Unverified table identity");
      result.push({teamId:`npb:team:${key}`,type,round:Number(row[1]),article:linked[1]!,name:linked[2]??linked[1]!,affiliation:plain(cells[2]!),row:`!${row[1]}位\n${row[2]}`});
    }
  }return result;
}
/** A deliberately narrow reviewed-row adapter. Unsupported/matrix tables require an independently tested adapter, never broad token matching. */
export function applyReviewedDraftResults(base:DraftEvent,content:string,raw:unknown,observedAt:string,buildTime:number=Date.now()){
  const review=reviewSchema.parse(raw),d=structuredClone(base);
  if(Date.parse(review.reviewedAt)<Date.parse(base.scheduledAt)||Date.parse(review.reviewedAt)<Date.parse(observedAt)||Date.parse(review.reviewedAt)>buildTime)throw Error("Invalid review time");
  function evidence(p:z.infer<typeof proof>){if(p.row.includes("\n")||!content.split("\n").includes(p.row)||content.split(p.row).length!==2)throw Error("Evidence must be one unique source line");return plain(p.row).split(/\|\|/).map(s=>s.replace(/^\|/,"").trim());}
  evidence(review.eventProof);
  const eventText=plain(review.eventProof.row).replace(/<ref\b[^>]*>[\s\S]*?<\/ref>|<ref\b[^>]*\/>/g,"").replace(/'{2,5}/g,"");
  const actual=review.eventState==="ended"?/終了(?:した|された)。$/:/(?:開始|開催)(?:した。|された(?:。|第\d+回))/;
  if(!eventText.includes("2026年10月22日")||!/(?:ドラフト会議|新人選手選択会議)/.test(eventText)||/予定|場合|終了した後/.test(eventText)||!actual.test(eventText))throw Error("Missing actual event evidence");
  d.observedAt=observedAt;d.review={reviewedBy:review.reviewedBy,reviewedAt:review.reviewedAt};d.eventState=review.eventState;d.coverage="partial";d.selections=[];d.lotteries=[];
  for(const r of review.selections){
    if(r.proof.mode==="team_table"){
      const rows=draftTeamTableRows(content).filter(row=>row.row===r.proof.row&&row.teamId===r.teamId&&row.type===r.type&&row.round===r.round&&row.name===r.name&&row.article===r.article&&row.affiliation===r.affiliation);
      if(rows.length!==1)throw Error("Unverified team table selection");
    }else{
    const cells=evidence(r.proof),type=r.type==="regular"?"支配下":"育成";
    const link=r.article===r.name?`[[${r.article}]]`:`[[${r.article}|${r.name}]]`;
    if(cells.length!==5||cells[0]!==teamName(r.teamId)||cells[1]!==`${r.round}位`||cells[2]!==r.name||cells[3]!==r.affiliation||cells[4]!==type||!r.proof.row.includes(link))throw Error("Unsupported selection row/identity");
    }
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
