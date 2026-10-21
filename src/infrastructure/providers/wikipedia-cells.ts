/** Separate top-level cells without splitting article links or nested templates. */
export function splitWikipediaCells(text:string,separator:string):string[]{
  const result:string[]=[];let link=0,template=0,start=0;
  for(let i=0;i<text.length;i++){
    const pair=text.slice(i,i+2);
    if(pair==="[["){link++;i++;}else if(pair==="]]"){link--;i++;}
    else if(pair==="{{"){template++;i++;}else if(pair==="}}"){template--;i++;}
    else if(!link&&!template&&text.startsWith(separator,i)){result.push(text.slice(start,i));start=i+separator.length;i+=separator.length-1;}
  }
  result.push(text.slice(start));return result;
}
