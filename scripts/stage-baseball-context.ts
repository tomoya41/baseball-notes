import {createHash} from "node:crypto";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {gunzipSync} from "node:zlib";
import {z} from "zod";
import pin from "../src/data/baseball-context-release.json";
import retained from "../src/data/baseball-context-retained-releases.json";
import {contextManifestSchema,honorsPageSchema} from "../src/domain/player-honors";
import {inningScorePageSchema} from "../src/domain/inning-score";
import {honorCatalogSchema} from "../src/domain/honor-discovery";
const hash=(b:string|Uint8Array)=>createHash("sha256").update(b).digest("hex");
async function stageGeneration(destination:string,pin:{assetUrl:string;sha256:string;bodySha256:string;manifestSha256:string;manifestBytes:number}){
 const cache=join(".data/baseball-context",`${pin.sha256}.gz`);let bytes=await readFile(cache).catch(()=>null);
 if(!bytes||hash(bytes)!==pin.sha256){const r=await fetch(pin.assetUrl,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Context release HTTP ${r.status}`);bytes=Buffer.from(await r.arrayBuffer());}
 if(bytes.length>5_000_000||hash(bytes)!==pin.sha256)throw Error("Context archive mismatch");
 const body=gunzipSync(bytes,{maxOutputLength:25_000_000});if(hash(body)!==pin.bodySha256)throw Error("Context body mismatch");
 const data=z.strictObject({schemaVersion:z.literal(1),files:z.record(z.string(),z.unknown())}).parse(JSON.parse(body.toString()));
 const manifest=contextManifestSchema.parse(data.files["manifest.json"]);const manifestText=JSON.stringify(data.files["manifest.json"]);
 if(hash(manifestText)!==pin.manifestSha256||Buffer.byteLength(manifestText)!==pin.manifestBytes||Object.keys(data.files).length!==Object.keys(manifest.files).length+1)throw Error("Context manifest mismatch");
 const output=join(destination,pin.sha256);await mkdir(output,{recursive:true});
 for(const[path,expected]of Object.entries(manifest.files)){const value=data.files[path],text=JSON.stringify(value);if(!text||Buffer.byteLength(text)!==expected.bytes||hash(text)!==expected.sha256)throw Error("Context projection mismatch");if(path.startsWith("honors/catalog/"))honorCatalogSchema.parse(value);else if(path.startsWith("honors/"))honorsPageSchema.parse(value);else inningScorePageSchema.parse(value);await mkdir(join(output,path,".."),{recursive:true});await writeFile(join(output,path),text);}
 await writeFile(join(output,"manifest.json"),manifestText);await mkdir(".data/baseball-context",{recursive:true});await writeFile(cache,bytes);
 return{files:Object.keys(data.files).length,publicBytes:Object.values(manifest.files).reduce((n,f)=>n+f.bytes,pin.manifestBytes),canonicalWrites:0};
}
export async function stageBaseballContext(destination="dist/data/baseball-context"){
 const prior=[];for(const release of retained)prior.push(await stageGeneration(destination,release));
 const current=await stageGeneration(destination,pin);return{...current,retainedFiles:prior.reduce((n,p)=>n+p.files,0)};
}
