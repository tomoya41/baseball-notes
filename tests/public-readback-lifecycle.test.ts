import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import { parse } from "yaml";
import { expect, it } from "vitest";

it.each([
  { mode: "app-only", years: [2020, 2021, 2022, 2023, 2024, 2025], valid: true },
  { mode: "expansion", years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], valid: true },
  { mode: "app-only", years: [2020, 2020, 2020, 2020, 2020, 2020], valid: false },
  { mode: "expansion", years: [2020, 2021, 2022, 2023, 2024, 2025], valid: false },
])("public readback drains NPB response and validates exact years: $mode $years", async ({ mode, years, valid }) => {
  const workflow = parse(await readFile(".github/workflows/mlb-historical-publish.yml", "utf8"));
  const step = workflow.jobs.deploy.steps.find((s: { name?: string }) => s.name === "Verify public Historical and NPB payloads");
  const command = /node --input-type=module -e "([^"]+)"/.exec(step.run)?.[1];
  expect(command).toBeDefined();
  const manifest = gzipSync(JSON.stringify({ seasons: years.map(season => ({ season, coverage: "complete" })), current2026: "unavailable" }));
  // Exceed the stream buffer: an unread response can leave Node running after it logs success.
  const season = Buffer.from(JSON.stringify({ padding: "x".repeat(3_000_000) }));
  const server = createServer((request, response) => {
    const body = request.url?.startsWith("/data/mlb/") ? manifest : season;
    response.writeHead(200, { "Content-Length": body.length });
    response.end(body);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");
    const code = command!.replace("https://tomoya41.github.io/baseball-notes/", `http://127.0.0.1:${address.port}/`);
    const result = promisify(execFile)(process.execPath, ["--input-type=module", "-e", code], { timeout: 8_000, env: { ...process.env, MLB_PUBLISH_MODE: mode } });
    if (valid) expect(JSON.parse((await result).stdout.trim())).toEqual({ mlb: 200, npb: 200, seasons: years.length });
    else await expect(result).rejects.toThrow("Historical public contract");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}, 12_000);
