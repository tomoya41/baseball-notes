import { mkdir,readFile,writeFile } from "node:fs/promises";
import { dirname,join } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { validStaticPayload } from "../../src/domain/mlb-historical-public";
import { japaneseHistoricalPayload } from "../../src/domain/mlb-japanese-display";

/** Read admitted static app projections only; never a provider or Current API. */
export function weeklyPublicReader(root=".data/npb-ai-insights/weekly-public-cache") {
  let requests=0,downloadedBytes=0;
  const read=async<T>(path:string):Promise<T>=>{
    if(!/^(postseason\/)?(manifest|players\/(index|mlb_player_[a-f0-9-]{36})|chronology\/20\d{2}|exploration\/form\/20\d{2}\/(index|20\d{2}-\d{2})|schedule\/20\d{2}\/20\d{2}-\d{2}-\d{2})\.json$/.test(path))throw Error("Unsupported weekly static path");
    const file=join(root,`${path}.gz`),meta=await readFile(`${file}.meta.json`,"utf8").then(s=>JSON.parse(s) as {etag:string;sha256:string},()=>null);
    const response=await fetch(`https://tomoya41.github.io/baseball-notes/data/mlb/historical/${path}.gz`,{
      headers:meta?.etag?{"If-None-Match":meta.etag}:{},signal:AbortSignal.timeout(20000),redirect:"error",cache:"no-cache"});requests++;
    let bytes:Buffer;
    if(response.status===304){bytes=await readFile(file);if(createHash("sha256").update(bytes).digest("hex")!==meta?.sha256)throw Error("Weekly cache hash mismatch");}
    else{
      if(!response.ok||!response.body)throw Error(`Weekly static HTTP ${response.status}`);
      const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
      try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>1_000_000)throw Error("Weekly static byte limit");parts.push(p.value);}}finally{await reader.cancel();}
      bytes=Buffer.concat(parts);downloadedBytes+=bytes.length;
    }
    const raw=bytes[0]===31&&bytes[1]===139?gunzipSync(bytes,{maxOutputLength:8_000_000}):bytes;
    if(raw.length>8_000_000)throw Error("Weekly expanded byte limit");
    const value:unknown=JSON.parse(raw.toString("utf8"));if(!validStaticPayload(path,value))throw Error("Invalid weekly static contract");
    if(response.status!==304){await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes);await writeFile(`${file}.meta.json`,JSON.stringify({etag:response.headers.get("etag")??"",sha256:createHash("sha256").update(bytes).digest("hex")}));}
    return japaneseHistoricalPayload(path.replace(/^postseason\//,""),value) as T;
  };
  return {read,stats:()=>({requests,downloadedBytes})};
}
