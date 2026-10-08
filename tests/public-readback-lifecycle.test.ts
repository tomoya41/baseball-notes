import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import { parse } from "yaml";
import { expect, it } from "vitest";

it("the deployed public readback exits after draining a large NPB response", async () => {
  const workflow = parse(await readFile(".github/workflows/mlb-historical-publish.yml", "utf8"));
  const step = workflow.jobs.deploy.steps.find((s: { name?: string }) => s.name === "Verify public Historical and NPB payloads");
  const command = /node --input-type=module -e "([^"]+)"/.exec(step.run)?.[1];
  expect(command).toBeDefined();
  const manifest = gzipSync(JSON.stringify({ seasons: [2020, 2021, 2022, 2023, 2024, 2025], current2026: "unavailable" }));
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
    const result = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", code], { timeout: 8_000 });
    expect(JSON.parse(result.stdout.trim())).toEqual({ mlb: 200, npb: 200, seasons: 6 });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}, 12_000);
