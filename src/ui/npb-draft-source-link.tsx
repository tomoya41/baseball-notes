import { draftEvidenceSource,type DraftEvent } from "../domain/npb-draft-event";

export function DraftSourceLink({data,row,label="出典"}:{data:DraftEvent;row:{sourcePageId:number;sourceRevision?:number|undefined};label?:string}){
  const source=draftEvidenceSource(data,row);
  return source?<a className="inline-note" href={`https://ja.wikipedia.org/w/index.php?curid=${source.pageId}&oldid=${source.revision}`} aria-label={`${label} · Wikipedia ${source.title} · revision ${source.revision}`}>{label} ↗</a>:null;
}
