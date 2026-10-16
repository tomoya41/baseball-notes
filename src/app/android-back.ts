import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { parentNativeRoute } from "../domain/native-navigation";

export async function installAndroidBackHandler(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await App.addListener("backButton", () => {
    const dialog = [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")].at(-1);
    if (dialog) { dialog.close(); return; }
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    // WebView's document history flag can be false for SPA pushState entries.
    // Router-owned entries are the authority; cold links still use the parent.
    if (Number.isInteger(index) && index > 0) { window.history.back(); return; }
    const parent = parentNativeRoute(window.location.hash.slice(1));
    if (parent) window.location.replace(`#${parent}`);
    else void App.exitApp();
  });
}
