import { expect,it,vi } from "vitest";
import { readFile } from "node:fs/promises";
import { migrateData,openDataClient } from "../src/data/database";
import { hashNpbIntegrity } from "../src/data/npb-integrity-audit";
import { assertRecoveryQuota,verifyRecoveryReadiness,recoveryAbortFetch } from "../src/data/npb-recovery-readiness";
it("defaults operational verification to a probe and retains the full path only after a successful probe",async()=>{
  const workflow=await readFile(".github/workflows/npb-period-batch-readonly.yml","utf8");
  expect(workflow).toMatch(/connection_only:[\s\S]*?default: true/);expect(workflow).not.toMatch(/Minimal read-only connection probe\s*\n\s*if:/);
});
it("requires recent Free quota headroom before production projection and never treats a successful read as integrity/scheduled evidence",async()=>{
  const client=openDataClient("file::memory:");try{
    await migrateData(client);const before=await hashNpbIntegrity(client),now=Date.parse("2026-10-20T10:00:00Z"),q={plan:"Free",monthlyRowsReadLimit:500000000,rowsReadUsed:100000000,observedAt:"2026-10-20T09:00:00Z"};
    expect(()=>assertRecoveryQuota({...q,rowsReadUsed:561729860},now)).toThrow();expect(()=>assertRecoveryQuota({...q,observedAt:"2026-10-18T00:00:00Z"},now)).toThrow();
    const probe=await verifyRecoveryReadiness(client,{mode:"connection",asOfDate:"2026-10-08",now});expect(probe.attempted).toBe(1);expect(probe.integrityVerified).toBe(false);
    const result=await verifyRecoveryReadiness(client,{mode:"projection",asOfDate:"2026-10-08",now,quota:q});expect(result.status).toBe("readable");expect(result.attempted).toBeLessThanOrEqual(8);expect(result.scheduledEvidence).toBe(false);expect(result.scannedRows).toBe("not_exposed_by_client");expect(await hashNpbIntegrity(client)).toEqual(before);
  }finally{client.close();}
});
it("stops at one blocked probe with sanitized failure, no retries and no table reads",async()=>{
  const source=openDataClient("file::memory:");let calls=0;
  const fail=new Proxy(source,{get(t,k){if(k==="execute")return()=>{calls++;throw Error("SQL read operations are forbidden secret database url");};return Reflect.get(t,k);}});
  try{const r=await verifyRecoveryReadiness(fail,{mode:"connection",asOfDate:"2026-10-08",now:Date.now()});expect(r.status).toBe("reads_blocked");expect(r.attempted).toBe(1);expect(calls).toBe(1);expect(JSON.stringify(r)).not.toContain("secret");}finally{source.close();}
});
it("aborts an in-flight HTTP read and returns failure at the deadline even when the provider never resolves",async()=>{
  vi.useFakeTimers();const underlying=openDataClient("file::memory:"),abort=new AbortController();let requests=0,transportAborted=false,closed=false;
  const transport=recoveryAbortFetch(abort.signal,((_input,init)=>{requests++;return new Promise((_resolve,reject)=>{init!.signal!.addEventListener("abort",()=>{transportAborted=true;reject(Error("aborted"));});});}) as typeof fetch);
  const source=new Proxy(underlying,{get(t,k){if(k==="execute")return()=>transport("https://example.test/recovery");if(k==="close")return()=>{closed=true;t.close();};return Reflect.get(t,k);}});
  try{const pending=verifyRecoveryReadiness(source,{mode:"connection",asOfDate:"2026-10-08",now:Date.now(),cancelReads:()=>abort.abort()});await vi.advanceTimersByTimeAsync(30001);const result=await pending;expect(result.status).toBe("verification_failed");expect(requests).toBe(1);expect(transportAborted).toBe(true);expect(closed).toBe(true);expect(result.integrityVerified).toBe(false);}finally{vi.useRealTimers();underlying.close();}
});
