import type { DataClient } from "./database";
import { diagnoseNpbIngestion, type IngestionHealth } from "./npb-freshness";
import { inspectNpbCalendar } from "./npb-season-lifecycle";

export interface NpbDiagnosticError {
  kind: "database_read_blocked" | "database_unavailable";
  code: "BLOCKED" | "UNAVAILABLE";
}

// Provider messages can contain SQL, URLs or credentials. Only emit fixed codes;
// BLOCKED does not establish the owner's quota, plan or reset date.
export function safeNpbDiagnosticError(error: unknown): NpbDiagnosticError {
  const blocked = error !== null && typeof error === "object" && "code" in error && error.code === "BLOCKED";
  return blocked ? { kind: "database_read_blocked", code: "BLOCKED" } :
    { kind: "database_unavailable", code: "UNAVAILABLE" };
}

/** One bounded diagnostic attempt. Failed ingestion skips calendar queries;
 * callers can still report independent public/Scheduled evidence and fail health. */
export async function inspectNpbDatabaseDiagnostics(targetDate: string, open: () => DataClient,
  readers = { ingestion: diagnoseNpbIngestion, lifecycle: inspectNpbCalendar },permission:"open"|"deferred"|"invalid"="open") {
  let ingestion: IngestionHealth | null = null;
  let lifecycle: Awaited<ReturnType<typeof inspectNpbCalendar>> | null = null;
  let ingestionError: NpbDiagnosticError | null = null;
  let lifecycleError: NpbDiagnosticError | null = null;
  if(permission!=="open")return {ingestion,ingestionError:permission==="deferred"?{kind:"database_read_blocked" as const,code:"BLOCKED" as const}:{kind:"database_unavailable" as const,code:"UNAVAILABLE" as const},lifecycle,lifecycleError};
  let client: DataClient | undefined;
  try {
    client = open();
    ingestion = await readers.ingestion(client, targetDate);
    try { lifecycle = await readers.lifecycle(client, targetDate); }
    catch (error) { lifecycleError = safeNpbDiagnosticError(error); }
  } catch (error) { ingestionError = safeNpbDiagnosticError(error); }
  finally {
    try { client?.close(); }
    catch (error) { ingestionError ??= safeNpbDiagnosticError(error); }
  }
  return { ingestion, ingestionError, lifecycle, lifecycleError };
}
