import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export async function installAndroidBackHandler(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.exitApp();
  });
}
