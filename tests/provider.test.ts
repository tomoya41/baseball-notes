import { afterEach, describe, expect, it, vi } from "vitest";
import npb from "../public/data/npb.json";
import { SampleProvider } from "../src/infrastructure/providers/sample-provider";

afterEach(() => {
  vi.unstubAllGlobals();
});
describe("sample provider transport", () => {
  it("does not bind browser fetch to the provider instance", async () => {
    vi.stubGlobal("fetch", function (this: unknown) {
      expect(this).not.toBeInstanceOf(SampleProvider);
      return Promise.resolve(new Response(JSON.stringify(npb)));
    });
    expect(
      (
        await new SampleProvider().loadCatalog(
          "NPB",
          new AbortController().signal,
        )
      ).profiles,
    ).toHaveLength(2);
  });
  it("forwards cancellation and rejects non-OK HTTP responses", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("", { status: 503 }));
    const signal = new AbortController().signal;
    await expect(
      new SampleProvider(request).loadCatalog("NPB", signal),
    ).rejects.toThrow("503");
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining("data/npb.json"),
      { signal },
    );
  });
  it("does not expose malformed provider JSON to the domain", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"players":null}'));
    await expect(
      new SampleProvider(request).loadCatalog(
        "NPB",
        new AbortController().signal,
      ),
    ).rejects.toThrow();
  });
});
