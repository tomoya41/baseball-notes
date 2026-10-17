import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { Browser } from "@capacitor/browser";
import { canonicalDeepLink } from "../domain/native-navigation";
import { resumableNativeRoute } from "./native-resume";
import { clearSavedResponseFallback, needsPublicDataRefresh, setPublicNetworkOnline } from "../infrastructure/public-response-cache";
export const isAndroid = () => Capacitor.getPlatform() === "android";
export const publicAssetBase = () => isAndroid() ? "https://tomoya41.github.io/baseball-notes/" : import.meta.env.BASE_URL;
export const nativeNotifications = registerPlugin<{
  status(): Promise<{ configured: boolean; granted: boolean }>;
  enable(): Promise<{ granted: boolean }>;
  disable(): Promise<void>;
  subscribe(options: { topic: string }): Promise<void>;
  unsubscribe(options: { topic: string }): Promise<void>;
}>("FavoriteNotifications");
function incoming(url: string) {
  const route = canonicalDeepLink(url);
  if (!route) return false;
  window.location.hash = `#${route}`;
  return true;
}
const routeRestore = registerPlugin<{ consume(): Promise<{ route?: string }> }>("RouteRestore");
export async function installPlatformRuntime() {
  const refreshed = () => { if (needsPublicDataRefresh()) { clearSavedResponseFallback(); window.dispatchEvent(new Event("baseball:refresh-data")); } };
  window.addEventListener("online", refreshed);
  if (!isAndroid()) return;
  const restored = await routeRestore.consume().catch(() => ({} as { route?: string }));
  const resume = resumableNativeRoute(restored.route) ?? resumableNativeRoute(window.location.hash.slice(1));
  const launch = await App.getLaunchUrl();
  // Capacitor retains the initial ACTION_VIEW event as well as getLaunchUrl.
  // Suppress that one replay when resuming; later external intents still work.
  let ignoredLaunch = resume ? launch?.url : undefined;
  let openedDuringBoot = false;
  await App.addListener("appUrlOpen", event => {
    if (ignoredLaunch && event.url === ignoredLaunch) { ignoredLaunch = undefined; return; }
    openedDuringBoot = incoming(event.url) || openedDuringBoot;
  });
  if (!openedDuringBoot) {
    if (resume) window.location.hash = `#${resume}`;
    else if (launch?.url) incoming(launch.url);
  }
  const network = (connected: boolean) => { setPublicNetworkOnline(connected); window.dispatchEvent(new Event(connected ? "online" : "offline")); };
  network((await Network.getStatus()).connected);
  await Network.addListener("networkStatusChange", event => network(event.connected));
  await App.addListener("appStateChange", async event => { if (event.isActive) network((await Network.getStatus()).connected); });
  document.addEventListener("click", event => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
    if (link && /^https?:/.test(link.getAttribute("href") ?? "")) { event.preventDefault(); void Browser.open({ url: link.href }); }
  });
}
