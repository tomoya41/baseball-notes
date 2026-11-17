import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { GameManifest } from "../src/domain/npb-game-index";
import { preserveNpbPublicGameDates } from "../scripts/lib/preserve-npb-public-game-dates";

const manifest: GameManifest = { schemaVersion: 1, league: "NPB", from: "2026-10-05", to: "2026-10-12",
  effectiveDate: "2026-10-12", generatedAt: "2026-10-14T15:05:03.165Z" };
const dayBody = (date: string, generatedAt = manifest.generatedAt) => JSON.stringify({
  schemaVersion: 1, league: "NPB", date, generatedAt, coverage: "unknown", games: [],
}, null, 2) + "\n";
const dateOf = (path: string) => basename(path, ".json");

let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "npb-preserve-dates-")); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

it("reads at most four dates at once and preserves the validated response bytes", async () => {
  let active = 0, peak = 0;
  const read = vi.fn(async (path: string) => {
    peak = Math.max(peak, ++active);
    await setImmediate();
    active--;
    return new Response(dayBody(dateOf(path)));
  });
  expect(await preserveNpbPublicGameDates(root, manifest, read)).toBe(8);
  expect(peak).toBe(4);
  expect(read).toHaveBeenCalledTimes(8);
  for (const [path] of read.mock.calls)
    expect(await readFile(join(root, path), "utf8")).toBe(dayBody(dateOf(path)));
});

it.each([
  { scenario: "HTTP 503", response: () => new Response(null, { status: 503, headers: { "Retry-After": "30" } }), error: "HTTP 503" },
  { scenario: "a wrong date", response: () => new Response(dayBody("2026-10-06")), error: "Game date or generation differs" },
  { scenario: "a wrong generation", response: () => new Response(dayBody("2026-10-05", "2026-10-13T15:05:03.165Z")), error: "Game date or generation differs" },
])("leaves the batch unstaged and stops requesting later dates on $scenario", async ({ response, error }) => {
  const read = vi.fn(async (path: string) => dateOf(path) === manifest.from ? response() : new Response(dayBody(dateOf(path))));
  await expect(preserveNpbPublicGameDates(root, manifest, read)).rejects.toThrow(`${error}: games/dates/2026-10-05.json`);
  expect(read).toHaveBeenCalledTimes(4);
  expect(await readdir(join(root, "games/dates"))).toEqual([]);
});
