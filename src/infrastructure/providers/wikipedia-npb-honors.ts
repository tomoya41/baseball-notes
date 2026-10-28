import { createHash } from "node:crypto";
import type { Honor } from "../../domain/player-honors";
const definitions:Record<string,[string,string,"title"|"award"]>={
 "首位打者 (日本プロ野球)":["npb_avg","首位打者賞","title"],"最多本塁打 (日本プロ野球)":["npb_hr","最多本塁打者賞","title"],"最多打点 (日本プロ野球)":["npb_rbi","最多打点者賞","title"],"最多盗塁 (日本プロ野球)":["npb_sb","最多盗塁者賞","title"],"最多安打 (日本プロ野球)":["npb_h","最多安打者賞","title"],"最高出塁率 (日本プロ野球)":["npb_obp","最高出塁率者賞","title"],
 "最多勝利":["npb_w","最多勝利投手賞","title"],"最多勝利 (日本プロ野球)":["npb_w","最多勝利投手賞","title"],"最優秀防御率 (日本プロ野球)":["npb_era","最優秀防御率投手賞","title"],"最多奪三振 (日本プロ野球)":["npb_so","最多三振奪取投手賞","title"],"最多セーブ投手":["npb_sv","最多セーブ投手賞","title"],"最優秀救援投手":["npb_relief","最優秀救援投手賞","title"],"最高勝率 (日本プロ野球)":["npb_wpct","勝率第一位投手賞","title"],"最優秀中継ぎ投手":["npb_hold","最優秀中継ぎ投手賞","title"],
 "最優秀選手 (日本プロ野球)":["npb_mvp","最優秀選手賞","award"],"最優秀新人 (日本プロ野球)":["npb_roy","最優秀新人賞","award"],"ベストナイン (日本プロ野球)":["npb_bestnine","ベストナイン","award"],"ゴールデングラブ賞":["npb_glove","ゴールデングラブ賞","award"],"沢村栄治賞":["npb_sawamura","沢村栄治賞","award"]};
definitions["最多セーブ投手 (日本プロ野球)"]=definitions["最多セーブ投手"]!;
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
const visible=(s:string)=>s.replace(/<!--[\s\S]*?(?:-->|$)/g,"").replace(/<ref\b[^>]*\/>/gi,"").replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi,"");
const mask=(s:string)=>s.replace(/[^\r\n]/g," ");
/** Known citation/note templates only; preserve line offsets and never interpret their contents. */
function maskNotes(text:string){
 const pattern=/\{\{\s*(?:[Rr]|[Ee]fn2)\s*\|/g;let out="",at=0,match:RegExpExecArray|null;
 while((match=pattern.exec(text))){
  out+=text.slice(at,match.index);let depth=1,end=pattern.lastIndex;
  while(depth&&end<text.length){const pair=text.slice(end,end+2);if(pair==="{{"){depth++;end+=2;}else if(pair==="}}"){depth--;end+=2;}else end++;}
  if(depth)throw Error("unterminated_annotation");
  out+=mask(text.slice(match.index,end));at=end;pattern.lastIndex=end;
 }
 return out+text.slice(at);
}
const positionPattern="(?:投手|捕手|一塁手|二塁手|三塁手|遊撃手|外野手|指名打者)部門";
type AwardPart={position:string|null;years:number[]};
function years(raw:string){
 const s=raw.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,a:string,b?:string)=>b??a).trim();const result:number[]=[];
 for(const part of s.split(/[、,]/)){const m=/^(\d{4})年(?:\s*[-–−〜]\s*(\d{4})年)?$/.exec(part.trim());if(!m)throw Error("unsupported_year_expression");const from=Number(m[1]),to=Number(m[2]??m[1]);if(to<from||to-from>60)throw Error("invalid_year_range");for(let y=from;y<=to;y++)result.push(y);}
 if(new Set(result).size!==result.length||result.some(y=>y<1936||y>2025))throw Error("duplicate_or_unconfirmed_year");return result;
}
/** Explicit position labels partition a year list; the year parser still rejects all unknown syntax. */
function positionYears(raw:string):AwardPart[]{
 const labels=[...raw.matchAll(new RegExp(`(${positionPattern})\\s*[：:]\\s*`,"g"))];
 if(!labels.length)return [{position:null,years:years(raw)}];
 if(raw.slice(0,labels[0]!.index).trim())throw Error("unsupported_award_position");
 return labels.map((label,i)=>{
  if(i&&!/[、,\s]/.test(raw[label.index!-1]!))throw Error("unsupported_award_position_separator");
  const segment=raw.slice(label.index!+label[0].length,labels[i+1]?.index??raw.length);
  const value=i<labels.length-1?segment.replace(/(?:[、,]\s*|\s+)$/,""):segment.trim();
  return {position:label[1]!,years:years(value)};
 });
}
function parsePart(raw:string):AwardPart[]{
 const m=new RegExp(`^(?:(${positionPattern})\\s*[：:]\\s*)?(\\d+)回\\s*（([^）]+)）`).exec(raw.trim());
 if(!m)throw Error("unsupported_award_list");
 const parts=positionYears(m[3]!);
 if(m[1]){if(parts.some(p=>p.position!==null))throw Error("ambiguous_award_positions");for(const p of parts)p.position=m[1];}
 if(parts.reduce((n,p)=>n+p.years.length,0)!==Number(m[2]))throw Error("declared_count_mismatch");
 return parts;
}
/** Exact annual NPB title links + explicit year/count lists; never prose or rankings. */
export function parseNpbHonors(text:string,recipientId:string,sourceId:string){
 const rows:Honor[]=[],issues:{reason:string;evidenceSha256:string}[]=[];const rawLines=text.split(/\r?\n/);
 let masked:string;
 try{masked=maskNotes(text.replace(/<!--[\s\S]*?(?:-->|$)/g,mask).replace(/<ref\b[^>]*\/>/gi,mask).replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi,mask));}
 catch{return {rows,issues:[{reason:"unterminated_annotation",evidenceSha256:hash(text)}]};}
 const lines=masked.split(/\r?\n/).map(visible);let section=false,sectionLevel=0,foreign=false;
 for(let i=0;i<lines.length;i++){
  const line=lines[i]!,heading=/^(={2,6})\s*([^=]+?)\s*\1$/.exec(line);if(heading){const level=heading[1]!.length,label=heading[2]!.trim();if(/^(?:タイトル|表彰)$/.test(label)){section=true;sectionLevel=level;foreign=false;}else if(level<=sectionLevel){section=false;}else if(section){foreign=label!=="NPB";}continue;}if(!section||foreign||!/^\*\s*\[\[/.test(line))continue;
  let match:readonly (string|undefined)[]|null=/^\*\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]\s*[：:]\s*(\d+)回(.*)$/.exec(line);
  const single=/^\*\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]\s*[：:]?\s*（(\d{4}年)\s*）/.exec(line);
  if(!match&&single)match=[single[0],single[1]!,single[2]??single[1]!,"1",`（${single[3]}）`];
  if(!match)continue;const def=definitions[match[1]!];if(!def||def[0]==="npb_roy"&&match[2]&&!['新人王','最優秀新人','最優秀新人賞'].includes(match[2]))continue;
  const rawBlock=[rawLines[i]!],block=[line];while(lines[i+1]?.startsWith("**")){block.push(lines[++i]!);rawBlock.push(rawLines[i]!);}const proof=hash(rawBlock.join("\n"));
  try{
   if(/候補|予想|未確定|受賞予定|取消|辞退/.test(block.join("\n")))throw Error("not_confirmed_winner");
   const count=Number(match[3]),children=block.slice(1).map(s=>s.replace(/^\*\*\s*/,""));
   const counted=children.filter(s=>new RegExp(`^(?:${positionPattern}\\s*[：:]\\s*)?\\d+回\\s*（`).test(s));
   const awardLike=(s:string)=>/^\d+(?:回|年)|^\[\[\d{4}年/.test(s)||new RegExp(`^${positionPattern}`).test(s)||/部門\s*[：:]|\d+回\s*（|^\[\[[^\]]+\]\]\s*[：:]?\s*\d+(?:回|年)/.test(s)||/部門/.test(s)&&/\d+(?:回|年)/.test(s);
   if(children.some(s=>awardLike(s)&&!counted.includes(s)))throw Error("unsupported_award_child");
   if(children.some(s=>[...s.matchAll(/(\d{4})年/g)].some(m=>Number(m[1])>2025)))throw Error("unconfirmed_child_year");
   if(counted.length&&/\d{4}年/.test(match[4]??""))throw Error("ambiguous_parent_and_child_years");
   const parts=counted.length?counted.flatMap(parsePart):parsePart(`${match[3]}回${match[4]}`);
   if(parts.reduce((n,p)=>n+p.years.length,0)!==count)throw Error("nested_count_mismatch");
   const keys=parts.flatMap(p=>p.years.map(y=>`${p.position??""}:${y}`));if(new Set(keys).size!==keys.length)throw Error("duplicate_award_position_year");
   if(def[0]==="npb_wpct"&&parts.some(p=>p.years.some(y=>y<2013)))throw Error("historical_winning_percentage_institution_needs_review");
   for(const part of parts)for(const year of part.years){const oldRelief=def[0]==="npb_sv"&&year<=2004,code=oldRelief?"npb_relief":def[0],name=def[0]==="npb_glove"&&year<=1985?"ダイヤモンドグラブ賞":oldRelief?"最優秀救援投手賞":def[1];rows.push({id:hash(`${recipientId}:${code}:${year}:${part.position??""}`),recipientId,league:"NPB",year,division:null,awardId:code,name,sourceName:match[2]??match[1]!,kind:def[2],position:part.position,seasonTeams:[],joint:null,sourceId,evidenceSha256:proof,reportedCareerWins:count});}
  }catch(e){issues.push({reason:(e as Error).message,evidenceSha256:proof});}
 }
 return{rows,issues};
}
