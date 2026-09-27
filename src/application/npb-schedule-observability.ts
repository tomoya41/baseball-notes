// GitHub schedule events supply a cron string, not the intended trigger instant.
// Hourly expected slot is inferred from run creation and is a LOWER BOUND on delay.
export function scheduleObservation(input:{workflowName:string;cron:string;runCreatedAt:string;
  runnerStartedAt:string;targetDate:string;timezone?:"Asia/Tokyo"|"UTC"}) {
  const [minute,hour]=input.cron.split(" ");
  if(!/^\d+$/.test(minute??"")||!(hour==="*"||/^\d+$/.test(hour??"")))throw Error("Unsupported cron observation");
  if(Number(minute)>59||(hour!=="*"&&Number(hour)>23))throw Error("Invalid cron time");
  const zone=input.timezone??"Asia/Tokyo",shift=zone==="Asia/Tokyo"?9*3600_000:0;
  const created=new Date(input.runCreatedAt).getTime(),actual=new Date(input.runnerStartedAt).getTime();
  if(!Number.isFinite(created)||!Number.isFinite(actual))throw Error("Invalid workflow timestamp");
  const local=new Date(created+shift);
  local.setUTCSeconds(0,0);local.setUTCMinutes(Number(minute));
  if(hour!=="*")local.setUTCHours(Number(hour));
  if(local.getTime()>created+shift)local.setTime(local.getTime()-(hour==="*"?3600_000:86400_000));
  const expected=local.getTime()-shift,delayMinutes=Math.max(0,(actual-expected)/60_000);
  return {workflowName:input.workflowName,expectedScheduledAt:new Date(expected).toISOString(),
    runnerStartedAt:input.runnerStartedAt,delayMinutes,timezone:zone,targetJstDate:input.targetDate,
    expectedScheduledAtMethod:"latest_cron_slot_before_run_creation",delayIsLowerBound:true,
    delayClassification:delayMinutes<10?"on_time":delayMinutes<60?"delayed":"severely_delayed",
    runCreationToRunnerMinutes:(actual-created)/60_000};
}
