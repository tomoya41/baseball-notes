import { afterEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ execute: vi.fn(), close: vi.fn() }));
vi.mock("../src/data/database", () => ({ openDataClient: vi.fn(() => db) }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.clearAllMocks(); });
it("validates queries before a circuit response and suppresses later DB attempts after an explicit read denial", async () => {
  vi.stubEnv("TURSO_DATABASE_URL", "https://synthetic.invalid"); vi.stubEnv("TURSO_AUTH_TOKEN", "synthetic-not-a-secret");
  db.execute.mockRejectedValue(Error("BLOCKED: SQL read operations are forbidden"));
  const { GET } = await import("../src/server-game-detail");
  const first = await GET(new Request("https://api.invalid/?gameId=npb:game:" + "a".repeat(20)));
  expect(first.status).toBe(503); expect(first.headers.get("Cache-Control")).toBe("no-store"); expect(db.execute).toHaveBeenCalledTimes(1); expect(db.close).toHaveBeenCalledTimes(1);
  const next = await GET(new Request("https://api.invalid/?gameId=npb:game:" + "b".repeat(20)));
  expect(next.status).toBe(503); expect(next.headers.get("Retry-After")).toBe("30"); expect(db.execute).toHaveBeenCalledTimes(1);
  const invalid = await GET(new Request("https://api.invalid/?gameId=unknown"));
  expect(invalid.status).toBe(400); expect(invalid.headers.get("Cache-Control")).toBe("no-store"); expect(db.execute).toHaveBeenCalledTimes(1);
});
