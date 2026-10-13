export const dayFactsStepName = "Collect all final Games for the preceding JST day";

// A successful workflow can have skipped all ingestion. Only the actual completed
// collection step admits its callback. This is NOT a replacement for the HOT gate.
export function hasCompletedDayFacts(jobs: unknown): boolean {
  if (!Array.isArray(jobs)) return false;
  return jobs.some(job => job && typeof job === "object" && job.status === "completed" &&
    job.conclusion === "success" && Array.isArray(job.steps) && job.steps.some((step: unknown) => {
      if (!step || typeof step !== "object") return false;
      const value = step as Record<string, unknown>;
      return value.name === dayFactsStepName && value.status === "completed" && value.conclusion === "success";
    }));
}
