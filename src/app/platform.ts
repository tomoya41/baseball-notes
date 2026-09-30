import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { Browser } from "@capacitor/browser";
import { canonicalDeepLink } from "../domain/native-navigation";
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
function incoming(url: string) { const route = canonicalDeepLink(url); if (route) window.location.hash = `#${route}`; }
export async function installPlatformRuntime() {
  const refreshed = () => { if (needsPublicDataRefresh()) { clearSavedResponseFallback(); window.dispatchEvent(new Event("baseball:refresh-data")); } };
  window.addEventListener("online", refreshed);
  if (!isAndroid()) return;
  await App.addListener("appUrlOpen", event => incoming(event.url));
  const launch = await App.getLaunchUrl(); if (launch?.url) incoming(launch.url);
  const network = (connected: boolean) => { setPublicNetworkOnline(connected); window.dispatchEvent(new Event(connected ? "online" : "offline")); };
  network((await Network.getStatus()).connected);
  await Network.addListener("networkStatusChange", event => network(event.connected));
  await App.addListener("appStateChange", async event => { if (event.isActive) network((await Network.getStatus()).connected); });
  document.addEventListener("click", event => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
    if (link && /^https?:/.test(link.getAttribute("href") ?? "")) { event.preventDefault(); void Browser.open({ url: link.href }); }
  });
}
