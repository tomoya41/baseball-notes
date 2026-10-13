import { openDataClient } from "../src/data/database";
import { auditNpbIntegrity } from "../src/data/npb-integrity-audit";
import { npbRegularSeasons } from "../src/data/npb-season-metadata";
const url=process.env.TURSO_DATABASE_URL,token=process.env.TURSO_AUTH_TOKEN;
if(!url||url.startsWith("file:")||!token)throw Error("Remote read-only connection required");
const client=openDataClient(url,token),started=performance.now();
try {
  const season=npbRegularSeasons.at(-1)!;
  const report=await auditNpbIntegrity(client,{from:season.startDate,to:season.endDate,timeZone:"Asia/Tokyo"},
    new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo"}).format(new Date()));
  // LEFT JOIN keeps Games without completeness rows visible. Null is never zero.
  console.log(JSON.stringify({queryCount:report.coverage ? 9 : 6,rows:report.pendingGames.map(r=>({...r,
    requiredEvidence:r.game_status===null?"Complete validated participants and Game/Day proof required":
      "Independent explicit final status, final inning/end outs, score and complete participants"})),
    partialDays:report.partialDays,boundaryGames:report.boundaryGames,evidenceFindings:report.evidenceFindings,inputErrors:report.inputErrors,databaseWrites:0,sourceRequests:0,
    elapsedMs:performance.now()-started}));
  if(report.inputErrors.length || report.evidenceFindings.length) throw Error("Corrupt or unavailable evidence requires review; report preserved");
} finally {client.close();}
