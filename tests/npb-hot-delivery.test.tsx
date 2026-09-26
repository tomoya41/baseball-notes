import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { npbHotPayloadSchema, type NpbHotPayload } from "../src/application/npb-hot-payload";
import { StaticHotRepository } from "../src/infrastructure/providers/static-hot-repository";
import { expectedNpbHotDate } from "../src/domain/npb-hot-date";
import { NpbHotView } from "../src/ui/npb-hot";
import { preservePublishedNpbHot } from "../src/data/npb-hot-preservation";
import { parseNf3Standings } from "../src/data/npb-nf3";

const date = "2026-09-25";
const common = { rank: 1, teamId: "npb:team:tigers", teamName: "阪神",
  position: "投手", rankInputs: { primary: 0, first: 9, second: 18, third: 24 } };
const ready = npbHotPayloadSchema.parse({
  schemaVersion: 1, league: "NPB", generatedAt: "2026-09-26T00:00:00.000Z", effectiveDate: date,
  period: { type: "7d", from: "2026-09-19", to: date },
  readiness: { status: "ready", scheduledProductionEvidence: true, reasons: [], categories: {
    batting: { status: "ready", eligiblePlayers: 1 }, starters: { status: "ready", eligiblePlayers: 1 },
    relievers: { status: "ready", eligiblePlayers: 1 },
  } },
  coverage: { status: "complete", completePlayers: 3, candidateCount: 3,
    eligibleBatters: 1, eligibleStarters: 1, eligibleRelievers: 1 },
  batting: [{ ...common, role: "batter", playerId: "batter-id", displayName: "打者A",
    reason: "直近7日 OPS 1.200", primaryMetric: { id: "OPS", value: 1.2 },
    rankInputs: { primary: 1.2, first: 28, second: 2, third: 8, playerId: "batter-id" },
    sample: { games: 6, pa: 28, ab: 24, hr: 2 } }],
  starters: [{ ...common, role: "starter", playerId: "starter-id", displayName: "先発A",
    reason: "直近7日 防御率 0.00", primaryMetric: { id: "ERA", value: 0 },
    rankInputs: { ...common.rankInputs, playerId: "starter-id" },
    sample: { appearances: 1, starts: 1, reliefAppearances: 0, outsRecorded: 18, bf: 24, k9: 9 } }],
  relievers: [{ ...common, role: "reliever", playerId: "reliever-id", displayName: "救援A",
    reason: "直近7日 防御率 0.00", primaryMetric: { id: "ERA", value: 0 },
    rankInputs: { primary: 0, first: 12, second: 2, third: 7, playerId: "reliever-id" },
    sample: { appearances: 2, starts: 0, reliefAppearances: 2, outsRecorded: 7, k9: 12 } }],
});
const notReady: NpbHotPayload = { ...ready,
  readiness: { status: "not_ready", scheduledProductionEvidence: false,
    reasons: ["coverage_not_complete"], categories: {
      batting: { status: "not_ready", eligiblePlayers: 0 },
      starters: { status: "not_ready", eligiblePlayers: 0 },
      relievers: { status: "not_ready", eligiblePlayers: 0 },
    } },
  coverage: { ...ready.coverage, status: "unknown", completePlayers: 0,
    eligibleBatters: 0, eligibleStarters: 0, eligibleRelievers: 0 },
  batting: [], starters: [], relievers: [],
};
function view(payload: NpbHotPayload | null, state: "loading" | "ready" | "error", now = new Date("2026-09-26T03:00:00Z")) {
  return renderToStaticMarkup(<MemoryRouter><NpbHotView payload={payload} state={state} now={now} /></MemoryRouter>);
}

describe("NPB HOT static Home delivery", () => {
  it("shows a calm preparing state for a closed Production Gate with no sample fallback", () => {
    const html = view(notReady, "ready");
    expect(html).toContain("HOTランキング準備中");
    expect(html).toContain("9月25日");
    expect(html).not.toContain("打者A");
    expect(html).not.toContain("coverage_not_complete");
    expect(html).not.toContain("WHIP");
  });

  it("renders three compact ranked categories and canonical Player links when ready", () => {
    const html = view(ready, "ready");
    expect(html).toContain("注目打者");
    expect(html).toContain("注目先発");
    expect(html).toContain("注目救援");
    expect(html).toContain("28打席 / 2本塁打");
    expect(html).toContain("1登板 / 6.0回 / K/9 9.0");
    expect(html).toContain("2登板 / 2.1回 / K/9 12.0");
    expect(html).toContain('href="/NPB/players/batter-id"');
    expect(html).toContain('href="/NPB/players/starter-id"');
    expect(html).toContain('href="/NPB/players/reliever-id"');
    expect(html).not.toContain("WHIP");
  });

  it("keeps loading, fetch errors, and stale ready payloads local to HOT", () => {
    expect(view(null, "loading")).toContain("skeleton");
    expect(view(null, "error")).toContain("HOTデータを取得できませんでした");
    const stale = view(ready, "ready", new Date("2026-09-27T03:00:00Z"));
    expect(stale).toContain("HOTデータを更新中です");
    expect(stale).not.toContain("打者A");
  });

  it("validates HTTP schema, uses the last successful cache, and never invents rankings", async () => {
    const values = new Map<string, string>();
    const cache = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); } };
    let requested = "";
    const repository = new StaticHotRepository("https://example.github.io/baseball/", async (input) => {
      requested = String(input);
      return Response.json(notReady);
    }, cache);
    expect((await repository.findLatestNpb()).readiness.status).toBe("not_ready");
    expect(requested).toBe("https://example.github.io/baseball/data/npb/hot/latest.json");
    const offline = new StaticHotRepository("https://example.github.io/baseball/",
      async () => { throw new Error("offline"); }, cache);
    expect((await offline.findLatestNpb()).readiness.status).toBe("not_ready");
    await expect(new StaticHotRepository("https://elsewhere.example/",
      async () => Response.json({ schemaVersion: 1, readiness: "ready" }), cache).findLatestNpb())
      .rejects.toThrow();
  });

  it("uses the previous JST calendar date, including UTC rollover", () => {
    expect(expectedNpbHotDate(new Date("2026-09-25T15:01:00Z"))).toBe("2026-09-25");
  });

  it("accepts the isolated ready preview fixture without publishing it", () => {
    const fixture = readFileSync(fileURLToPath(new URL("./fixtures/npb-hot-ready.json", import.meta.url)), "utf8");
    const preview = npbHotPayloadSchema.parse(JSON.parse(fixture) as unknown);
    expect(view(preview, "ready")).toContain("検証打者");
  });

  it("carries only validated HOT JSON into a later whole-site Pages build", async () => {
    const directory = await mkdtemp(join(tmpdir(), "npb-hot-preserve-"));
    try {
      const standings = parseNf3Standings(readFileSync(fileURLToPath(new URL(
        "./fixtures/nf3/standings.html", import.meta.url)), "utf8"), date, ready.generatedAt);
      const standingsPath = join(directory, "standings.json");
      const hotPath = join(directory, "hot.json");
      await writeFile(standingsPath, JSON.stringify({ schemaVersion: 1, league: "NPB", throughDate: date,
        effectiveDate: date, generatedAt: ready.generatedAt, collectedAt: ready.generatedAt,
        sourceUpdatedAt: null, sourceKey: "nf3", attribution: "nf3",
        teams: Object.fromEntries(standings.map((row) => [row.teamId, { name: row.teamId, short: row.teamId }])),
        standings }));
      expect(await preservePublishedNpbHot(standingsPath, hotPath, "https://example.test/hot.json",
        async () => Response.json(notReady))).toBe("preserved");
      const previous = await readFile(hotPath, "utf8");
      expect(npbHotPayloadSchema.parse(JSON.parse(previous)).readiness.status).toBe("not_ready");
      expect(await preservePublishedNpbHot(standingsPath, hotPath, "https://example.test/hot.json",
        async () => Response.json({ schemaVersion: 1, readiness: "ready" }))).toBe("skipped");
      expect(await readFile(hotPath, "utf8")).toBe(previous);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
