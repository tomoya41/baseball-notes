import type { DataClient } from "./database";
import { addDays, jstToday } from "./npb-collector";
import { npbLatestStandingsSchema } from "../domain/standings";

export type FreshnessStatus = "fresh" | "stale" | "future_date" | "unreachable" | "invalid_payload";
export type HealthStatus = "healthy" | "warning" | "unhealthy";

export interface PublishedFreshness {
  status: FreshnessStatus;
  expectedEffectiveDate: string;
  publishedEffectiveDate: string | null;
  checkedAtUtc: string;
  checkedAtJst: string;
  deadlineHourJst: number;
  deadlinePassed: boolean;
  httpStatus: number | null;
  error: string | null;
}

export interface DayRunHealth {
  runId: string;
  targetDate: string;
  trigger: string;
  dayStatus: string;
  operationalStatus: string;
  finalGames: number;
  completeGames: number;
  partialGames: number;
  failedGames: number;
  batterRows: number;
  pitcherRows: number;
  backupStatus: string;
  finishedAt: string;
}

export interface IngestionHealth {
  latestScheduledRun: DayRunHealth | null;
  latestDayRun: DayRunHealth | null;
  targetDayRun: DayRunHealth | null;
  latestSuccessfulTargetDate: string | null;
  latestStandingsDate: string | null;
}

export interface ScheduledActionHealth {
  runId: number;
  startedAt: string;
  conclusion: string | null;
  url: string;
  inferredTargetDate: string;
  encryptedBackupArtifact: "present" | "missing" | "unavailable";
}

export interface NpbDailyHealth {
  freshness: PublishedFreshness;
  ingestion: IngestionHealth | null;
  scheduledAction: ScheduledActionHealth | null;
  health: HealthStatus;
  likelyFault: "collector" | "publish" | "delivery" | "unknown" | null;
  warnings: string[];
}

export function expectedNpbEffectiveDate(now = new Date()): string {
  return addDays(jstToday(now), -1);
}

export function freshnessDeadlinePassed(now: Date, deadlineHourJst: number): boolean {
  if (!Number.isInteger(deadlineHourJst) || deadlineHourJst < 0 || deadlineHourJst > 23)
    throw new Error("NPB freshness deadline hour must be an integer from 0 to 23");
  const hour = Number(new Intl.DateTimeFormat("en-GB", {timeZone:"Asia/Tokyo",hour:"2-digit",hourCycle:"h23"}).format(now));
  return hour >= deadlineHourJst;
}

export async function checkPublishedNpbFreshness(url: string, options: {
  now?: Date; deadlineHourJst?: number; request?: typeof fetch;
} = {}): Promise<PublishedFreshness> {
  const now = options.now ?? new Date();
  const deadlineHourJst = options.deadlineHourJst ?? 12;
  const base = {
    expectedEffectiveDate: expectedNpbEffectiveDate(now),
    checkedAtUtc: now.toISOString(),
    checkedAtJst: new Intl.DateTimeFormat("sv-SE", {timeZone:"Asia/Tokyo",dateStyle:"short",timeStyle:"medium"}).format(now),
    deadlineHourJst, deadlinePassed: freshnessDeadlinePassed(now,deadlineHourJst),
  };
  let response: Response;
  try {
    const requestUrl = new URL(url);
    requestUrl.searchParams.set("npb_freshness_check", String(now.getTime()));
    response = await (options.request ?? fetch)(requestUrl.toString(), {
      cache:"no-store", headers:{"Cache-Control":"no-cache",Pragma:"no-cache"}, signal:AbortSignal.timeout(10_000),
    });
  } catch (error) {
    return {...base,status:"unreachable",publishedEffectiveDate:null,httpStatus:null,error:String(error)};
  }
  if (!response.ok)
    return {...base,status:"unreachable",publishedEffectiveDate:null,httpStatus:response.status,error:`HTTP ${response.status}`};
  try {
    const body = await response.text();
    if (body.length > 1_000_000) throw new Error("Oversized published payload");
    const payload = npbLatestStandingsSchema.parse(JSON.parse(body) as unknown);
    const publishedEffectiveDate = payload.effectiveDate;
    const status: FreshnessStatus = publishedEffectiveDate === base.expectedEffectiveDate ? "fresh" :
      publishedEffectiveDate < base.expectedEffectiveDate ? "stale" : "future_date";
    return {...base,status,publishedEffectiveDate,httpStatus:response.status,error:null};
  } catch (error) {
    return {...base,status:"invalid_payload",publishedEffectiveDate:null,httpStatus:response.status,error:String(error)};
  }
}

const dayRunSql = `SELECT run_id,target_date,trigger_kind,day_status,operational_status,final_games,
  complete_games,partial_games,failed_games,batter_rows,pitcher_rows,backup_status,finished_at
  FROM npb_day_runs`;

function dayRun(row: Record<string, unknown> | undefined): DayRunHealth | null {
  if (!row) return null;
  return {
    runId:String(row.run_id),targetDate:String(row.target_date),trigger:String(row.trigger_kind),
    dayStatus:String(row.day_status),operationalStatus:String(row.operational_status),
    finalGames:Number(row.final_games),completeGames:Number(row.complete_games),
    partialGames:Number(row.partial_games),failedGames:Number(row.failed_games),
    batterRows:Number(row.batter_rows),pitcherRows:Number(row.pitcher_rows),
    backupStatus:String(row.backup_status),finishedAt:String(row.finished_at),
  };
}

export async function diagnoseNpbIngestion(client: DataClient, targetDate: string): Promise<IngestionHealth> {
  const [scheduled,latest,target,successful,standings] = await Promise.all([
    client.execute(`${dayRunSql} WHERE trigger_kind='scheduled' ORDER BY finished_at DESC LIMIT 1`),
    client.execute(`${dayRunSql} ORDER BY finished_at DESC LIMIT 1`),
    client.execute({sql:`${dayRunSql} WHERE target_date=? ORDER BY finished_at DESC LIMIT 1`,args:[targetDate]}),
    client.execute(`${dayRunSql} WHERE day_status IN ('complete','no_games') AND operational_status!='failed'
      ORDER BY target_date DESC,finished_at DESC LIMIT 1`),
    client.execute("SELECT MAX(snapshot_date) AS date FROM standings_daily WHERE league='NPB'"),
  ]);
  return {
    latestScheduledRun:dayRun(scheduled.rows[0]),latestDayRun:dayRun(latest.rows[0]),
    targetDayRun:dayRun(target.rows[0]),
    latestSuccessfulTargetDate:successful.rows[0]?.target_date === undefined ? null : String(successful.rows[0].target_date),
    latestStandingsDate:standings.rows[0]?.date == null ? null : String(standings.rows[0].date),
  };
}

export async function inspectLatestScheduledAction(repository: string, token?: string,
  request: typeof fetch = fetch): Promise<ScheduledActionHealth | null> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error("Invalid GitHub repository");
  const headers:Record<string,string>={Accept:"application/vnd.github+json","User-Agent":"BaseballDataAppFreshness/0.1"};
  if(token) headers.Authorization=`Bearer ${token}`;
  const root=`https://api.github.com/repos/${repository}`;
  const runsResponse=await request(`${root}/actions/workflows/daily-collector.yml/runs?event=schedule&per_page=1`,
    {headers,signal:AbortSignal.timeout(10_000)});
  if(!runsResponse.ok) throw new Error(`GitHub scheduled-run lookup HTTP ${runsResponse.status}`);
  const runs=await runsResponse.json() as {workflow_runs?:unknown};
  if(!Array.isArray(runs.workflow_runs)) throw new Error("Invalid GitHub scheduled-run response");
  const run=runs.workflow_runs[0] as Record<string,unknown>|undefined;
  if(!run) return null;
  if(typeof run.id!=="number" || typeof run.run_started_at!=="string" ||
    typeof run.html_url!=="string" || (run.conclusion!==null && typeof run.conclusion!=="string"))
    throw new Error("Invalid GitHub scheduled-run record");
  const artifactsResponse=await request(`${root}/actions/runs/${run.id}/artifacts?per_page=100`,
    {headers,signal:AbortSignal.timeout(10_000)});
  let encryptedBackupArtifact:ScheduledActionHealth["encryptedBackupArtifact"]="unavailable";
  if(artifactsResponse.ok) {
    const payload=await artifactsResponse.json() as {artifacts?:unknown};
    if(!Array.isArray(payload.artifacts)) throw new Error("Invalid GitHub artifact response");
    encryptedBackupArtifact=payload.artifacts.some((item:unknown)=>{
      if(!item || typeof item!=="object") return false;
      const artifact=item as Record<string,unknown>;
      return artifact.name===`npb-facts-encrypted-${run.id}` && artifact.expired===false;
    }) ? "present" : "missing";
  }
  return {runId:run.id,startedAt:run.run_started_at,conclusion:run.conclusion,
    url:run.html_url,inferredTargetDate:expectedNpbEffectiveDate(new Date(run.run_started_at)),
    encryptedBackupArtifact};
}

export function evaluateNpbDailyHealth(freshness: PublishedFreshness, ingestion: IngestionHealth | null,
  scheduledAction: ScheduledActionHealth | null = null): NpbDailyHealth {
  const warnings:string[]=[];
  if(freshness.status!=="fresh") warnings.push(`Published payload: ${freshness.status}`);
  if(!ingestion) warnings.push("Turso diagnostics unavailable");
  else {
    if(ingestion.latestStandingsDate!==freshness.expectedEffectiveDate)
      warnings.push(`Turso standings date: ${ingestion.latestStandingsDate??"missing"}`);
    const day=ingestion.targetDayRun;
    if(!day) warnings.push("Target Day ingestion run missing");
    else {
      if(day.dayStatus!=="complete" && day.dayStatus!=="no_games") warnings.push(`Day ingestion: ${day.dayStatus}`);
      if(day.operationalStatus!=="succeeded") warnings.push(`Day operation: ${day.operationalStatus}`);
      if(day.finalGames>0 && day.backupStatus!=="exported") warnings.push(`Backup export: ${day.backupStatus}`);
    }
  }
  if(scheduledAction && scheduledAction.inferredTargetDate===freshness.expectedEffectiveDate &&
    ingestion?.targetDayRun?.trigger==="scheduled" &&
    scheduledAction.encryptedBackupArtifact!=="present" && ingestion.targetDayRun.finalGames>0)
    warnings.push(`Scheduled encrypted backup Artifact: ${scheduledAction.encryptedBackupArtifact}`);
  if(scheduledAction?.inferredTargetDate===freshness.expectedEffectiveDate &&
    scheduledAction.conclusion!=="success")
    warnings.push(`Scheduled GitHub Action: ${scheduledAction.conclusion??"in progress"}`);
  const likelyFault:NpbDailyHealth["likelyFault"] = freshness.status==="fresh" ? null :
    freshness.status==="unreachable" || freshness.status==="invalid_payload" ? "delivery" :
    !ingestion ? "unknown" :
    ingestion.latestStandingsDate===freshness.expectedEffectiveDate ? "publish" : "collector";
  const health:HealthStatus = freshness.status!=="fresh" ?
    (freshness.deadlinePassed ? "unhealthy" : "warning") : warnings.length ? "warning" : "healthy";
  return {freshness,ingestion,scheduledAction,health,likelyFault,warnings};
}
