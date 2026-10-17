import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { installPlatformRuntime, rememberNativeRoute } from "../src/app/platform";
import { resumableNativeRoute } from "../src/app/native-resume";

const state = vi.hoisted(() => ({ platform: "android", saved: undefined as string | undefined,
  launch: "baseballnotes://NPB/cs?season=2026&stage=npb_cs_final&role=pitching",
  unsupported: false, bootEvent: undefined as string | undefined,
  listener: undefined as undefined | ((event: { url: string }) => void) }));
const consume = vi.hoisted(() => vi.fn(async () => {
  if (state.unsupported) throw Error("Plugin unavailable in an older APK");
  return { route: state.saved };
}));
const remember = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => state.platform },
  registerPlugin: (name: string) => name === "RouteRestore" ? { consume, remember } : {} }));
vi.mock("@capacitor/app", () => ({ App: {
  getLaunchUrl: vi.fn(async () => ({ url: state.launch })),
  addListener: vi.fn(async (name, callback) => {
    if (name === "appUrlOpen") { state.listener = callback; if (state.bootEvent) callback({ url: state.bootEvent }); }
  }),
} }));
vi.mock("@capacitor/network", () => ({ Network: { getStatus: async () => ({ connected: true }), addListener: vi.fn() } }));
vi.mock("@capacitor/browser", () => ({ Browser: { open: vi.fn() } }));
vi.mock("../src/infrastructure/public-response-cache", () => ({ clearSavedResponseFallback: vi.fn(),
  needsPublicDataRefresh: () => false, setPublicNetworkOnline: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks(); state.platform = "android"; state.saved = undefined; state.unsupported = false;
  state.bootEvent = undefined; state.listener = undefined;
  vi.stubGlobal("window", { location: { hash: "" }, addEventListener: vi.fn(), dispatchEvent: vi.fn() });
  vi.stubGlobal("document", { addEventListener: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());
it("opens a validated cold launch without saved state", async () => {
  await installPlatformRuntime();
  expect(window.location.hash).toContain("#/NPB/cs?");
  expect(window.location.hash).toContain("stage=npb_cs_final");
});
it("resumes the selected route, ignores one retained launch replay, then accepts the same new external link", async () => {
  state.saved = "/NPB/players/6bf4b271-e16c-43f9-9142-8c7ca7de9887/seasons?season=2026&competition=postseason&stage=npb_cs_final&role=pitching";
  await installPlatformRuntime(); expect(window.location.hash).toBe(`#${state.saved}`);
  state.listener!({ url: state.launch }); expect(window.location.hash).toBe(`#${state.saved}`);
  state.listener!({ url: state.launch }); expect(window.location.hash).toContain("#/NPB/cs?");
});
it("does not replay an initial retained URI over restored state during listener registration", async () => {
  state.saved = "/privacy"; state.bootEvent = state.launch;
  await installPlatformRuntime(); expect(window.location.hash).toBe("#/privacy");
});
it("a different valid external link arriving during boot takes priority", async () => {
  state.saved = "/privacy"; state.bootEvent = "baseballnotes://NPB/cs?season=2026&stage=npb_cs_first";
  await installPlatformRuntime(); expect(window.location.hash).toContain("stage=npb_cs_first");
});
it("an invalid external event cannot suppress the restored screen", async () => {
  state.saved = "/privacy"; state.bootEvent = "https://untrusted.example/NPB/cs";
  await installPlatformRuntime(); expect(window.location.hash).toBe("#/privacy");
});
it("preserves encoded filters on local reload even if the native adapter is unavailable", async () => {
  state.unsupported = true;
  window.location.hash = "#/NPB/cs?season=2026&q=A%26B%3DC%25";
  await installPlatformRuntime(); expect(window.location.hash).toBe("#/NPB/cs?season=2026&q=A%26B%3DC%25");
});
it.each(["/other", "/NPB/search?q=" + "x".repeat(8200), "/%ZZ/"])("rejects invalid or oversized private state %s", async route => {
  expect(resumableNativeRoute(route)).toBeNull(); state.saved = route;
  await installPlatformRuntime(); expect(window.location.hash).toContain("#/NPB/cs?");
});
it("Web does not consume native state or apply native launch URIs", async () => {
  state.platform = "web"; window.location.hash = "#/MLB/home";
  await installPlatformRuntime(); expect(consume).not.toHaveBeenCalled();
  expect(state.listener).toBeUndefined(); expect(window.location.hash).toBe("#/MLB/home");
});
it("records an encoded SPA route without relying on WebView.getUrl", async () => {
  const route = "/NPB/cs?season=2026&q=A%26B";
  await rememberNativeRoute(route); expect(remember).toHaveBeenCalledWith({ route });
});
it("does not record invalid state or any route on Web", async () => {
  await rememberNativeRoute("/other"); expect(remember).not.toHaveBeenCalled();
  state.platform = "web"; await rememberNativeRoute("/privacy"); expect(remember).not.toHaveBeenCalled();
});
it("an older native adapter cannot break navigation while recording", async () => {
  remember.mockRejectedValueOnce(Error("Plugin unavailable"));
  await expect(rememberNativeRoute("/privacy")).resolves.toBeUndefined();
});
