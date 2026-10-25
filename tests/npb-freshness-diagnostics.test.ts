import { describe, expect, it, vi } from "vitest";
import type { DataClient } from "../src/data/database";
import { inspectNpbDatabaseDiagnostics } from "../src/data/npb-freshness-diagnostics";
import { evaluateNpbDailyHealth, failsRequiredNpbHealth, type PublishedFreshness } from "../src/data/npb-freshness";

const date="2026-10-24";
const freshness:PublishedFreshness={status:"stale",expectedEffectiveDate:date,publishedEffectiveDate:"2026-10-12",
  checkedAtUtc:"2026-10-25T08:28:00Z",checkedAtJst:"2026-10-25 17:28:00",deadlineHourJst:12,
  deadlinePassed:true,httpStatus:200,error:null};
const saved={latestScheduledRun:null,latestDayRun:null,targetDayRun:null,latestSuccessfulTargetDate:null,latestStandingsDate:null};

describe("bounded NPB database diagnostics",()=>{
  it("reports BLOCKED without secrets, retry or calendar queries, retaining independent stale health",async()=>{
    const close=vi.fn(),client={close} as unknown as DataClient;
    const ingestion=vi.fn().mockRejectedValue(Object.assign(new Error("libsql://private?token=secret SELECT *"),{code:"BLOCKED"}));
    const lifecycle=vi.fn();
    const result=await inspectNpbDatabaseDiagnostics(date,()=>client,{ingestion,lifecycle});
    expect(ingestion).toHaveBeenCalledExactlyOnceWith(client,date);expect(lifecycle).not.toHaveBeenCalled();expect(close).toHaveBeenCalledOnce();
    expect(result).toEqual({ingestion:null,lifecycle:null,lifecycleError:null,ingestionError:{kind:"database_read_blocked",code:"BLOCKED"}});
    expect(JSON.stringify(result)).not.toMatch(/secret|SELECT|libsql/);
    const summary=evaluateNpbDailyHealth(freshness,result.ingestion);
    expect(summary.freshness.status).toBe("stale");expect(summary.likelyFault).toBe("unknown");
    expect(failsRequiredNpbHealth(summary,Boolean(result.ingestionError))).toBe(true);
    expect(failsRequiredNpbHealth(evaluateNpbDailyHealth({...freshness,status:"fresh",publishedEffectiveDate:date},null),true)).toBe(true);
  });
  it("handles connection creation failure without invoking SQL readers",async()=>{
    const ingestion=vi.fn(),lifecycle=vi.fn();
    const result=await inspectNpbDatabaseDiagnostics(date,()=>{throw new Error("secret URL");},{ingestion,lifecycle});
    expect(result.ingestionError).toEqual({kind:"database_unavailable",code:"UNAVAILABLE"});
    expect(ingestion).not.toHaveBeenCalled();expect(lifecycle).not.toHaveBeenCalled();
  });
  it("retains successful ingestion but never fabricates lifecycle evidence after an inspection failure",async()=>{
    const close=vi.fn(),client={close} as unknown as DataClient;
    const result=await inspectNpbDatabaseDiagnostics(date,()=>client,{ingestion:vi.fn().mockResolvedValue(saved),lifecycle:vi.fn().mockRejectedValue(new Error("token=secret"))});
    expect(result.ingestion).toEqual(saved);expect(result.ingestionError).toBeNull();expect(result.lifecycle).toBeNull();
    expect(result.lifecycleError?.code).toBe("UNAVAILABLE");expect(close).toHaveBeenCalledOnce();
  });
  it("preserves the normal independent calendar inspection and closes the connection",async()=>{
    const close=vi.fn(),client={close} as unknown as DataClient,lifecycle=vi.fn().mockResolvedValue(null);
    const result=await inspectNpbDatabaseDiagnostics(date,()=>client,{ingestion:vi.fn().mockResolvedValue(saved),lifecycle});
    expect(lifecycle).toHaveBeenCalledExactlyOnceWith(client,date);expect(close).toHaveBeenCalledOnce();
    expect(result).toEqual({ingestion:saved,ingestionError:null,lifecycle:null,lifecycleError:null});
  });
});
