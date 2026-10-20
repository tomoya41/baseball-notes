import { mkdir,writeFile,readFile } from "node:fs/promises";
import { openDataClient } from "../src/data/database";
import { verifyRecoveryReadiness } from "../src/data/npb-recovery-readiness";
const mode=process.env.RECOVERY_MODE??"connection";
if(!["connection","projection"].includes(mode))throw Error("Invalid recovery mode");
const url=process.env.TURSO_DATABASE_URL,token=process.env.TURSO_AUTH_TOKEN;
if(!url||url.startsWith("file:")||!token)throw Error("Remote credentials required");
const quota=mode==="projection"?JSON.parse(await readFile(process.env.RECOVERY_QUOTA_FILE??".data/npb-recovery/quota.json","utf8")):undefined;
const client=openDataClient(url,token);
try{const report=await verifyRecoveryReadiness(client,{mode:mode as "connection"|"projection",asOfDate:process.env.RECOVERY_AS_OF??"2026-10-08",now:Date.now(),quota});await mkdir(".data/npb-recovery",{recursive:true});await writeFile(".data/npb-recovery/report.json",JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.status!=="readable")process.exitCode=1;}finally{client.close();}
