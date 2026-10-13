import { expect, test, vi } from "vitest";
import { openDataClient, migrateData } from "../src/data/database";
import { auditNpbIntegrity, hashNpbIntegrity } from "../src/data/npb-integrity-audit";
import { inspectNpbCalendar } from "../src/data/npb-season-lifecycle";

test("read-only audit retains null scores, missing proof, pending boundary Games and partial Day causes", async () => {
  const client = openDataClient("file::memory:");
  try {
    await migrateData(client);
    const insert = async (id: string, date: string, status: string, score: number | null) => client.execute({ sql:
      "INSERT INTO npb_games VALUES (?,2026,?,?,'away',1,NULL,NULL,?,?,?,'nf3',?,'https://nf3.sakura.ne.jp/','2026-10-01','hash')",
      args: [id, date, id, status, score, score, id] });
    await insert("missing-proof", "2026-10-07", "final", 0);
    await insert("makeup", "2026-10-08", "final", 4);
    await insert("not-started", "2026-10-06", "scheduled", null);
    await insert("postponed", "2026-10-06", "postponed", null);
    await insert("future", "2026-10-14", "scheduled", null);
    await insert("inconsistent-proof", "2026-10-07", "final", 1);
    await client.execute(`INSERT INTO npb_game_completeness VALUES ('inconsistent-proof','partial','complete','complete',
      18,18,18,2,2,2,'broken','[','nf3','2026-10-08T00:00:00Z')`);
    await client.execute(`INSERT INTO permanent_events VALUES ('npb:shortened-final:inconsistent-proof','shortened-final',
      '2026-10-07','inconsistent-proof','{broken','nf3','inconsistent-proof','2026-10-08')`);
    await insert("missing-stored-facts", "2026-10-07", "final", 2);
    await client.execute(`INSERT INTO npb_game_completeness VALUES ('missing-stored-facts','complete','complete','complete',
      18,18,18,2,2,2,'{}','[]','nf3','2026-10-08T00:00:00Z')`);
    await client.execute(`INSERT INTO npb_ingestion_stages VALUES ('2026-10-07','games','complete',1,'2026-10-08',NULL)`);
    await client.execute(`INSERT INTO npb_day_runs VALUES ('run','2026-10-07','manual','2026-10-08','2026-10-08',
      'partial','completed_with_warning',1,1,0,1,0,0,0,0,1,0,'not_exported','missing proof')`);
    const before = await hashNpbIntegrity(client);
    const execute = vi.spyOn(client, "execute");
    const result = await auditNpbIntegrity(client, { from: "2026-10-06", to: "2026-10-07", timeZone: "Asia/Tokyo" }, "2026-10-13");
    expect(result.pendingGames.map(r => r.game_id)).toEqual(["not-started", "inconsistent-proof", "missing-proof", "missing-stored-facts", "makeup"]);
    expect(result.pendingGames[0]?.home_score).toBeNull();
    expect(result.pendingGames[2]?.checks).toBeNull();
    expect(result.pendingGames[1]).toMatchObject({ checks:null,issues:null,shortenedEvidence:null,
      evidenceErrors:[{field:"checks_json",reason:"invalid_json"},{field:"issues_json",reason:"invalid_json"},{field:"shortened_evidence",reason:"invalid_json"}] });
    expect(result.pendingGames[3]?.integrityErrors).toContain("complete_proof_fact_count_mismatch");
    expect(result.boundaryGames.map(r => r.game_id)).toEqual(["inconsistent-proof", "missing-proof", "missing-stored-facts", "makeup", "future"]);
    expect(result.partialDays).toMatchObject([{ date: "2026-10-06", status: "unknown", latestRun: null },
      { date: "2026-10-07", status: "partial", latestRun: { error_summary: "missing proof" } }]);
    expect(result.coverage.summary).toMatchObject({ complete: 0, partial: 1, unknown: 1 });
    for (const [statement] of execute.mock.calls) expect(typeof statement === "string" ? statement : (statement as { sql: string }).sql).toMatch(/^SELECT /);
    expect((await inspectNpbCalendar(client, "2026-10-13")).pendingSavedGames).toBe(5);
    expect(await hashNpbIntegrity(client)).toEqual(before);
  } finally { client.close(); }
});

test("valid JSON with invalid evidence shapes is reported, not accepted as proof", async () => {
  const client=openDataClient("file::memory:");
  try {
    await migrateData(client);
    await client.execute(`INSERT INTO npb_games VALUES ('bad-shape',2026,'2026-10-07','home','away',1,NULL,NULL,'final',0,0,
      'nf3','bad-shape','https://nf3.sakura.ne.jp/','2026-10-08','hash')`);
    await client.execute(`INSERT INTO npb_game_completeness VALUES ('bad-shape','complete','complete','complete',
      18,18,18,2,2,2,'[]','{}','nf3','2026-10-08T00:00:00Z')`);
    await client.execute(`INSERT INTO permanent_events VALUES ('npb:shortened-final:bad-shape','shortened-final',
      '2026-10-07','bad-shape','{}','nf3','bad-shape','2026-10-08')`);
    const result=await auditNpbIntegrity(client,{from:"2026-10-07",to:"2026-10-08",timeZone:"Asia/Tokyo"},"2026-10-13");
    expect(result.pendingGames[0]?.evidenceErrors).toMatchObject([
      {field:"checks_json",reason:"invalid_shape"},{field:"issues_json",reason:"invalid_shape"},
      {field:"shortened_evidence",reason:"invalid_shape"}]);
  } finally { client.close(); }
});
