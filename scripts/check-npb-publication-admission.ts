import { appendFile } from "node:fs/promises";
import { hasCompletedDayFacts } from "../src/data/npb-publication-admission";

const runId = process.env.NPB_TRIGGER_RUN_ID;
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (!runId || !/^\d+$/.test(runId) || !repository || !/^[\w.-]+\/[\w.-]+$/.test(repository) || !token)
  throw Error("Trusted triggering Run and Actions read permission required");
const jobs: unknown[] = [];
for (let page = 1; page <= 10; page++) {
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs/${runId}/jobs?per_page=100&page=${page}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw Error(`Triggering Run jobs unavailable: HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("jobs" in data) || !Array.isArray(data.jobs)) throw Error("Invalid Actions jobs response");
  jobs.push(...data.jobs);
  if (data.jobs.length < 100) break;
  if (page === 10) throw Error("Actions jobs limit exceeded");
}
const admitted = hasCompletedDayFacts(jobs);
console.log(JSON.stringify({ runId, admitted, reason: admitted ? "completed_day_facts" : "no_completed_day_facts" }));
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `admitted=${admitted}\n`);
